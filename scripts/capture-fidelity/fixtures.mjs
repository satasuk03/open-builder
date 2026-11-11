import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { crc32, deflateSync } from "node:zlib";

const require = createRequire(import.meta.url);

function pngDataUrl(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x += 1) {
      const at = row + 1 + x * 3;
      raw[at] = Math.round((x / size) * 255);
      raw[at + 1] = Math.round((y / size) * 200);
      raw[at + 2] = (x >> 3) % 2 === (y >> 3) % 2 ? 220 : 90;
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

const fontDataUrl = `data:font/woff2;base64,${readFileSync(
  require.resolve("@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2"),
).toString("base64")}`;
const imageDataUrl = pngDataUrl(96);

function page(w, h, css, body) {
  const s = Math.min(w, h) / 630;
  const px = (value) => `${Math.round(value * s)}px`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><style>
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
#root{position:relative;width:${w}px;height:${h}px;overflow:hidden;background:#f4efe6;color:#13221f;font-family:Georgia,serif}
${css(px)}
</style></head><body><div id="root">${body(px)}</div></body></html>`;
}

/** Banner fixtures, one CSS feature each, so a diff points at one renderer gap. */
export const FIXTURES = {
  "svg-absolute": (w, h) =>
    page(
      w,
      h,
      (
        px,
      ) => `h1{position:absolute;left:${px(64)};top:${px(64)};margin:0;font-size:${px(64)}}
svg{position:absolute;right:${px(64)};top:50%;transform:translateY(-50%)}`,
      (px) => `<h1>Absolute SVG</h1>
<svg width="${px(220)}" height="${px(220)}" viewBox="0 0 220 220" aria-hidden="true">
<circle cx="110" cy="110" r="100" fill="#0b1f1c"/>
<path d="M60 120 L100 160 L165 70" fill="none" stroke="#fde68a" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    ),
  "svg-viewbox-only": (w, h) =>
    page(
      w,
      h,
      (
        px,
      ) => `.mark{position:absolute;left:${px(80)};top:${px(80)};width:${px(320)}}
.mark svg{display:block;width:100%;height:auto}`,
      () => `<div class="mark"><svg viewBox="0 0 200 120" aria-hidden="true">
<rect x="4" y="4" width="192" height="112" rx="18" fill="#2563eb"/>
<polygon points="40,96 100,24 160,96" fill="#fbbf24"/></svg></div>`,
    ),
  "img-data-url": (w, h) =>
    page(
      w,
      h,
      (px) =>
        `img{position:absolute;left:${px(80)};top:${px(80)};width:${px(360)};height:${px(360)};object-fit:cover}`,
      () => `<img alt="" src="${imageDataUrl}">`,
    ),
  "css-gradients": (w, h) =>
    page(
      w,
      h,
      (
        px,
      ) => `#root{background:linear-gradient(135deg,#0f766e 0%,#14b8a6 45%,#fde68a 100%)}
.r{position:absolute;left:${px(80)};top:${px(80)};width:${px(260)};height:${px(260)};border-radius:50%;background:radial-gradient(circle at 30% 30%,#fff,#be185d 70%)}
.c{position:absolute;left:${px(400)};top:${px(80)};width:${px(260)};height:${px(260)};background:conic-gradient(from 45deg,#f97316,#7c3aed,#22c55e,#f97316)}`,
      () => `<div class="r"></div><div class="c"></div>`,
    ),
  "gradient-text": (w, h) =>
    page(
      w,
      h,
      (px) =>
        `h1{position:absolute;left:${px(64)};top:${px(120)};margin:0;font:800 ${px(120)}/1 system-ui;background:linear-gradient(90deg,#db2777,#7c3aed,#0ea5e9);-webkit-background-clip:text;background-clip:text;color:transparent}`,
      () => `<h1>Gradient</h1>`,
    ),
  "clip-path": (w, h) =>
    page(
      w,
      h,
      (
        px,
      ) => `.a{position:absolute;left:${px(80)};top:${px(80)};width:${px(300)};height:${px(300)};background:#dc2626;clip-path:polygon(50% 0,100% 100%,0 100%)}
.b{position:absolute;left:${px(420)};top:${px(80)};width:${px(300)};height:${px(300)};background:#0d9488;clip-path:circle(40% at 50% 50%)}`,
      () => `<div class="a"></div><div class="b"></div>`,
    ),
  "radius-overflow": (w, h) =>
    page(
      w,
      h,
      (
        px,
      ) => `.card{position:absolute;left:${px(80)};top:${px(80)};width:${px(360)};height:${px(240)};border-radius:${px(48)};overflow:hidden;background:#1e293b}
.card img{display:block;width:120%;height:120%;margin:-10%}`,
      () => `<div class="card"><img alt="" src="${imageDataUrl}"></div>`,
    ),
  shadows: (w, h) =>
    page(
      w,
      h,
      (
        px,
      ) => `.box{position:absolute;left:${px(100)};top:${px(100)};width:${px(240)};height:${px(160)};background:#fff;border-radius:${px(16)};box-shadow:0 ${px(24)} ${px(48)} rgba(15,23,42,.45)}
.drop{position:absolute;left:${px(460)};top:${px(100)};width:${px(200)};filter:drop-shadow(${px(12)} ${px(16)} ${px(6)} rgba(0,0,0,.6))}
.drop svg{display:block;width:100%;height:auto}`,
      () =>
        `<div class="box"></div><div class="drop"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,5 95,95 5,95" fill="#f59e0b"/></svg></div>`,
    ),
  transforms: (w, h) =>
    page(
      w,
      h,
      (
        px,
      ) => `.rot{position:absolute;left:${px(120)};top:${px(120)};width:${px(220)};height:${px(120)};background:#7c3aed;transform:rotate(-12deg)}
.scl{position:absolute;left:${px(440)};top:${px(120)};width:${px(140)};height:${px(140)};background:#0891b2;transform:scale(1.5) rotate(30deg);transform-origin:top left}
.txt{position:absolute;left:${px(120)};top:${px(380)};margin:0;font:700 ${px(48)}/1 system-ui;transform:rotate(4deg)}`,
      () =>
        `<div class="rot"></div><div class="scl"></div><p class="txt">Rotated text</p>`,
    ),
  "mix-blend-mode": (w, h) =>
    page(
      w,
      h,
      (px) => `#root{background:linear-gradient(90deg,#fde68a,#0ea5e9)}
.a,.b{position:absolute;top:${px(100)};width:${px(260)};height:${px(260)};border-radius:50%}
.a{left:${px(100)};background:#ef4444;mix-blend-mode:multiply}
.b{left:${px(260)};background:#22c55e;mix-blend-mode:screen}`,
      () => `<div class="a"></div><div class="b"></div>`,
    ),
  "backdrop-filter": (w, h) =>
    page(
      w,
      h,
      (
        px,
      ) => `.stripes{position:absolute;inset:0;background:repeating-linear-gradient(45deg,#1d4ed8 0 ${px(24)},#fbbf24 ${px(24)} ${px(48)})}
.glass{position:absolute;left:${px(100)};top:${px(100)};width:${px(400)};height:${px(240)};border-radius:${px(24)};background:rgba(255,255,255,.25);backdrop-filter:blur(${px(12)});-webkit-backdrop-filter:blur(${px(12)})}`,
      () => `<div class="stripes"></div><div class="glass"></div>`,
    ),
  "web-font": (w, h) =>
    page(
      w,
      h,
      (
        px,
      ) => `@font-face{font-family:"Banner Fraunces";src:url("${fontDataUrl}") format("woff2");font-weight:100 900}
h1{position:absolute;left:${px(64)};top:${px(100)};margin:0;font:700 ${px(96)}/1.05 "Banner Fraunces",monospace}`,
      () => `<h1>Fraunces Display</h1>`,
    ),
  "letter-spacing": (w, h) =>
    page(
      w,
      h,
      (
        px,
      ) => `p{position:absolute;left:${px(64)};margin:0;font:600 ${px(40)}/1 system-ui}
.wide{top:${px(100)};letter-spacing:.3em;text-transform:uppercase}
.tight{top:${px(200)};letter-spacing:-.05em;font-size:${px(72)}}`,
      () =>
        `<p class="wide">Launch week</p><p class="tight">Tight headline</p>`,
    ),
  emoji: (w, h) =>
    page(
      w,
      h,
      (px) =>
        `p{position:absolute;left:${px(64)};top:${px(120)};margin:0;font:700 ${px(64)}/1.2 system-ui}`,
      () => `<p>Ship it 🚀✨🎉 today</p>`,
    ),
};
