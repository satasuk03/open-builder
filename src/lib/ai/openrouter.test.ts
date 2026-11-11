import { afterEach, describe, expect, it, vi } from "vitest";
import { aiDefaults, type AISettings } from "../../store/settings/ai";
import {
  createOpenRouterImageClient,
  isOpenRouterBaseUrl,
  OPENROUTER_BASE_URL,
  OPENROUTER_DEFAULT_CHAT_MODEL,
  OPENROUTER_IMAGE_MODEL,
  OpenRouterImageError,
  parseImageModels,
  resetImageModelsCacheForTests,
  withOpenRouterKey,
} from "./openrouter";

const blank: AISettings = {
  ...aiDefaults,
  apiKey: "",
  apiBaseUrl: "",
  model: "gpt-5.6-sol",
};

describe("isOpenRouterBaseUrl", () => {
  it("accepts the OpenRouter host with or without a version path", () => {
    expect(isOpenRouterBaseUrl("https://openrouter.ai/api")).toBe(true);
    expect(isOpenRouterBaseUrl("https://openrouter.ai/api/v1/")).toBe(true);
  });

  it("rejects look-alike hosts, plain http and garbage", () => {
    expect(isOpenRouterBaseUrl("https://openrouter.ai.evil.com/api")).toBe(
      false,
    );
    expect(isOpenRouterBaseUrl("https://evil.com/openrouter.ai")).toBe(false);
    expect(isOpenRouterBaseUrl("https://api.openrouter.ai.co")).toBe(false);
    expect(isOpenRouterBaseUrl("http://openrouter.ai/api")).toBe(false);
    expect(isOpenRouterBaseUrl("")).toBe(false);
    expect(isOpenRouterBaseUrl("openrouter.ai")).toBe(false);
  });
});

describe("withOpenRouterKey", () => {
  it("returns null for a blank key", () => {
    expect(withOpenRouterKey(aiDefaults, "   ")).toBeNull();
  });

  it("configures a persisted blank state in one step", () => {
    expect(withOpenRouterKey(blank, "  sk-or-v1-abc  ")).toEqual({
      ...blank,
      runtime: "api",
      apiType: "openai-compatible",
      apiBaseUrl: OPENROUTER_BASE_URL,
      apiKey: "sk-or-v1-abc",
      model: OPENROUTER_DEFAULT_CHAT_MODEL,
    });
  });

  it("keeps a model already chosen on OpenRouter", () => {
    const next = withOpenRouterKey(
      { ...aiDefaults, model: "openai/gpt-6.1-sol" },
      "sk-or-v1-new",
    );
    expect(next?.model).toBe("openai/gpt-6.1-sol");
  });

  it("resets a model that belongs to another provider", () => {
    const next = withOpenRouterKey(
      {
        ...aiDefaults,
        apiType: "anthropic",
        apiBaseUrl: "https://api.anthropic.com",
        model: "claude-sonnet-5-5",
        runtime: "localCli",
      },
      "sk-or-v1-new",
    );
    expect(next).toMatchObject({
      runtime: "api",
      apiType: "openai-compatible",
      apiBaseUrl: OPENROUTER_BASE_URL,
      model: OPENROUTER_DEFAULT_CHAT_MODEL,
    });
  });
});

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function client() {
  const created = createOpenRouterImageClient({
    apiBaseUrl: OPENROUTER_BASE_URL,
    apiKey: "sk-or-v1-test",
  });
  if (!created) throw new Error("expected a client");
  return created;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createOpenRouterImageClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetImageModelsCacheForTests();
  });

  it("is offered only for OpenRouter with a key", () => {
    expect(
      createOpenRouterImageClient({
        apiBaseUrl: "https://api.openai.com",
        apiKey: "sk",
      }),
    ).toBeNull();
    expect(
      createOpenRouterImageClient({
        apiBaseUrl: OPENROUTER_BASE_URL,
        apiKey: "  ",
      }),
    ).toBeNull();
    expect(client().model).toBe(OPENROUTER_IMAGE_MODEL);
  });

  it("posts the request once and decodes base64 image data", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        created: 1,
        data: [
          {
            b64_json: `data:image/png;base64,${base64(PNG_BYTES)}`,
            media_type: "image/png",
          },
        ],
        usage: { cost: 0.039 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = await client().generate(
      { prompt: "a teapot", aspectRatio: "16:9" },
      new AbortController().signal,
    );

    expect(image).toEqual({
      bytes: PNG_BYTES,
      declaredMimeType: "image/png",
      model: OPENROUTER_IMAGE_MODEL,
      costUsd: 0.039,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://openrouter.ai/api/v1/images");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk-or-v1-test",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      model: OPENROUTER_IMAGE_MODEL,
      prompt: "a teapot",
      n: 1,
      aspect_ratio: "16:9",
    });
  });

  it.each([
    [401, "auth"],
    [402, "credits"],
    [429, "rate_limit"],
    [502, "not_completed"],
    [500, "network"],
  ] as const)("maps HTTP %i to %s without retrying", async (status, kind) => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: { message: "nope" } }, status),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await client()
      .generate({ prompt: "x" }, new AbortController().signal)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OpenRouterImageError);
    expect(error).toMatchObject({ kind });
    expect((error as Error).message).toContain("nope");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("explains a rejected parameter with the model's supported values, fetched once", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/images/models")
        ? jsonResponse({
            data: [
              {
                id: OPENROUTER_IMAGE_MODEL,
                supported_parameters: {
                  aspect_ratio: { type: "enum", values: ["1:1", "16:9"] },
                  resolution: { type: "enum", values: ["1K", "2K"] },
                  n: { type: "range", min: 1, max: 1 },
                },
              },
            ],
          })
        : jsonResponse({ error: { message: "bad aspect_ratio" } }, 400),
    );
    vi.stubGlobal("fetch", fetchMock);

    for (let i = 0; i < 2; i += 1) {
      const error = await client()
        .generate(
          { prompt: "x", aspectRatio: "4:5" },
          new AbortController().signal,
        )
        .catch((e: unknown) => e);
      expect(error).toMatchObject({ kind: "unsupported" });
      expect((error as Error).message).toContain(
        "aspect_ratio: 1:1, 16:9; resolution: 1K, 2K",
      );
    }
    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith("/images/models")),
    ).toHaveLength(1);
  });

  it("refuses an oversized image before decoding it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ data: [{ b64_json: "A".repeat(12 * 1024 * 1024) }] }),
      ),
    );
    await expect(
      client().generate({ prompt: "x" }, new AbortController().signal),
    ).rejects.toMatchObject({ kind: "too_large" });
  });

  it("rejects a response without image data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ data: [] })),
    );
    await expect(
      client().generate({ prompt: "x" }, new AbortController().signal),
    ).rejects.toMatchObject({ kind: "bad_response" });
  });

  it("rethrows the caller's abort instead of wrapping it", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );
    const pending = client().generate({ prompt: "x" }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("parseImageModels", () => {
  it("reads per-model enum values and tolerates range parameters", () => {
    const models = parseImageModels({
      data: [
        {
          id: "a/b",
          supported_parameters: {
            aspect_ratio: { type: "enum", values: ["1:1"] },
            n: { type: "range", min: 1, max: 4 },
          },
        },
        { id: "c/d" },
      ],
    });
    expect(models?.get("a/b")).toEqual({
      aspectRatios: ["1:1"],
      resolutions: undefined,
    });
    expect(models?.get("c/d")).toEqual({
      aspectRatios: undefined,
      resolutions: undefined,
    });
    expect(parseImageModels({ nope: true })).toBeNull();
  });
});
