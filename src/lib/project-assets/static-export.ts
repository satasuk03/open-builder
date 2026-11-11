import type { ProjectAssets, ProjectFiles } from "../../types";

const DOCUMENT_RELATIVE_FILE = /\.(?:html?|css)$/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function relativePath(fromFile: string, toFile: string): string {
  const from = fromFile.split("/").slice(0, -1);
  const to = toFile.split("/");
  let shared = 0;
  while (
    shared < from.length &&
    shared < to.length - 1 &&
    from[shared] === to[shared]
  ) {
    shared += 1;
  }
  return [
    ...Array.from({ length: from.length - shared }, () => ".."),
    ...to.slice(shared),
  ].join("/");
}

/**
 * A static site is opened from disk or served from any base path, where a
 * root-absolute URL such as /generated/hero.png points outside the folder.
 * Rewrites those references in HTML and CSS to paths relative to the file
 * that point at the asset's own location in the archive. JavaScript is left
 * alone because its URLs resolve against the document, not the script.
 */
export function relativizePublicAssetUrls(
  files: ProjectFiles,
  assets: ProjectAssets,
): ProjectFiles {
  const publicAssets = Object.values(assets).filter(
    (asset) => asset.publicPath,
  );
  if (publicAssets.length === 0) return files;
  const next: ProjectFiles = { ...files };
  for (const [path, source] of Object.entries(files)) {
    if (!DOCUMENT_RELATIVE_FILE.test(path)) continue;
    let rewritten = source;
    for (const asset of publicAssets) {
      rewritten = rewritten.replace(
        new RegExp(
          `(^|["'(=\\s,])${escapeRegExp(asset.publicPath)}(?=$|["')\\s,?#])`,
          "g",
        ),
        (_match, prefix: string) =>
          `${prefix}${relativePath(path, asset.path)}`,
      );
    }
    next[path] = rewritten;
  }
  return next;
}
