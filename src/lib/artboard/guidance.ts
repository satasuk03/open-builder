import {
  ARTBOARD_PRESETS,
  closestImageAspectRatio,
  type ArtboardPreset,
} from "./presets";

const PRESET_LIST = ARTBOARD_PRESETS.map(
  (preset) => `${preset.id} (${preset.name}, ${preset.width}x${preset.height})`,
).join(", ");

/**
 * The one text that tells the model about the target artboard. The Design
 * prompt and the set_artboard tool result both use it, so they never disagree.
 */
export function artboardPromptContext(preset: ArtboardPreset | null): string {
  if (!preset) {
    return `
<marketing_asset>
No fixed artboard is set. When the user asks for a banner, social image, ad, cover, header, or other fixed-size marketing asset, call set_artboard with the closest preset before writing files. Presets: ${PRESET_LIST}.
</marketing_asset>
`;
  }
  const { name, width: w, height: h } = preset;
  const inset = Math.round(Math.min(w, h) * 0.05);
  return `
<marketing_asset>
Target artboard: ${name}, exactly ${w}x${h} CSS px. The user exports it as PNG ${w}x${h} (1x) and ${w * 2}x${h * 2} (2x).
For this request, this block supersedes the design_mode guidance about runnable, interactive, multi-page products. Produce one fixed-size static artboard.
- Empty project: call init_project with the "static" template. A single index.html is the artboard. No router, no design-project.json pages, no hover, focus, or loading states, no responsive breakpoints.
- Set html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden } and give one root element exactly ${w}px by ${h}px with position: relative. Size everything in px. Never use vw, vh, viewport percentages, or media queries.
- Draw shapes, icons, logos, dividers, and text effects as inline <svg>. Write copy as real HTML text; web fonts are fine.
- Do not put backdrop-filter directly on an element with border-radius: the PNG export does not clip the blur to its rounded corners. Put the blurred layer inside a wrapper that has the same border-radius and overflow: hidden.
- For photographic or illustrative imagery, call generate_image when it is available (aspect_ratio "${closestImageAspectRatio(preset)}") and reference the returned publicPath, for example <img src="/generated/hero.png">. Never hotlink remote images.
- Keep all text inside a ${inset}px safe inset. The headline must stay legible at 50% scale.
- Do not request responsive capture_preview_evidence views. The host previews the artboard at its exact size.
</marketing_asset>
`;
}
