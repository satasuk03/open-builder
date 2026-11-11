// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  getConversationArtboard,
  parsePersistedArtboards,
  setConversationArtboard,
  useArtboardStore,
} from "./artboard";

describe("artboard store", () => {
  beforeEach(() => {
    useArtboardStore.setState({ byConversation: {} });
  });

  it("sets and clears a conversation's artboard", () => {
    setConversationArtboard("a", "og");
    setConversationArtboard("b", "story");
    expect(getConversationArtboard("a")).toMatchObject({
      id: "og",
      width: 1200,
      height: 630,
    });
    setConversationArtboard("a", null);
    expect(getConversationArtboard("a")).toBeNull();
    expect(getConversationArtboard("b")?.id).toBe("story");
  });

  it("persists under its own key", () => {
    setConversationArtboard("a", "square");
    const stored = JSON.parse(
      localStorage.getItem("open-builder-artboards") ?? "{}",
    );
    expect(stored.state.byConversation).toEqual({ a: "square" });
  });

  it("drops unknown persisted ids on load", () => {
    expect(
      parsePersistedArtboards({
        byConversation: { a: "og", b: "billboard", c: 4, d: null },
      }),
    ).toEqual({ a: "og" });
    expect(parsePersistedArtboards(undefined)).toEqual({});
    expect(parsePersistedArtboards({ byConversation: ["og"] })).toEqual({});
  });

  it("rehydrates through the same parser", async () => {
    localStorage.setItem(
      "open-builder-artboards",
      JSON.stringify({
        state: { byConversation: { a: "x-header", b: "gone" } },
        version: 1,
      }),
    );
    await useArtboardStore.persist.rehydrate();
    expect(useArtboardStore.getState().byConversation).toEqual({
      a: "x-header",
    });
  });
});
