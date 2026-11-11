import { z } from "zod";
import type { AISettings } from "../../store/settings/ai";
import { DEFAULT_ATTACHMENT_CONSTRAINTS } from "../utils/attachments";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api";
export const OPENROUTER_DEFAULT_CHAT_MODEL = "anthropic/claude-sonnet-5.5";
export const OPENROUTER_IMAGE_MODEL = "google/gemini-3.1-flash-image";

const OPENROUTER_HOSTNAME = "openrouter.ai";

export function isOpenRouterBaseUrl(apiBaseUrl: string): boolean {
  try {
    const url = new URL(apiBaseUrl);
    return url.protocol === "https:" && url.hostname === OPENROUTER_HOSTNAME;
  } catch {
    return false;
  }
}

/**
 * Key-only setup: the full API settings for OpenRouter with this key, or null
 * for a blank key. Keeps the chosen model when the user is already on
 * OpenRouter, so a key change never resets their model.
 */
export function withOpenRouterKey(
  ai: AISettings,
  key: string,
): AISettings | null {
  const apiKey = key.trim();
  if (!apiKey) return null;
  const keepModel =
    ai.apiType === "openai-compatible" &&
    isOpenRouterBaseUrl(ai.apiBaseUrl) &&
    ai.model.includes("/");
  return {
    ...ai,
    runtime: "api",
    apiType: "openai-compatible",
    apiBaseUrl: OPENROUTER_BASE_URL,
    apiKey,
    model: keepModel ? ai.model : OPENROUTER_DEFAULT_CHAT_MODEL,
  };
}

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";
const OPENROUTER_IMAGE_MODELS_URL =
  "https://openrouter.ai/api/v1/images/models";
const IMAGE_REQUEST_TIMEOUT_MS = 120_000;
const MAX_ERROR_DETAIL_CHARS = 400;

export const IMAGE_ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
] as const;
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];

// The values OPENROUTER_IMAGE_MODEL accepts, minus "4K": a 4K PNG routinely
// exceeds the project asset size cap.
export const IMAGE_RESOLUTIONS = ["512", "1K", "2K"] as const;
export type ImageResolution = (typeof IMAGE_RESOLUTIONS)[number];

export interface OpenRouterImageRequest {
  prompt: string;
  aspectRatio?: ImageAspectRatio;
  resolution?: ImageResolution;
}

export interface OpenRouterImage {
  bytes: Uint8Array;
  /** As OpenRouter declared it; the asset layer re-detects from the bytes. */
  declaredMimeType: string;
  model: string;
  costUsd?: number;
}

export type OpenRouterImageErrorKind =
  | "auth"
  | "credits"
  | "rate_limit"
  | "unsupported"
  | "not_completed"
  | "too_large"
  | "network"
  | "bad_response";

export class OpenRouterImageError extends Error {
  readonly kind: OpenRouterImageErrorKind;

  constructor(kind: OpenRouterImageErrorKind, message: string) {
    super(message);
    this.name = "OpenRouterImageError";
    this.kind = kind;
  }
}

export interface OpenRouterImageClient {
  readonly model: string;
  generate(
    request: OpenRouterImageRequest,
    signal: AbortSignal,
  ): Promise<OpenRouterImage>;
}

const imageResponseSchema = z.object({
  data: z
    .array(
      z.object({
        b64_json: z.string().min(1),
        media_type: z.string().optional(),
      }),
    )
    .min(1),
  usage: z.object({ cost: z.number().optional() }).optional(),
});

const enumParameterSchema = z
  .object({ values: z.array(z.string()) })
  .optional()
  .catch(undefined);

const imageModelsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      supported_parameters: z
        .object({
          aspect_ratio: enumParameterSchema,
          resolution: enumParameterSchema,
        })
        .optional()
        .catch(undefined),
    }),
  ),
});

export interface ImageModelParameters {
  aspectRatios?: string[];
  resolutions?: string[];
}

/** Parses GET /images/models into supported parameter values per model id. */
export function parseImageModels(
  value: unknown,
): Map<string, ImageModelParameters> | null {
  const parsed = imageModelsSchema.safeParse(value);
  if (!parsed.success) return null;
  return new Map(
    parsed.data.data.map((model) => [
      model.id,
      {
        aspectRatios: model.supported_parameters?.aspect_ratio?.values,
        resolutions: model.supported_parameters?.resolution?.values,
      },
    ]),
  );
}

let imageModelsRequest: Promise<Map<
  string,
  ImageModelParameters
> | null> | null = null;

// Fetched only to explain an "unsupported" error, never on the happy path.
function loadImageModels(): Promise<Map<string, ImageModelParameters> | null> {
  imageModelsRequest ??= fetch(OPENROUTER_IMAGE_MODELS_URL, {
    signal: AbortSignal.timeout(10_000),
  })
    .then(async (response) =>
      response.ok ? parseImageModels(await response.json()) : null,
    )
    .catch(() => null)
    .then((models) => {
      if (!models) imageModelsRequest = null;
      return models;
    });
  return imageModelsRequest;
}

export function resetImageModelsCacheForTests(): void {
  imageModelsRequest = null;
}

async function describeSupportedParameters(model: string): Promise<string> {
  const parameters = (await loadImageModels())?.get(model);
  if (!parameters) return "";
  const parts = [
    parameters.aspectRatios &&
      `aspect_ratio: ${parameters.aspectRatios.join(", ")}`,
    parameters.resolutions &&
      `resolution: ${parameters.resolutions.join(", ")}`,
  ].filter(Boolean);
  return ` Supported by ${model}: ${parts.join("; ")}.`;
}

async function readErrorDetail(response: Response): Promise<string> {
  const text = (await response.text().catch(() => "")).slice(0, 4000);
  try {
    const json = JSON.parse(text) as { error?: { message?: unknown } };
    if (typeof json.error?.message === "string") {
      return json.error.message.slice(0, MAX_ERROR_DETAIL_CHARS);
    }
  } catch {
    // Not JSON; fall through to the raw text.
  }
  return text.trim().slice(0, MAX_ERROR_DETAIL_CHARS);
}

async function errorForStatus(
  response: Response,
  model: string,
): Promise<OpenRouterImageError> {
  const detail = await readErrorDetail(response);
  const suffix = detail ? ` (${detail})` : "";
  switch (response.status) {
    case 401:
    case 403:
      return new OpenRouterImageError(
        "auth",
        `OpenRouter rejected the API key${suffix}. Ask the user to check their key in Settings.`,
      );
    case 402:
      return new OpenRouterImageError(
        "credits",
        `The OpenRouter account has insufficient credits${suffix}. Ask the user to add credits; do not retry.`,
      );
    case 429:
      return new OpenRouterImageError(
        "rate_limit",
        `OpenRouter rate-limited the image request${suffix}. Wait before trying again.`,
      );
    case 400:
    case 422:
      return new OpenRouterImageError(
        "unsupported",
        `OpenRouter rejected the image parameters${suffix}.${await describeSupportedParameters(model)}`,
      );
    case 502:
      return new OpenRouterImageError(
        "not_completed",
        `The image generation did not complete and was not billed${suffix}. It is safe to retry once.`,
      );
    default:
      return new OpenRouterImageError(
        "network",
        `OpenRouter image request failed with HTTP ${response.status}${suffix}.`,
      );
  }
}

function decodeBase64Image(value: string): Uint8Array {
  const base64 = value.replace(/^data:[^,]*;base64,/, "");
  const decodedSize = Math.floor((base64.length * 3) / 4);
  if (decodedSize > DEFAULT_ATTACHMENT_CONSTRAINTS.maxImageBytes) {
    throw new OpenRouterImageError(
      "too_large",
      `The generated image is larger than ${DEFAULT_ATTACHMENT_CONSTRAINTS.maxImageBytes} bytes. Try a lower resolution.`,
    );
  }
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new OpenRouterImageError(
      "bad_response",
      "OpenRouter returned image data that is not valid base64.",
    );
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function attributionHeaders(): Record<string, string> {
  const origin = globalThis.location?.origin;
  return {
    "X-Title": "Open Builder",
    ...(origin && origin !== "null" ? { "HTTP-Referer": origin } : {}),
  };
}

/** Null unless the provider is OpenRouter with a key: the gate for generate_image. */
export function createOpenRouterImageClient(config: {
  apiBaseUrl: string;
  apiKey: string;
}): OpenRouterImageClient | null {
  const apiKey = config.apiKey.trim();
  if (!apiKey || !isOpenRouterBaseUrl(config.apiBaseUrl)) return null;
  const model = OPENROUTER_IMAGE_MODEL;

  return {
    model,
    async generate(request, signal) {
      const body = {
        model,
        prompt: request.prompt,
        n: 1,
        ...(request.aspectRatio && { aspect_ratio: request.aspectRatio }),
        ...(request.resolution && { resolution: request.resolution }),
      };
      // Raw fetch with no retry: the POST is billable, so a retried
      // request after a slow success could charge the user twice.
      let response: Response;
      try {
        response = await fetch(OPENROUTER_IMAGES_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...attributionHeaders(),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(IMAGE_REQUEST_TIMEOUT_MS),
          ]),
        });
      } catch (error) {
        if (signal.aborted) throw error;
        const timedOut =
          error instanceof DOMException && error.name === "TimeoutError";
        throw new OpenRouterImageError(
          "network",
          timedOut
            ? `The image request timed out after ${IMAGE_REQUEST_TIMEOUT_MS / 1000}s.`
            : "Could not reach OpenRouter for image generation.",
        );
      }

      if (!response.ok) throw await errorForStatus(response, model);

      const declaredLength = Number(response.headers.get("content-length"));
      if (
        Number.isFinite(declaredLength) &&
        declaredLength >
          (DEFAULT_ATTACHMENT_CONSTRAINTS.maxImageBytes * 4) / 3 + 64 * 1024
      ) {
        throw new OpenRouterImageError(
          "too_large",
          "The generated image is too large for the project. Try a lower resolution.",
        );
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch (error) {
        if (signal.aborted) throw error;
        throw new OpenRouterImageError(
          "bad_response",
          "OpenRouter returned an image response that is not JSON.",
        );
      }
      const parsed = imageResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new OpenRouterImageError(
          "bad_response",
          "OpenRouter returned an image response without image data.",
        );
      }
      const [image] = parsed.data.data;
      return {
        bytes: decodeBase64Image(image.b64_json),
        declaredMimeType: image.media_type ?? "application/octet-stream",
        model,
        costUsd: parsed.data.usage?.cost,
      };
    },
  };
}
