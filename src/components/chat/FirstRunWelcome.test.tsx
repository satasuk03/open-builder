// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OPENROUTER_BASE_URL,
  OPENROUTER_DEFAULT_CHAT_MODEL,
} from "../../lib/ai/openrouter";
import { useSettingsStore } from "../../store/settings";
import { aiDefaults } from "../../store/settings/ai";
import { FirstRunWelcome } from "./FirstRunWelcome";

describe("FirstRunWelcome", () => {
  beforeEach(() => {
    useSettingsStore.setState((state) => ({
      system: { ...state.system, language: "en" },
      ai: {
        ...aiDefaults,
        apiKey: "",
        apiBaseUrl: "",
        model: "gpt-5.6-sol",
      },
    }));
  });

  it("configures the app from a key alone, even over a persisted blank state", async () => {
    const user = userEvent.setup();
    render(<FirstRunWelcome onOpenSettings={vi.fn()} />);
    expect(useSettingsStore.getState().isAIConfigured()).toBe(false);

    await user.type(
      screen.getByLabelText("OpenRouter API key"),
      " sk-or-v1-test ",
    );
    await user.click(screen.getByRole("button", { name: "Save key" }));

    expect(useSettingsStore.getState().ai).toMatchObject({
      runtime: "api",
      apiType: "openai-compatible",
      apiKey: "sk-or-v1-test",
      apiBaseUrl: OPENROUTER_BASE_URL,
      model: OPENROUTER_DEFAULT_CHAT_MODEL,
    });
    expect(useSettingsStore.getState().isAIConfigured()).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("Key saved.");
  });
});
