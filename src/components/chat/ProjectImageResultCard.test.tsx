// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProjectAssetBlob: vi.fn(
    async (): Promise<Blob | null> => new Blob(["png"], { type: "image/png" }),
  ),
}));

vi.mock("../../lib/project-assets/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/project-assets/core")>()),
  getProjectAssetBlob: mocks.getProjectAssetBlob,
}));
vi.mock("./ToolCallCard", () => ({
  ToolCallCard: () => <div data-testid="generic-tool-card" />,
}));

import { useConversationStore } from "../../store/conversation";
import { useInteractiveStore } from "../../store/interactive";
import { useSettingsStore } from "../../store/settings";
import type { Conversation, MergedMessage, ToolBlock } from "../../types";
import { MessageBubble } from "./MessageBubble";

const content = {
  kind: "project_image_asset_v1",
  path: "public/generated/hero.png",
  publicPath: "/generated/hero.png",
  modulePath: "src/generated-assets/hero-abc.js",
  mimeType: "image/png",
  size: 3,
  digest: "abc",
  width: 1344,
  height: 768,
  model: "google/gemini-3.1-flash-image",
};

function message(overrides: Partial<ToolBlock> = {}): MergedMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    blocks: [
      {
        id: "tool-1",
        type: "tool",
        toolName: "generate_image",
        title: "Generate Image",
        path: "",
        result: "{}",
        toolCallId: "call-1",
        toolOutput: { text: "{}", structuredContent: content },
        ...overrides,
      },
    ],
  };
}

function setAssets(assets: Conversation["assets"]) {
  useConversationStore.setState({
    activeId: "c1",
    conversations: {
      c1: {
        id: "c1",
        title: "Banner",
        messages: [],
        files: {},
        assets,
        template: "static",
        isProjectInitialized: true,
        createdAt: 0,
        updatedAt: 0,
      },
    },
  });
}

describe("ProjectImageResultCard", () => {
  beforeEach(() => {
    mocks.getProjectAssetBlob.mockClear();
    useInteractiveStore.setState({ pending: [] });
    useSettingsStore.setState((state) => ({
      system: { ...state.system, language: "en" },
    }));
    URL.createObjectURL = vi.fn(() => "blob:thumbnail");
    URL.revokeObjectURL = vi.fn();
  });

  it("shows a thumbnail of the project asset with its path and size", async () => {
    setAssets({
      "public/generated/hero.png": {
        path: "public/generated/hero.png",
        blobRef: "sha256:abc",
        mimeType: "image/png",
        size: 3,
        digest: "abc",
        modulePath: content.modulePath,
        publicPath: content.publicPath,
      },
    });

    render(<MessageBubble message={message()} />);

    const image = await screen.findByRole("img", {
      name: "Generated image /generated/hero.png",
    });
    expect(image).toHaveAttribute("src", "blob:thumbnail");
    expect(mocks.getProjectAssetBlob).toHaveBeenCalledWith("sha256:abc");
    expect(screen.getByText("/generated/hero.png")).toBeInTheDocument();
    expect(
      screen.getByText("1344×768 · google/gemini-3.1-flash-image"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("generic-tool-card")).not.toBeInTheDocument();
  });

  it("says when the image is no longer in the project", () => {
    setAssets({});

    render(<MessageBubble message={message()} />);

    expect(screen.getByText("No longer in the project")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("leaves running and failed calls to the generic tool card", () => {
    setAssets({});

    render(
      <MessageBubble
        message={message({
          result: "Error: insufficient credits",
          toolOutput: { text: "Error: insufficient credits", isError: true },
        })}
      />,
    );

    expect(screen.getByTestId("generic-tool-card")).toBeInTheDocument();
  });
});
