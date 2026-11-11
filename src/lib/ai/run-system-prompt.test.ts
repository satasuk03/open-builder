import { describe, expect, it } from "vitest";
import { artboardPromptContext } from "../artboard/guidance";
import { artboardById } from "../artboard/presets";
import { buildRunSystemPromptSuffix } from "./run-system-prompt";

const base = {
  memory: "",
  autoSkills: "",
  mandatorySkills: "",
  customSystemPrompt: "",
  planMode: "",
  designMode: "[design-mode]",
};

describe("artboard context in the Design prompt", () => {
  it("states the exact size when a preset is set", () => {
    const suffix = buildRunSystemPromptSuffix({
      ...base,
      mode: "chat",
      workspaceMode: "design",
      artboard: artboardPromptContext(artboardById("og")),
    });
    expect(suffix).toContain("exactly 1200x630 CSS px");
  });

  it("tells the model to call set_artboard when none is set", () => {
    const suffix = buildRunSystemPromptSuffix({
      ...base,
      mode: "chat",
      workspaceMode: "design",
      artboard: artboardPromptContext(null),
    });
    expect(suffix).toContain("call set_artboard");
    expect(suffix).not.toContain("Target artboard");
  });

  it("stays out of non-Design workspaces", () => {
    const suffix = buildRunSystemPromptSuffix({
      ...base,
      mode: "chat",
      workspaceMode: "auto",
      artboard: artboardPromptContext(artboardById("og")),
    });
    expect(suffix).not.toContain("1200x630");
  });
});
