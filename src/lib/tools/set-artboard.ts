import { tool } from "ai";
import { z } from "zod";
import type { ToolExecutionOutput } from "../ai/generator-types";
import { artboardPromptContext } from "../artboard/guidance";
import {
  ARTBOARD_IDS,
  ARTBOARD_PRESETS,
  artboardById,
} from "../artboard/presets";
import { setConversationArtboard } from "../../store/artboard";

const CLEAR_ARTBOARD = "none";

const setArtboardInputSchema = z
  .object({
    preset: z
      .enum([...ARTBOARD_IDS, CLEAR_ARTBOARD])
      .describe(
        `Artboard preset id, or "${CLEAR_ARTBOARD}" to return to the responsive preview. ` +
          ARTBOARD_PRESETS.map(
            (preset) => `${preset.id} = ${preset.width}x${preset.height}`,
          ).join(", "),
      ),
  })
  .strict();

export const SET_ARTBOARD_TOOL = {
  set_artboard: tool({
    description:
      "Set the fixed-size artboard for a banner, social image, ad, cover or header. " +
      "Call it before writing files for such a request: it fixes the exact pixel size the user exports as PNG " +
      'and returns the authoring rules for that size. Use "none" for a normal responsive page.',
    inputSchema: setArtboardInputSchema,
  }),
};

export function createSetArtboardHandler(deps: {
  conversationId: string;
}): (args: unknown) => ToolExecutionOutput {
  return (args) => {
    const parsed = setArtboardInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        text: `Error: invalid set_artboard arguments: ${parsed.error.issues
          .map(
            (issue) => `${issue.path.join(".") || "input"}: ${issue.message}`,
          )
          .join("; ")}`,
        isError: true,
      };
    }
    const preset = artboardById(parsed.data.preset);
    setConversationArtboard(deps.conversationId, preset?.id ?? null);
    return { text: artboardPromptContext(preset).trim() };
  };
}
