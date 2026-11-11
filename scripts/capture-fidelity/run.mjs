// Measures how closely PNG exports match what Chromium paints for banner fixtures.
//
//   node scripts/capture-fidelity/run.mjs --out <dir> [--mode app|harness]
//     [--renderer <name>] [--base http://localhost:5184] [--only a,b]
//     [--presets og,story,landscape] [--ratios 1,2]
//
// Needs the dev server at --base. "app" exports through the Camera menu of the
// real UI; "harness" calls the injected capture runtime (or a candidate) with
// the bridge's annotation options, for quick experiments.
/* global document, createImageBitmap, OffscreenCanvas, ImageData -- page.evaluate bodies run in the browser */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { FIXTURES } from "./fixtures.mjs";
import { RENDERERS } from "./renderers.mjs";

const PRESETS = {
  og: { label: "Open Graph", width: 1200, height: 630 },
  story: { label: "Story", width: 1080, height: 1920 },
  landscape: { label: "Landscape", width: 1920, height: 1080 },
};
const CHANNEL_TOLERANCE = 48;

const { values: args } = parseArgs({
  options: {
    out: { type: "string" },
    mode: { type: "string", default: "app" },
    renderer: { type: "string", default: "runtime" },
    base: { type: "string", default: "http://localhost:5184" },
    only: { type: "string" },
    presets: { type: "string", default: "og,story,landscape" },
    ratios: { type: "string", default: "1,2" },
  },
});
if (!args.out) throw new Error("--out <dir> is required");
const fixtureNames = args.only ? args.only.split(",") : Object.keys(FIXTURES);
const presetNames = args.presets.split(",");
const ratios = args.ratios.split(",").map(Number);
await mkdir(args.out, { recursive: true });

function fixtureHtml(name, preset) {
  const html = FIXTURES[name](preset.width, preset.height);
  return html.replace(
    "<head>",
    `<head><meta name="fixture" content="${name}-${preset.width}x${preset.height}">`,
  );
}

function pngSize(bytes) {
  if (bytes.subarray(0, 8).join(",") !== "137,80,78,71,13,10,26,10")
    throw new Error("not a PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function openFixture(browser, html, preset, ratio) {
  const context = await browser.newContext({
    viewport: { width: preset.width, height: preset.height },
    deviceScaleFactor: ratio,
  });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

async function groundTruth(browser, html, preset, ratio) {
  const { context, page } = await openFixture(browser, html, preset, ratio);
  const bytes = await page.screenshot({ type: "png" });
  await context.close();
  return bytes;
}

async function harnessExport(browser, html, preset, ratio, renderer) {
  const { context, page } = await openFixture(browser, html, preset, ratio);
  const base64 = await RENDERERS[renderer](page, {
    width: preset.width,
    height: preset.height,
    pixelRatio: ratio,
    runtimeSource,
  });
  await context.close();
  return Buffer.from(base64, "base64");
}

async function compare(comparePage, truth, actual) {
  return comparePage.evaluate(
    async ({ truth, actual, tolerance }) => {
      const decode = async (base64) => {
        const bitmap = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${base64}`)).blob(),
        );
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d");
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const a = await decode(truth);
      const b = await decode(actual);
      if (a.width !== b.width || a.height !== b.height)
        return { sizeMismatch: true, diffPercent: 100, meanError: 255 };
      const diff = new ImageData(a.width, a.height);
      let differing = 0;
      let total = 0;
      for (let at = 0; at < a.data.length; at += 4) {
        const alphaB = b.data[at + 3] / 255;
        let worst = 0;
        for (let channel = 0; channel < 3; channel += 1) {
          // Unpainted export pixels are transparent; compare them as black.
          const delta = Math.abs(
            a.data[at + channel] - b.data[at + channel] * alphaB,
          );
          worst = Math.max(worst, delta);
          total += delta;
        }
        const gray =
          (a.data[at] + a.data[at + 1] + a.data[at + 2]) / 3 / 4 + 190;
        const bad = worst > tolerance;
        if (bad) differing += 1;
        diff.data[at] = bad ? 255 : gray;
        diff.data[at + 1] = bad ? 0 : gray;
        diff.data[at + 2] = bad ? 0 : gray;
        diff.data[at + 3] = 255;
      }
      const canvas = new OffscreenCanvas(a.width, a.height);
      canvas.getContext("2d").putImageData(diff, 0, 0);
      const blob = await canvas.convertToBlob({ type: "image/png" });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      return {
        sizeMismatch: false,
        diffPercent: (differing / (a.width * a.height)) * 100,
        meanError: total / (a.width * a.height * 3),
        diffPng: btoa(binary),
      };
    },
    {
      truth: truth.toString("base64"),
      actual: actual.toString("base64"),
      tolerance: CHANNEL_TOLERANCE,
    },
  );
}

async function waitForApp(page) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const ready = await page.evaluate(async () => {
      const { useConversationStore } =
        await import("/src/store/conversation.ts");
      const { useSnapshotStore } = await import("/src/store/snapshot.ts");
      const { useProjectArchiveStore } =
        await import("/src/store/project-archives.ts");
      const state = useConversationStore.getState();
      return Boolean(
        state._hasHydrated &&
        state.activeId &&
        state.conversations[state.activeId] &&
        useSnapshotStore.getState()._hasHydrated &&
        useProjectArchiveStore.getState()._hasHydrated,
      );
    });
    if (ready) return;
    await page.waitForTimeout(200);
  }
  throw new Error("app did not hydrate");
}

async function appExport(page, name, preset, ratios) {
  const html = fixtureHtml(name, preset);
  await page.evaluate(async (html) => {
    const { useConversationStore } = await import("/src/store/conversation.ts");
    const result = useConversationStore.getState().replaceProject({
      template: "static",
      previewMode: "sandpack",
      activeFile: "index.html",
      files: { "index.html": html },
    });
    if (!result.ok) throw new Error(result.error);
  }, html);
  await page
    .frameLocator(".sp-preview-iframe")
    .locator(
      `meta[name=fixture][content="${name}-${preset.width}x${preset.height}"]`,
    )
    .waitFor({ state: "attached", timeout: 60_000 });
  await page.getByTestId("artboard-picker").click();
  await page
    .getByRole("menuitemradio", { name: new RegExp(`^${preset.label}`) })
    .click();
  const exports = {};
  for (const ratio of ratios) {
    const camera = page.getByRole("button", { name: "Export screenshot" });
    await camera.waitFor();
    for (let i = 0; i < 150 && !(await camera.isEnabled()); i += 1)
      await page.waitForTimeout(200);
    await camera.click();
    const download = page.waitForEvent("download", { timeout: 90_000 });
    await page
      .getByRole("menuitem", { name: new RegExp(`^PNG ${ratio}x`) })
      .click();
    const file = path.join(args.out, `.download-${ratio}.png`);
    await (await download).saveAs(file);
    exports[ratio] = await readFile(file);
  }
  return exports;
}

let runtimeSource = "";
const browser = await chromium.launch();
const appContext = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1600, height: 1000 },
});
const appPage = await appContext.newPage();
await appPage.goto(args.base);
if (args.mode === "app") await waitForApp(appPage);
else
  runtimeSource = await appPage.evaluate(async () => {
    const { loadDesignCaptureRuntimeSource } =
      await import("/src/lib/design/preview-capture.ts");
    return loadDesignCaptureRuntimeSource();
  });

const rows = [];
for (const presetName of presetNames) {
  const preset = PRESETS[presetName];
  for (const name of fixtureNames) {
    const exported =
      args.mode === "app"
        ? await appExport(appPage, name, preset, ratios)
        : Object.fromEntries(
            await Promise.all(
              ratios.map(async (ratio) => [
                ratio,
                await harnessExport(
                  browser,
                  fixtureHtml(name, preset),
                  preset,
                  ratio,
                  args.renderer,
                ),
              ]),
            ),
          );
    for (const ratio of ratios) {
      const stem = `${presetName}-${name}@${ratio}x`;
      const truth = await groundTruth(
        browser,
        fixtureHtml(name, preset),
        preset,
        ratio,
      );
      const actual = exported[ratio];
      const size = pngSize(actual);
      const expected = `${preset.width * ratio}x${preset.height * ratio}`;
      const result = await compare(appPage, truth, actual);
      await writeFile(path.join(args.out, `${stem}.truth.png`), truth);
      await writeFile(path.join(args.out, `${stem}.export.png`), actual);
      if (result.diffPng)
        await writeFile(
          path.join(args.out, `${stem}.diff.png`),
          Buffer.from(result.diffPng, "base64"),
        );
      rows.push({
        preset: presetName,
        fixture: name,
        ratio,
        size: `${size.width}x${size.height}`,
        sizeOk: `${size.width}x${size.height}` === expected,
        diffPercent: Number(result.diffPercent.toFixed(2)),
        meanError: Number(result.meanError.toFixed(2)),
      });
      console.log(
        [
          presetName.padEnd(9),
          name.padEnd(17),
          `${ratio}x`,
          `${size.width}x${size.height}`.padEnd(9),
          rows.at(-1).sizeOk ? "size-ok" : `SIZE!=${expected}`,
          `diff ${rows.at(-1).diffPercent.toFixed(2).padStart(6)}%`,
          `mean ${rows.at(-1).meanError.toFixed(2).padStart(6)}`,
        ].join("  "),
      );
    }
  }
}
await writeFile(
  path.join(args.out, "scores.json"),
  `${JSON.stringify({ mode: args.mode, renderer: args.renderer, rows }, null, 2)}\n`,
);
await browser.close();
