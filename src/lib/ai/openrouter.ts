import type { AISettings } from "../../store/settings/ai";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api";
export const OPENROUTER_DEFAULT_CHAT_MODEL = "anthropic/claude-sonnet-5.5";
export const OPENROUTER_IMAGE_MODEL = "google/gemini-3.1-flash-image";

const OPENROUTER_HOSTNAME = "openrouter.ai";

export function isOpenRouterBaseUrl(apiBaseUrl: string): boolean {
  try {
    const url = new URL(apiBaseUrl);
    return url.protocol === "https:" && url.hostname === OPENROUTER_HOSTNAME;
  } catch {
    return false;
  }
}

/**
 * Key-only setup: the full API settings for OpenRouter with this key, or null
 * for a blank key. Keeps the chosen model when the user is already on
 * OpenRouter, so a key change never resets their model.
 */
export function withOpenRouterKey(
  ai: AISettings,
  key: string,
): AISettings | null {
  const apiKey = key.trim();
  if (!apiKey) return null;
  const keepModel =
    ai.apiType === "openai-compatible" &&
    isOpenRouterBaseUrl(ai.apiBaseUrl) &&
    ai.model.includes("/");
  return {
    ...ai,
    runtime: "api",
    apiType: "openai-compatible",
    apiBaseUrl: OPENROUTER_BASE_URL,
    apiKey,
    model: keepModel ? ai.model : OPENROUTER_DEFAULT_CHAT_MODEL,
  };
}
