import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  artboardById,
  type ArtboardId,
  type ArtboardPreset,
} from "../lib/artboard/presets";

interface ArtboardState {
  /** Conversation id to preset id. A missing entry means the responsive preview. */
  byConversation: Record<string, ArtboardId>;
}

type PersistedArtboardState = Partial<ArtboardState> | undefined;

export function parsePersistedArtboards(
  persisted: unknown,
): Record<string, ArtboardId> {
  const raw = (persisted as PersistedArtboardState)?.byConversation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const parsed: Record<string, ArtboardId> = {};
  for (const [conversationId, id] of Object.entries(raw)) {
    const preset = artboardById(id);
    if (preset) parsed[conversationId] = preset.id;
  }
  return parsed;
}

export const useArtboardStore = create<ArtboardState>()(
  persist((): ArtboardState => ({ byConversation: {} }), {
    name: "open-builder-artboards",
    version: 1,
    storage: createJSONStorage(() => localStorage),
    merge: (persisted, current) => ({
      ...current,
      byConversation: parsePersistedArtboards(persisted),
    }),
  }),
);

export function setConversationArtboard(
  conversationId: string,
  id: ArtboardId | null,
): void {
  useArtboardStore.setState((state) => {
    const byConversation = { ...state.byConversation };
    if (id === null) delete byConversation[conversationId];
    else byConversation[conversationId] = id;
    return { byConversation };
  });
}

export function getConversationArtboard(
  conversationId: string,
): ArtboardPreset | null {
  return artboardById(
    useArtboardStore.getState().byConversation[conversationId],
  );
}

export function useConversationArtboard(
  conversationId: string | null | undefined,
): ArtboardPreset | null {
  return artboardById(
    useArtboardStore((state) =>
      conversationId ? state.byConversation[conversationId] : undefined,
    ),
  );
}
