// Harness renderers. Each runs inside a page that already shows the fixture at
// its exact CSS size and returns the PNG as base64.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RUNTIME_GLOBAL = "__OPEN_BUILDER_CAPTURE_RUNTIME_V1__";

async function canvasToBase64(page, script, arg) {
  return page.evaluate(
    async ({ script, arg }) => {
      const canvas = await new Function("arg", `return (${script})(arg)`)(arg);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      return btoa(binary);
    },
    { script, arg },
  );
}

/** The options capture() in preview-bridge.ts passes for a capture. */
function bridgeOptions({ width, height, pixelRatio }, output) {
  return {
    output,
    region: { x: 0, y: 0, width, height },
    scale: pixelRatio,
    windowWidth: width,
    windowHeight: height,
    cacheBust: true,
    pixelRatio: 1,
    skipAutoScale: true,
    width,
    height,
    canvasWidth: width * pixelRatio,
    canvasHeight: height * pixelRatio,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      margin: "0",
      overflow: "visible",
      position: "relative",
      top: "0px",
      left: "0px",
    },
  };
}

function runtime(output) {
  return async (page, options) => {
    await page.addScriptTag({ content: options.runtimeSource });
    return canvasToBase64(
      page,
      `async (options) => window[${JSON.stringify(RUNTIME_GLOBAL)}].toCanvas(document.documentElement, options)`,
      bridgeOptions(options, output),
    );
  };
}

/** The runtime's html-to-image fallback: toSvg, then draw at the export size. */
function htmlToImage(node) {
  return async (page, options) => {
    await page.addScriptTag({ content: options.runtimeSource });
    return canvasToBase64(
      page,
      `async (options) => {
        const svg = await window[${JSON.stringify(RUNTIME_GLOBAL)}].toSvg(document.${node}, options);
        const image = new Image();
        image.src = svg;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = options.canvasWidth;
        canvas.height = options.canvasHeight;
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas;
      }`,
      bridgeOptions(options, "evidence"),
    );
  };
}

function library(file, call) {
  return async (page, { width, height, pixelRatio }) => {
    await page.addScriptTag({ path: file() });
    return canvasToBase64(page, call, { width, height, scale: pixelRatio });
  };
}

function snapdomFile() {
  const libs = process.env.CAPTURE_FIDELITY_LIBS;
  if (!libs)
    throw new Error(
      "Set CAPTURE_FIDELITY_LIBS to a directory where @zumer/snapdom is installed.",
    );
  return `${libs}/node_modules/@zumer/snapdom/dist/snapdom.js`;
}

export const RENDERERS = {
  runtime: runtime("annotation"),
  "runtime-evidence": runtime("evidence"),
  "html-to-image": htmlToImage("documentElement"),
  "html-to-image-body": htmlToImage("body"),
  "modern-screenshot": library(
    () => require.resolve("modern-screenshot/dist/index.js"),
    `async ({ width, height, scale }) => modernScreenshot.domToCanvas(document.documentElement, { width, height, scale })`,
  ),
  snapdom: library(
    snapdomFile,
    `async ({ scale }) => snapdom.toCanvas(document.documentElement, { scale, dpr: 1, embedFonts: true })`,
  ),
};
