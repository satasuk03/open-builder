import { describe, expect, it } from "vitest";
import { aiDefaults, type AISettings } from "../../store/settings/ai";
import {
  isOpenRouterBaseUrl,
  OPENROUTER_BASE_URL,
  OPENROUTER_DEFAULT_CHAT_MODEL,
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
