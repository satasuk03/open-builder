import { tool } from "ai";
import { z } from "zod";
import {
  IMAGE_RESOLUTIONS,
  type OpenRouterImageClient,
} from "../ai/openrouter";
import { IMAGE_ASPECT_RATIOS } from "../artboard/presets";
import type {
  ToolExecutionContext,
  ToolExecutionOutput,
} from "../ai/generator-types";
import type { ImportGeneratedImageAssetResult } from "../project-assets/import";
import type { ProjectImageAssetContent } from "../project-assets/tool-result";
import type { ProjectFiles } from "../../types";

export const GENERATE_IMAGE_LIMITS = { maxCallsPerRun: 6 } as const;

// The stem argument is `name`, not `path`: a Design run's page-scope check
// reads `path`, and an additive asset that cannot overwrite anything is
// deliberately outside page scope.
const generateImageInputSchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .min(3)
      .max(4000)
      .describe(
        "What the image shows: subject, composition, lighting, style and palette. No text in the image unless asked.",
      ),
    name: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{0,47}$/)
      .describe(
        "Lower-case file stem such as hero-background. The extension is chosen from the image format.",
      ),
    aspect_ratio: z
      .enum(IMAGE_ASPECT_RATIOS)
      .optional()
      .describe(
        "Closest ratio to the slot the image fills, e.g. 16:9 for a 1200x630 banner.",
      ),
    resolution: z
      .enum(IMAGE_RESOLUTIONS)
      .optional()
      .describe(
        "Output resolution. Default 1K; use 2K for full-bleed hero art.",
      ),
  })
  .strict();

export const GENERATE_IMAGE_TOOL = {
  generate_image: tool({
    description:
      "Generate a raster image with the user's OpenRouter key and save it in the project as public/generated/<name>.<ext>. " +
      "Use it for photographic or illustrative imagery that HTML, CSS or SVG cannot express. " +
      "Do not use it for icons, logos, shapes or text: author those as inline SVG and HTML. " +
      `Each call costs the user money; at most ${GENERATE_IMAGE_LIMITS.maxCallsPerRun} calls per run, so reuse images you already made. ` +
      "Reference the returned publicPath (for example /generated/hero.png) from HTML or CSS; never hotlink remote images.",
    inputSchema: generateImageInputSchema,
  }),
};

export interface SavedProjectImage extends ImportGeneratedImageAssetResult {
  width?: number;
  height?: number;
}

/** Run-scoped port that commits image bytes to the project. */
export interface ProjectImageSink {
  commit(input: {
    bytes: Uint8Array;
    stem: string;
    signal: AbortSignal;
  }): Promise<SavedProjectImage>;
}

async function imageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number } | undefined> {
  if (typeof createImageBitmap !== "function") return undefined;
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return undefined;
  }
}

/**
 * The asset is committed straight to the conversation store and the
 * generator's file copy is then synced, without an operation id, so a Design
 * run's prepareCommit never sees the host-managed asset module.
 */
export function createProjectImageSink(deps: {
  conversationId: string;
  isCurrent: () => boolean;
  syncGeneratorFiles: (files: ProjectFiles) => void;
}): ProjectImageSink {
  return {
    async commit({ bytes, stem, signal }) {
      // Imported lazily: the conversation store already depends on the tool
      // catalog, which imports this module, so a static import would cycle.
      const [{ commitGeneratedImage }, { useConversationStore }] =
        await Promise.all([
          import("../project-assets/commit-generated-image"),
          import("../../store/conversation"),
        ]);
      const imported = await commitGeneratedImage({
        conversationId: deps.conversationId,
        bytes,
        stem,
        signal,
        isCurrent: deps.isCurrent,
      });
      const current =
        useConversationStore.getState().conversations[deps.conversationId];
      if (current && deps.isCurrent()) deps.syncGeneratorFiles(current.files);
      const dimensions = await imageDimensions(
        new Blob([Uint8Array.from(bytes).buffer], {
          type: imported.asset.mimeType,
        }),
      );
      return { ...imported, ...dimensions };
    },
  };
}

function errorOutput(message: string): ToolExecutionOutput {
  return { text: `Error: ${message}`, isError: true };
}

export function createGenerateImageHandler(deps: {
  client: OpenRouterImageClient;
  sink: ProjectImageSink;
}): (
  args: unknown,
  context?: ToolExecutionContext,
) => Promise<ToolExecutionOutput> {
  let calls = { runId: "", count: 0 };

  return async (args, context) => {
    if (!context) return errorOutput("generate_image needs a run context.");
    const parsed = generateImageInputSchema.safeParse(args);
    if (!parsed.success) {
      return errorOutput(
        `invalid generate_image arguments: ${parsed.error.issues
          .map(
            (issue) => `${issue.path.join(".") || "input"}: ${issue.message}`,
          )
          .join("; ")}`,
      );
    }
    if (calls.runId !== context.run.runId) {
      calls = { runId: context.run.runId, count: 0 };
    }
    // Attempts are counted, not successes: a failed call may still be billed.
    if (calls.count >= GENERATE_IMAGE_LIMITS.maxCallsPerRun) {
      return errorOutput(
        `the limit of ${GENERATE_IMAGE_LIMITS.maxCallsPerRun} generated images per run is reached. Reuse the images already in public/generated/.`,
      );
    }
    calls.count += 1;

    const input = parsed.data;
    try {
      const image = await deps.client.generate(
        {
          prompt: input.prompt,
          aspectRatio: input.aspect_ratio,
          resolution: input.resolution,
        },
        context.signal,
      );
      const saved = await deps.sink.commit({
        bytes: image.bytes,
        stem: input.name,
        signal: context.signal,
      });
      const content: ProjectImageAssetContent = {
        kind: "project_image_asset_v1",
        path: saved.asset.path,
        publicPath: saved.publicPath,
        modulePath: saved.modulePath,
        mimeType: saved.asset.mimeType,
        size: saved.asset.size,
        digest: saved.asset.digest,
        ...(saved.width !== undefined && { width: saved.width }),
        ...(saved.height !== undefined && { height: saved.height }),
        model: image.model,
      };
      return {
        text: JSON.stringify({
          ok: true,
          path: content.path,
          publicPath: content.publicPath,
          mimeType: content.mimeType,
          width: content.width,
          height: content.height,
          note: `Reference it as ${content.publicPath}`,
        }),
        structuredContent: content,
      };
    } catch (error) {
      if (context.signal.aborted) throw error;
      return errorOutput(
        error instanceof Error ? error.message : "image generation failed.",
      );
    }
  };
}
