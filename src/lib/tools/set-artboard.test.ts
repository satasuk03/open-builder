// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../skills/fs", () => ({ isSkillsAvailable: () => false }));
vi.mock("../skills/instance", () => ({ getSkillRegistry: vi.fn() }));

import type { ToolExecutionContext } from "../ai/generator-types";
import { buildToolSetForRun } from "../ai/tools-schema";
import { createSkillActiveContext } from "../skills/active-context";
import {
  getConversationArtboard,
  useArtboardStore,
} from "../../store/artboard";
import { buildToolHandlers } from "./handler-factory";
import { createForkToolHandlers } from "./fork-tools";

const context: ToolExecutionContext = {
  signal: new AbortController().signal,
  toolCallId: "call-1",
  run: {
    runId: "run-1",
    conversationId: "c1",
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

const forkTools = {
  conversationId: "c1",
  imageSink: {
    commit: async () => {
      throw new Error("not used");
    },
  },
};

async function build() {
  return buildToolHandlers({
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
      apiBaseUrl: "https://api.example.com",
      apiKey: "",
      model: "m",
    },
    getConsoleLogs: () => [],
    memoryDeps: { getAll: () => [], processBatch: () => "ok" },
    developerSkillScriptsEnabled: false,
    forkTools,
  });
}

describe("set_artboard", () => {
  beforeEach(() => {
    useArtboardStore.setState({ byConversation: {} });
  });

  it("sets the conversation artboard and returns the exact-pixel guidance", async () => {
    const built = await build();
    expect(built.customToolSet).toHaveProperty("set_artboard");

    const output = await built.combinedToolHandler(
      "set_artboard",
      { preset: "linkedin-banner" },
      context,
    );
    if (typeof output === "string") throw new Error(output);
    expect(output.isError).toBeUndefined();
    expect(output.text).toContain("exactly 1584x396 CSS px");
    expect(getConversationArtboard("c1")).toMatchObject({
      id: "linkedin-banner",
    });
  });

  it("clears the artboard with none and returns the hint", async () => {
    const built = await build();
    await built.combinedToolHandler("set_artboard", { preset: "og" }, context);
    const output = await built.combinedToolHandler(
      "set_artboard",
      { preset: "none" },
      context,
    );
    if (typeof output === "string") throw new Error(output);
    expect(getConversationArtboard("c1")).toBeNull();
    expect(output.text).toContain("No fixed artboard is set");
  });

  it("rejects an unknown preset without touching the store", async () => {
    const built = await build();
    await built.combinedToolHandler("set_artboard", { preset: "og" }, context);
    const output = await built.combinedToolHandler(
      "set_artboard",
      { preset: "billboard" },
      context,
    );
    if (typeof output === "string") throw new Error(output);
    expect(output.isError).toBe(true);
    expect(getConversationArtboard("c1")?.id).toBe("og");
  });

  it("is offered in a Design run and absent in a Plan run", () => {
    const fork = createForkToolHandlers(
      forkTools,
      { apiBaseUrl: "https://api.example.com", apiKey: "" },
      {},
    );
    for (const profile of ["default", "design"] as const) {
      expect(
        buildToolSetForRun({
          custom: fork.tools,
          mode: "chat",
          platform: "web",
          profile,
        }),
      ).toHaveProperty("set_artboard");
    }
    expect(
      buildToolSetForRun({ custom: fork.tools, mode: "plan", platform: "web" }),
    ).not.toHaveProperty("set_artboard");
    expect(
      createForkToolHandlers(
        forkTools,
        { apiBaseUrl: "", apiKey: "" },
        { localAgent: true },
      ).tools,
    ).not.toHaveProperty("set_artboard");
  });
});
