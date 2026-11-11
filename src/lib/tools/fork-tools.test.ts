import { describe, expect, it } from "vitest";
import { OPENROUTER_BASE_URL } from "../ai/openrouter";
import {
  buildToolSetForRun,
  getToolCapability,
  isWriteToolName,
} from "../ai/tools-schema";
import { createForkToolHandlers, type ForkToolDeps } from "./fork-tools";

const deps: ForkToolDeps = {
  conversationId: "conversation",
  imageSink: {
    commit: async () => {
      throw new Error("not used");
    },
  },
};
const openRouter = { apiBaseUrl: OPENROUTER_BASE_URL, apiKey: "sk-or-v1" };

function toolNames(...input: Parameters<typeof createForkToolHandlers>) {
  const fork = createForkToolHandlers(...input);
  expect(Object.keys(fork.tools).sort()).toEqual(
    [...fork.handlers.keys()].sort(),
  );
  return Object.keys(fork.tools);
}

describe("createForkToolHandlers", () => {
  it("offers generate_image for an API run on OpenRouter with a key and a sink", () => {
    expect(toolNames(deps, openRouter, {})).toEqual(["generate_image"]);
  });

  it.each([
    [
      "another provider",
      deps,
      { ...openRouter, apiBaseUrl: "https://api.openai.com" },
      {},
    ],
    [
      "a look-alike host",
      deps,
      { ...openRouter, apiBaseUrl: "https://openrouter.ai.evil.com/api" },
      {},
    ],
    ["no key", deps, { ...openRouter, apiKey: "" }, {}],
    ["no sink", undefined, openRouter, {}],
    ["the local CLI", deps, openRouter, { localAgent: true }],
  ] as const)("offers nothing with %s", (_label, d, api, features) => {
    expect(toolNames(d, api, features)).toEqual([]);
  });
});

describe("generate_image catalog entry", () => {
  it("is a chat-only write tool for the default and design profiles", () => {
    const fork = createForkToolHandlers(deps, openRouter, {});
    expect(getToolCapability("generate_image")).toMatchObject({
      modes: ["chat"],
      profiles: ["default", "design"],
    });
    expect(isWriteToolName("generate_image")).toBe(true);
    for (const profile of ["default", "design"] as const) {
      expect(
        buildToolSetForRun({
          custom: fork.tools,
          mode: "chat",
          platform: "web",
          profile,
        }),
      ).toHaveProperty("generate_image");
    }
    expect(
      buildToolSetForRun({ custom: fork.tools, mode: "plan", platform: "web" }),
    ).not.toHaveProperty("generate_image");
  });
});
