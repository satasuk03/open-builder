// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blobs = vi.hoisted(() => new Map<string, Map<string, unknown>>());

vi.mock("localforage", () => {
  const instance = (storeName: string) => {
    const store = blobs.get(storeName) ?? new Map<string, unknown>();
    blobs.set(storeName, store);
    return {
      getItem: async <T>(key: string) => (store.get(key) as T) ?? null,
      setItem: async (key: string, value: unknown) => {
        store.set(key, value);
        return value;
      },
      removeItem: async (key: string) => store.delete(key),
      clear: async () => store.clear(),
      iterate: async <T>(iterator: (value: T, key: string) => void) => {
        for (const [key, value] of store) iterator(value as T, key);
      },
    };
  };
  return {
    default: {
      ...instance("root"),
      createInstance: ({ storeName = "default" }: { storeName?: string }) =>
        instance(storeName),
    },
  };
});
vi.mock("../skills/fs", () => ({ isSkillsAvailable: () => false }));
vi.mock("../skills/instance", () => ({ getSkillRegistry: vi.fn() }));

import { OPENROUTER_BASE_URL } from "../ai/openrouter";
import type { ToolExecutionContext } from "../ai/generator-types";
import { projectFilesForSandpack } from "../project-assets/core";
import { createSkillActiveContext } from "../skills/active-context";
import { useConversationStore } from "../../store/conversation";
import { useProjectTemplateStore } from "../../store/project-templates";
import { useSnapshotStore } from "../../store/snapshot";
import type { ProjectFiles } from "../../types";
import { createProjectImageSink } from "./generate-image";
import { buildToolHandlers } from "./handler-factory";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
]);

function context(conversationId: string): ToolExecutionContext {
  return {
    signal: new AbortController().signal,
    toolCallId: "call-1",
    run: {
      runId: "run-1",
      conversationId,
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

describe("generate_image end to end", () => {
  beforeEach(() => {
    for (const store of blobs.values()) store.clear();
    useConversationStore.setState({
      conversations: {},
      activeId: null,
      _hasHydrated: true,
      legacyPlanModeMigrated: false,
    });
    useSnapshotStore.setState({ snapshots: {}, _hasHydrated: true });
    useProjectTemplateStore.setState({ templates: {}, _hasHydrated: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("puts the OpenRouter image in the project, the generator copy and the preview", async () => {
    const conversationId = useConversationStore.getState().createConversation();
    useConversationStore
      .getState()
      .setFiles({ "index.html": "<!doctype html><title>Banner</title>" });
    let generatorFiles: ProjectFiles = {};

    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        created: 1,
        data: [
          {
            b64_json: btoa(String.fromCharCode(...PNG)),
            media_type: "image/png",
          },
        ],
        usage: { cost: 0.04 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const built = await buildToolHandlers({
      features: { builtinSearch: false, webSearch: false, assetSearch: false },
      effectiveWebSearchSettings: {
        engine: "firecrawl",
        tavilyApiKey: "",
        firecrawlApiKey: "",
        exaApiKey: "",
      },
      effectiveAssetSearchSettings: {
        engine: "pixabay",
        pixabayApiKey: "",
        unsplashApiKey: "",
      },
      apiConfig: {
        apiType: "openai-compatible",
        apiBaseUrl: OPENROUTER_BASE_URL,
        apiKey: "sk-or-v1-test",
        model: "anthropic/claude-sonnet-5.5",
      },
      getConsoleLogs: () => [],
      memoryDeps: { getAll: () => [], processBatch: () => "ok" },
      developerSkillScriptsEnabled: false,
      forkTools: {
        conversationId,
        imageSink: createProjectImageSink({
          conversationId,
          isCurrent: () => true,
          syncGeneratorFiles: (files) => {
            generatorFiles = files;
          },
        }),
      },
    });
    expect(built.customToolSet).toHaveProperty("generate_image");

    const output = await built.combinedToolHandler(
      "generate_image",
      { prompt: "Matcha latte flat lay", name: "hero", aspect_ratio: "16:9" },
      context(conversationId),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://openrouter.ai/api/v1/images",
    );
    if (typeof output === "string") throw new Error(output);
    expect(output.isError).toBeUndefined();
    const { publicPath } = JSON.parse(output.text) as { publicPath: string };
    expect(publicPath).toBe("/generated/hero.png");

    const conversation =
      useConversationStore.getState().conversations[conversationId];
    const asset = conversation.assets?.["public/generated/hero.png"];
    expect(asset).toMatchObject({ mimeType: "image/png", publicPath });
    expect(conversation.files[asset!.modulePath]).toContain(
      `export default "${publicPath}"`,
    );
    expect(generatorFiles[asset!.modulePath]).toBe(
      conversation.files[asset!.modulePath],
    );
    expect(blobs.get("attachments")?.size ?? 0).toBe(0);

    const html = `<!doctype html><body><img src="${publicPath}" alt=""></body>`;
    const preview = await projectFilesForSandpack(
      { ...conversation.files, "index.html": html },
      conversation.assets ?? {},
    );
    expect(preview["index.html"]).toContain(
      `src="data:image/png;base64,${btoa(String.fromCharCode(...PNG))}"`,
    );
    expect(preview["index.html"]).not.toContain(publicPath);
  });
});
