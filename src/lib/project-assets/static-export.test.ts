import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

const blobs = vi.hoisted(() => new Map<string, unknown>());

vi.mock("localforage", () => {
  const store = {
    getItem: async <T>(key: string) => (blobs.get(key) as T) ?? null,
    setItem: async (key: string, value: unknown) => {
      blobs.set(key, value);
      return value;
    },
    removeItem: async (key: string) => blobs.delete(key),
  };
  return { default: { ...store, createInstance: () => store } };
});

import { buildStaticDeployment } from "../project-build";
import type { ProjectAssets, ProjectFiles } from "../../types";
import { buildProjectZip } from "./archive";
import {
  createProjectAssetRecord,
  stageProjectAsset,
  storeStagedProjectAsset,
} from "./core";
import { relativizePublicAssetUrls } from "./static-export";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
]);

async function heroAsset(): Promise<ProjectAssets> {
  const staged = await stageProjectAsset(
    "public/generated/hero.png",
    new Blob([PNG.buffer], { type: "image/png" }),
  );
  const asset = createProjectAssetRecord(
    staged,
    await storeStagedProjectAsset(staged),
  );
  return { [asset.path]: asset };
}

const staticSite: ProjectFiles = {
  "index.html":
    '<link rel="stylesheet" href="styles/site.css"><img src="/generated/hero.png" alt=""><img srcset="/generated/hero.png 2x">',
  "pages/about.html": "<img src='/generated/hero.png?v=2'>",
  "styles/site.css": ".hero { background: url(/generated/hero.png) }",
  "app.js": 'document.body.dataset.src = "/generated/hero.png";',
};

function imageReferences(html: string): string[] {
  return [...html.matchAll(/(?:src|srcset)=["']([^"' ]+)/g)].map(
    (match) => match[1],
  );
}

async function unzip(blob: Blob): Promise<JSZip> {
  return JSZip.loadAsync(await blob.arrayBuffer());
}

/** Resolves a reference the way a browser would from an unzipped folder. */
function resolvesInside(
  zip: JSZip,
  documentPath: string,
  reference: string,
): boolean {
  return [
    "file:///Users/me/Downloads/project/",
    "https://example.com/campaigns/spring/",
  ].every((base) => {
    const url = new URL(reference, new URL(documentPath, base));
    if (!url.href.startsWith(base)) return false;
    const entry = decodeURIComponent(url.pathname).slice(
      new URL(base).pathname.length,
    );
    return zip.file(entry) !== null;
  });
}

describe("static project ZIP image links", () => {
  beforeEach(() => blobs.clear());

  it("source ZIP: generated image references resolve when opened from disk or served under any path", async () => {
    const zip = await unzip(
      await buildProjectZip(staticSite, await heroAsset()),
    );

    expect(zip.file("public/generated/hero.png")).not.toBeNull();
    const index = await zip.file("index.html")!.async("text");
    expect(imageReferences(index)).toEqual([
      "public/generated/hero.png",
      "public/generated/hero.png",
    ]);
    for (const reference of imageReferences(index)) {
      expect(resolvesInside(zip, "index.html", reference)).toBe(true);
    }
    const about = await zip.file("pages/about.html")!.async("text");
    expect(about).toContain("src='../public/generated/hero.png?v=2'");
    expect(
      resolvesInside(zip, "pages/about.html", "../public/generated/hero.png"),
    ).toBe(true);
    expect(await zip.file("styles/site.css")!.async("text")).toContain(
      "url(../public/generated/hero.png)",
    );
    expect(await zip.file("app.js")!.async("text")).toBe(staticSite["app.js"]);
  });

  it("deployment ZIP: the same references resolve from disk", async () => {
    const result = await buildStaticDeployment({
      files: staticSite,
      assets: await heroAsset(),
      signal: new AbortController().signal,
    });
    const zip = await unzip(result.blob);
    const index = await zip.file("index.html")!.async("text");
    for (const reference of imageReferences(index)) {
      expect(resolvesInside(zip, "index.html", reference)).toBe(true);
    }
  });

  it("leaves projects with a build step untouched", async () => {
    const files: ProjectFiles = {
      "package.json": JSON.stringify({
        dependencies: { react: "^18.3.1", vite: "^4.5.0" },
        scripts: { dev: "vite" },
      }),
      "index.html": '<img src="/generated/hero.png">',
    };
    const zip = await unzip(await buildProjectZip(files, await heroAsset()));
    expect(await zip.file("index.html")!.async("text")).toBe(
      files["index.html"],
    );
  });
});

describe("relativizePublicAssetUrls", () => {
  it("rewrites only exact asset URLs, not look-alikes or prose", async () => {
    const assets = await heroAsset();
    const files = relativizePublicAssetUrls(
      {
        "index.html":
          '<img src="/generated/hero.png.bak"><img src="/generated/hero-2.png"><p>see https://x.test/generated/hero.png</p>',
      },
      assets,
    );
    expect(files["index.html"]).toBe(
      '<img src="/generated/hero.png.bak"><img src="/generated/hero-2.png"><p>see https://x.test/generated/hero.png</p>',
    );
  });
});
