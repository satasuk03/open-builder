import { describe, expect, it } from "vitest";
import { readProjectImageAssetContent } from "./tool-result";

const localCliResult = {
  kind: "project_image_asset_v1",
  imageId: "img-1",
  path: "public/generated/hero.png",
  modulePath: "src/generated-assets/hero-abc.js",
  publicPath: "/generated/hero.png",
  mimeType: "image/png",
  size: 10,
  digest: "abc",
};

describe("readProjectImageAssetContent", () => {
  it("accepts the local CLI import result", () => {
    expect(readProjectImageAssetContent(localCliResult)).toEqual(
      localCliResult,
    );
  });

  it("keeps generate_image's dimensions and model", () => {
    const { imageId: _imageId, ...rest } = localCliResult;
    expect(
      readProjectImageAssetContent({
        ...rest,
        width: 1344,
        height: 768,
        model: "google/gemini-3.1-flash-image",
      }),
    ).toMatchObject({ width: 1344, height: 768 });
  });

  it.each([
    null,
    "text",
    { ...localCliResult, kind: "agnes" },
    { ...localCliResult, path: "src/hero.png" },
    { ...localCliResult, mimeType: "text/html" },
    { ...localCliResult, size: "10" },
    { ...localCliResult, width: -1 },
    { ...localCliResult, model: 3 },
  ])("rejects %j", (value) => {
    expect(readProjectImageAssetContent(value)).toBeUndefined();
  });
});
