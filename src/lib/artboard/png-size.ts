const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = [0x49, 0x48, 0x44, 0x52];

/** Width and height from a PNG's IHDR chunk, or null when the bytes are not a PNG. */
export function readPngSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (
    bytes.length < 24 ||
    PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte) ||
    IHDR.some((byte, index) => bytes[12 + index] !== byte)
  )
    return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8, false) !== 13) return null;
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}
