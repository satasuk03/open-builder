/**
 * The persisted tool result for an image added to the project, shared by
 * generate_image and the local CLI's import_generated_image. Metadata only.
 */
export interface ProjectImageAssetContent {
  kind: "project_image_asset_v1";
  path: string;
  publicPath: string;
  modulePath: string;
  mimeType: string;
  size: number;
  digest: string;
  width?: number;
  height?: number;
  imageId?: string;
  model?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalNumber(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function optionalString(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : null;
}

export function readProjectImageAssetContent(
  value: unknown,
): ProjectImageAssetContent | undefined {
  if (!isRecord(value) || value.kind !== "project_image_asset_v1") return;
  const { path, publicPath, modulePath, mimeType, size, digest } = value;
  if (
    typeof path !== "string" ||
    !path.startsWith("public/") ||
    typeof publicPath !== "string" ||
    !publicPath.startsWith("/") ||
    typeof modulePath !== "string" ||
    typeof mimeType !== "string" ||
    !mimeType.startsWith("image/") ||
    typeof size !== "number" ||
    typeof digest !== "string"
  ) {
    return;
  }
  const width = optionalNumber(value.width);
  const height = optionalNumber(value.height);
  const imageId = optionalString(value.imageId);
  const model = optionalString(value.model);
  if (width === null || height === null || imageId === null || model === null)
    return;
  return {
    kind: "project_image_asset_v1",
    path,
    publicPath,
    modulePath,
    mimeType,
    size,
    digest,
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
    ...(imageId !== undefined && { imageId }),
    ...(model !== undefined && { model }),
  };
}
