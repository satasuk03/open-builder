import JSZip from "jszip";
import type { ProjectAssets, ProjectFiles } from "../../types";
import { assessProjectRuntime } from "../project-runtime/capabilities";
import { readProjectAssetBytes } from "./core";
import { relativizePublicAssetUrls } from "./static-export";

export async function buildProjectZip(
  files: ProjectFiles,
  assets: ProjectAssets = {},
): Promise<Blob> {
  const zip = new JSZip();
  const runtime = assessProjectRuntime(files);
  const archived =
    runtime.template === "static" && runtime.staticBuild.supported
      ? relativizePublicAssetUrls(files, assets)
      : files;
  for (const [path, content] of Object.entries(archived)) {
    zip.file(path, content);
  }
  for (const asset of Object.values(assets)) {
    zip.file(asset.path, await readProjectAssetBytes(asset));
  }
  return zip.generateAsync({ type: "blob" });
}
