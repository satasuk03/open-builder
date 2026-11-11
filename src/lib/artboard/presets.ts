export const ARTBOARD_PRESETS = [
  { id: "og", name: "Open Graph", width: 1200, height: 630 },
  { id: "square", name: "Square post", width: 1080, height: 1080 },
  { id: "portrait", name: "Portrait post", width: 1080, height: 1350 },
  { id: "story", name: "Story", width: 1080, height: 1920 },
  { id: "landscape", name: "Landscape", width: 1920, height: 1080 },
  { id: "x-header", name: "X header", width: 1500, height: 500 },
  { id: "linkedin-banner", name: "LinkedIn banner", width: 1584, height: 396 },
] as const;

export type ArtboardPreset = (typeof ARTBOARD_PRESETS)[number];
export type ArtboardId = ArtboardPreset["id"];
export const ARTBOARD_IDS = ARTBOARD_PRESETS.map((preset) => preset.id) as [
  ArtboardId,
  ...ArtboardId[],
];

export function artboardById(id: unknown): ArtboardPreset | null {
  return ARTBOARD_PRESETS.find((preset) => preset.id === id) ?? null;
}

/** The aspect ratios the OpenRouter Images API documents. */
export const IMAGE_ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
] as const;
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];

function ratioValue(ratio: ImageAspectRatio): number {
  const [w, h] = ratio.split(":").map(Number);
  return w / h;
}

export function closestImageAspectRatio(size: {
  width: number;
  height: number;
}): ImageAspectRatio {
  const target = Math.log(size.width / size.height);
  let best: ImageAspectRatio = IMAGE_ASPECT_RATIOS[0];
  let bestDistance = Infinity;
  for (const ratio of IMAGE_ASPECT_RATIOS) {
    const distance = Math.abs(Math.log(ratioValue(ratio)) - target);
    if (distance < bestDistance) {
      best = ratio;
      bestDistance = distance;
    }
  }
  return best;
}
