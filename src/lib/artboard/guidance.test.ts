import { describe, expect, it } from "vitest";
import { artboardPromptContext } from "./guidance";
import { ARTBOARD_PRESETS, artboardById } from "./presets";

describe("artboardPromptContext", () => {
  it("states the exact size, the 2x export size, and the closest ratio", () => {
    const text = artboardPromptContext(artboardById("og"));
    expect(text).toContain("exactly 1200x630 CSS px");
    expect(text).toContain("2400x1260 (2x)");
    expect(text).toContain('aspect_ratio "16:9"');
    expect(text).toContain("width: 1200px; height: 630px");
    expect(text).toContain("32px safe inset");
    expect(text).toContain('"static" template');
  });

  it("uses the portrait ratio for a story", () => {
    const text = artboardPromptContext(artboardById("story"));
    expect(text).toContain("exactly 1080x1920 CSS px");
    expect(text).toContain("2160x3840 (2x)");
    expect(text).toContain('aspect_ratio "9:16"');
  });

  it("without an artboard, points the model at set_artboard and every preset", () => {
    const text = artboardPromptContext(null);
    expect(text).toContain("call set_artboard");
    for (const preset of ARTBOARD_PRESETS) {
      expect(text).toContain(
        `${preset.id} (${preset.name}, ${preset.width}x${preset.height})`,
      );
    }
    expect(text).not.toContain("exactly");
  });
});
