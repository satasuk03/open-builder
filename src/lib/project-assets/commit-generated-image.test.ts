// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const blobs = vi.hoisted(() => new Map<string, Map<string, unknown>>());

vi.mock("localforage", () => {
  const instance = (storeName: string) => {
    const store = blobs.get(storeName) ?? new Map<string, unknown>();
    blobs.set(storeName, store);
    return {
      getItem: async <T>(key: string) => (store.get(key) as T) ?? null,
      setItem: async (key: string, value: unknown) => {
        store.set(key, value);
        return value;
      },
      removeItem: async (key: string) => store.delete(key),
      clear: async () => store.clear(),
      iterate: async <T>(iterator: (value: T, key: string) => void) => {
        for (const [key, value] of store) iterator(value as T, key);
      },
    };
  };
  return {
    default: {
      ...instance("root"),
      createInstance: ({ storeName = "default" }: { storeName?: string }) =>
        instance(storeName),
    },
  };
});

import { useConversationStore } from "../../store/conversation";
import { useProjectTemplateStore } from "../../store/project-templates";
import { useSnapshotStore } from "../../store/snapshot";
import {
  commitGeneratedImage,
  nextFreeGeneratedImagePath,
} from "./commit-generated-image";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2,
]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]);

function attachmentCount(): number {
  return blobs.get("attachments")?.size ?? 0;
}

function initializedConversation(): string {
  const id = useConversationStore.getState().createConversation();
  useConversationStore.getState().setFiles({ "index.html": "<html></html>" });
  return id;
}

describe("commitGeneratedImage", () => {
  beforeEach(() => {
    for (const store of blobs.values()) store.clear();
    useConversationStore.setState({
      conversations: {},
      activeId: null,
      _hasHydrated: true,
      legacyPlanModeMigrated: false,
    });
    useSnapshotStore.setState({ snapshots: {}, _hasHydrated: true });
    useProjectTemplateStore.setState({ templates: {}, _hasHydrated: true });
  });

  it("names the file from the bytes, not from what the service declared", async () => {
    const conversationId = initializedConversation();

    const result = await commitGeneratedImage({
      conversationId,
      bytes: JPEG,
      stem: "hero",
    });

    const conversation =
      useConversationStore.getState().conversations[conversationId];
    expect(result.asset.path).toBe("public/generated/hero.jpg");
    expect(result.asset.mimeType).toBe("image/jpeg");
    expect(result.publicPath).toBe("/generated/hero.jpg");
    expect(conversation.assets?.["public/generated/hero.jpg"]).toEqual(
      result.asset,
    );
    expect(conversation.files[result.modulePath]).toContain(
      'export default "/generated/hero.jpg"',
    );
    expect(attachmentCount()).toBe(0);
  });

  it("never replaces an existing image and suffixes the name instead", async () => {
    const conversationId = initializedConversation();

    await commitGeneratedImage({ conversationId, bytes: PNG, stem: "hero" });
    const second = await commitGeneratedImage({
      conversationId,
      bytes: PNG,
      stem: "hero",
    });

    expect(second.asset.path).toBe("public/generated/hero-2.png");
    expect(
      Object.keys(
        useConversationStore.getState().conversations[conversationId].assets ??
          {},
      ).sort(),
    ).toEqual(["public/generated/hero-2.png", "public/generated/hero.png"]);
  });

  it("removes the temporary attachment when the import fails", async () => {
    const conversationId = useConversationStore.getState().createConversation();

    await expect(
      commitGeneratedImage({ conversationId, bytes: PNG, stem: "hero" }),
    ).rejects.toThrow(/Initialize the project/);
    expect(attachmentCount()).toBe(0);
  });

  it("rejects bytes that are not a supported image", async () => {
    const conversationId = initializedConversation();
    await expect(
      commitGeneratedImage({
        conversationId,
        bytes: new TextEncoder().encode("<svg></svg>"),
        stem: "logo",
      }),
    ).rejects.toThrow(/unsupported image format/);
    expect(attachmentCount()).toBe(0);
  });
});

describe("nextFreeGeneratedImagePath", () => {
  it("skips paths taken by files or assets", () => {
    expect(
      nextFreeGeneratedImagePath(
        {
          files: { "public/generated/a.png": "x" },
          assets: {
            "public/generated/a-2.png": {} as never,
          },
        },
        "a",
        "png",
      ),
    ).toBe("public/generated/a-3.png");
  });
});
