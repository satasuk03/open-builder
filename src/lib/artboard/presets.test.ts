import { describe, expect, it } from "vitest";
import { isPreviewViewportSize } from "../design/preview-runtime";
import {
  ARTBOARD_IDS,
  ARTBOARD_PRESETS,
  artboardById,
  closestImageAspectRatio,
} from "./presets";

describe("artboard presets", () => {
  it.each(ARTBOARD_PRESETS)(
    "$id fits the preview viewport bounds as a desktop capture",
    (preset) => {
      expect(
        isPreviewViewportSize("desktop", preset.width, preset.height),
      ).toBe(true);
    },
  );

  it("includes the required marketing sizes", () => {
    const sizes = ARTBOARD_PRESETS.map((p) => `${p.width}x${p.height}`);
    expect(sizes).toEqual(
      expect.arrayContaining([
        "1200x630",
        "1080x1080",
        "1080x1920",
        "1920x1080",
        "1500x500",
        "1584x396",
      ]),
    );
  });

  it("has unique ids", () => {
    expect(new Set(ARTBOARD_IDS).size).toBe(ARTBOARD_PRESETS.length);
  });

  it("looks presets up by id and rejects anything else", () => {
    expect(artboardById("og")).toMatchObject({ width: 1200, height: 630 });
    expect(artboardById("missing")).toBeNull();
    expect(artboardById(undefined)).toBeNull();
    expect(artboardById({ id: "og" })).toBeNull();
  });

  it("picks the closest image aspect ratio", () => {
    expect(closestImageAspectRatio({ width: 1200, height: 630 })).toBe("16:9");
    expect(closestImageAspectRatio({ width: 1080, height: 1920 })).toBe("9:16");
    expect(closestImageAspectRatio({ width: 1080, height: 1080 })).toBe("1:1");
    expect(closestImageAspectRatio({ width: 1080, height: 1350 })).toBe("4:5");
    expect(closestImageAspectRatio({ width: 1584, height: 396 })).toBe("21:9");
  });
});
