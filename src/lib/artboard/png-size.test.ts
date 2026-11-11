import { describe, expect, it } from "vitest";
import { readPngSize } from "./png-size";

function pngHeader(width: number, height: number, ihdrLength = 13) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, ihdrLength);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("readPngSize", () => {
  it("reads the IHDR dimensions", () => {
    expect(readPngSize(pngHeader(2400, 1260))).toEqual({
      width: 2400,
      height: 1260,
    });
  });

  it("rejects bytes that are not a PNG header", () => {
    const jpeg = pngHeader(10, 10);
    jpeg[0] = 0xff;
    expect(readPngSize(jpeg)).toBeNull();
    expect(readPngSize(pngHeader(10, 10, 12))).toBeNull();
    expect(readPngSize(pngHeader(10, 10).subarray(0, 20))).toBeNull();
    const wrongChunk = pngHeader(10, 10);
    wrongChunk[12] = 0x61;
    expect(readPngSize(wrongChunk)).toBeNull();
  });
});
