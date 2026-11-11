import type { ToolSet } from "ai";
import { createOpenRouterImageClient } from "../ai/openrouter";
import type {
  ToolExecutionContext,
  ToolExecutionOutput,
} from "../ai/generator-types";
import {
  createGenerateImageHandler,
  GENERATE_IMAGE_TOOL,
  type ProjectImageSink,
} from "./generate-image";

/**
 * The single entry point for tools this fork adds on top of upstream.
 * Add a tool by spreading its schema into FORK_TOOL_DEFINITIONS, giving it a
 * descriptor in host-tool-catalog-data.ts, and registering its handler below
 * under whatever condition makes it runnable.
 */
export const FORK_TOOL_DEFINITIONS: ToolSet = {
  ...GENERATE_IMAGE_TOOL,
};

export interface ForkToolDeps {
  conversationId: string;
  imageSink: ProjectImageSink;
}

export type ForkToolHandler = (
  args: unknown,
  context?: ToolExecutionContext,
) => ToolExecutionOutput | Promise<ToolExecutionOutput>;

export interface ForkTools {
  tools: ToolSet;
  handlers: Map<string, ForkToolHandler>;
}

export function createForkToolHandlers(
  deps: ForkToolDeps | undefined,
  apiConfig: { apiBaseUrl: string; apiKey: string },
  features: { localAgent?: boolean },
): ForkTools {
  const forkTools: ForkTools = { tools: {}, handlers: new Map() };
  if (!deps || features.localAgent) return forkTools;

  const imageClient = createOpenRouterImageClient(apiConfig);
  if (imageClient) {
    Object.assign(forkTools.tools, GENERATE_IMAGE_TOOL);
    forkTools.handlers.set(
      "generate_image",
      createGenerateImageHandler({ client: imageClient, sink: deps.imageSink }),
    );
  }

  return forkTools;
}
