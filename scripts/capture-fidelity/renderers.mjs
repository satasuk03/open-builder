// Harness renderers. Each runs inside a page that already shows the fixture at
// its exact CSS size and returns the PNG as base64.

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

/** The options capture() in preview-bridge.ts passes for an annotation export. */
function bridgeOptions({ width, height, pixelRatio }, withRegion) {
  return {
    output: "annotation",
    ...(withRegion ? { region: { x: 0, y: 0, width, height } } : {}),
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

function runtime(withRegion, node = "documentElement") {
  return async (page, options) => {
    await page.addScriptTag({ content: options.runtimeSource });
    return canvasToBase64(
      page,
      `async (options) => window[${JSON.stringify(RUNTIME_GLOBAL)}].toCanvas(document.${node}, options)`,
      bridgeOptions(options, withRegion),
    );
  };
}

const libs = process.env.CAPTURE_FIDELITY_LIBS;

export const RENDERERS = {
  runtime: runtime(true),
  "runtime-fallback": runtime(false),
  "runtime-fallback-body": runtime(false, "body"),
  "modern-screenshot": async (page, { width, height, pixelRatio }) => {
    await page.addScriptTag({
      path: `${libs}/node_modules/modern-screenshot/dist/index.js`,
    });
    return canvasToBase64(
      page,
      `async ({ width, height, scale }) => modernScreenshot.domToCanvas(document.documentElement, { width, height, scale })`,
      { width, height, scale: pixelRatio },
    );
  },
  snapdom: async (page, { pixelRatio }) => {
    await page.addScriptTag({
      path: `${libs}/node_modules/@zumer/snapdom/dist/snapdom.js`,
    });
    return canvasToBase64(
      page,
      `async ({ scale }) => snapdom.toCanvas(document.documentElement, { scale, dpr: 1, embedFonts: true })`,
      { scale: pixelRatio },
    );
  },
};
