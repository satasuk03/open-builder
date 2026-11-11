import { describe, expect, it, vi } from "vitest";
import {
  OpenRouterImageError,
  type OpenRouterImageClient,
} from "../ai/openrouter";
import type { ToolExecutionContext } from "../ai/generator-types";
import { readProjectImageAssetContent } from "../project-assets/tool-result";
import { createSkillActiveContext } from "../skills/active-context";
import type { ProjectAsset } from "../../types";
import {
  createGenerateImageHandler,
  GENERATE_IMAGE_LIMITS,
  type ProjectImageSink,
} from "./generate-image";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function context(
  runId = "run-1",
  signal = new AbortController().signal,
): ToolExecutionContext {
  return {
    signal,
    toolCallId: "call-1",
    run: {
      runId,
      conversationId: "conversation",
      mode: "chat",
      platform: "web",
      runtime: "api",
      allowedMcpAliases: new Set(),
      activeSkillIds: new Set(),
      approvedSkillScriptHashes: new Set(),
      policyVersion: "test",
    },
    skillContext: createSkillActiveContext(),
  };
}

function fakeClient(
  generate: OpenRouterImageClient["generate"] = async () => ({
    bytes: PNG,
    declaredMimeType: "image/png",
    model: "google/gemini-3.1-flash-image",
  }),
): OpenRouterImageClient {
  return { model: "google/gemini-3.1-flash-image", generate: vi.fn(generate) };
}

function fakeSink(): ProjectImageSink {
  return {
    commit: vi.fn(async ({ stem }) => {
      const asset: ProjectAsset = {
        path: `public/generated/${stem}.png`,
        blobRef: "sha256:abc",
        mimeType: "image/png",
        size: PNG.byteLength,
        digest: "abc",
        modulePath: `src/generated-assets/${stem}-abc.js`,
        publicPath: `/generated/${stem}.png`,
      };
      return {
        asset,
        modulePath: asset.modulePath,
        publicPath: asset.publicPath,
        width: 1344,
        height: 768,
      };
    }),
  };
}

const args = {
  prompt: "Matcha latte flat lay on pale linen",
  name: "hero-matcha",
  aspect_ratio: "16:9",
};

describe("generate_image handler", () => {
  it("generates, commits and returns a reference the model can use", async () => {
    const client = fakeClient();
    const sink = fakeSink();
    const handler = createGenerateImageHandler({ client, sink });

    const output = await handler(args, context());

    expect(output.isError).toBeUndefined();
    expect(JSON.parse(output.text)).toMatchObject({
      ok: true,
      publicPath: "/generated/hero-matcha.png",
      width: 1344,
      height: 768,
    });
    expect(readProjectImageAssetContent(output.structuredContent)).toEqual({
      kind: "project_image_asset_v1",
      path: "public/generated/hero-matcha.png",
      publicPath: "/generated/hero-matcha.png",
      modulePath: "src/generated-assets/hero-matcha-abc.js",
      mimeType: "image/png",
      size: PNG.byteLength,
      digest: "abc",
      width: 1344,
      height: 768,
      model: "google/gemini-3.1-flash-image",
    });
    expect(client.generate).toHaveBeenCalledWith(
      {
        prompt: args.prompt,
        aspectRatio: "16:9",
        resolution: undefined,
      },
      expect.any(AbortSignal),
    );
  });

  it.each([
    [{ ...args, name: "../evil" }, "name"],
    [{ ...args, aspect_ratio: "7:3" }, "aspect_ratio"],
    [{ ...args, resolution: "4K" }, "resolution"],
    [{ ...args, path: "index.html" }, "input"],
    [{ name: "x" }, "prompt"],
  ])(
    "rejects invalid arguments %j without calling OpenRouter",
    async (bad, field) => {
      const client = fakeClient();
      const output = await createGenerateImageHandler({
        client,
        sink: fakeSink(),
      })(bad, context());
      expect(output.isError).toBe(true);
      expect(output.text).toContain(field);
      expect(client.generate).not.toHaveBeenCalled();
    },
  );

  it("caps attempts per run, counting failures, and resets for a new run", async () => {
    const client = fakeClient(async () => {
      throw new OpenRouterImageError("not_completed", "did not complete");
    });
    const handler = createGenerateImageHandler({ client, sink: fakeSink() });

    for (let i = 0; i < GENERATE_IMAGE_LIMITS.maxCallsPerRun; i += 1) {
      expect((await handler(args, context("run-1"))).text).toContain(
        "did not complete",
      );
    }
    const capped = await handler(args, context("run-1"));
    expect(capped.isError).toBe(true);
    expect(capped.text).toContain("limit");
    expect(client.generate).toHaveBeenCalledTimes(
      GENERATE_IMAGE_LIMITS.maxCallsPerRun,
    );

    await handler(args, context("run-2"));
    expect(client.generate).toHaveBeenCalledTimes(
      GENERATE_IMAGE_LIMITS.maxCallsPerRun + 1,
    );
  });

  it("returns a commit failure to the model instead of failing the run", async () => {
    const sink: ProjectImageSink = {
      commit: async () => {
        throw new DOMException(
          "The project changed while importing the image.",
          "AbortError",
        );
      },
    };
    const output = await createGenerateImageHandler({
      client: fakeClient(),
      sink,
    })(args, context());
    expect(output).toEqual({
      text: "Error: The project changed while importing the image.",
      isError: true,
    });
  });

  it("rethrows when the run itself is stopped", async () => {
    const controller = new AbortController();
    const client = fakeClient(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    await expect(
      createGenerateImageHandler({ client, sink: fakeSink() })(
        args,
        context("run-1", controller.signal),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
