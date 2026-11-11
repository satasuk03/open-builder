import { deleteAttachment, storeAttachmentBlob } from "../attachments/store";
import { useConversationStore } from "../../store/conversation";
import type {
  ProjectAssetMimeType,
  ProjectAssets,
  ProjectFiles,
} from "../../types";
import { detectProjectAssetMimeType } from "./core";
import {
  importGeneratedImageAsset,
  type ImportGeneratedImageAssetResult,
} from "./import";

const GENERATED_IMAGE_EXTENSIONS: Partial<
  Record<ProjectAssetMimeType, string>
> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const MAX_NAME_SUFFIX = 50;

export function nextFreeGeneratedImagePath(
  conversation: { files: ProjectFiles; assets?: ProjectAssets },
  stem: string,
  extension: string,
): string {
  for (let n = 1; n <= MAX_NAME_SUFFIX; n += 1) {
    const path = `public/generated/${n === 1 ? stem : `${stem}-${n}`}.${extension}`;
    if (conversation.files[path] === undefined && !conversation.assets?.[path])
      return path;
  }
  throw new Error(
    `Too many generated images named "${stem}". Pick a different name.`,
  );
}

export interface CommitGeneratedImageInput {
  conversationId: string;
  bytes: Uint8Array;
  /** Lower-case file stem such as "hero-matcha". */
  stem: string;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
}

/**
 * Adds generated image bytes to the project as public/generated/<stem>.<ext>,
 * never replacing an existing path. The extension comes from the bytes
 * because stageProjectAsset rejects an extension that does not match them.
 */
export async function commitGeneratedImage(
  input: CommitGeneratedImageInput,
): Promise<ImportGeneratedImageAssetResult> {
  const mimeType = detectProjectAssetMimeType(input.bytes);
  const extension = mimeType && GENERATED_IMAGE_EXTENSIONS[mimeType];
  if (!mimeType || !extension) {
    throw new Error("The image service returned an unsupported image format.");
  }
  const conversation =
    useConversationStore.getState().conversations[input.conversationId];
  if (!conversation) throw new Error("The target conversation does not exist.");
  const path = nextFreeGeneratedImagePath(conversation, input.stem, extension);

  // importGeneratedImageAsset reads from the attachment store, so the bytes
  // pass through a temporary attachment that is always removed afterwards.
  const attachment = await storeAttachmentBlob(
    new Blob([Uint8Array.from(input.bytes).buffer], { type: mimeType }),
    "image",
    path.slice(path.lastIndexOf("/") + 1),
    { createPreviewUrl: false },
  );
  try {
    return await importGeneratedImageAsset({
      conversationId: input.conversationId,
      imageId: attachment.id,
      mimeType,
      name: attachment.name,
      path,
      signal: input.signal,
      isCurrent: input.isCurrent,
    });
  } finally {
    await deleteAttachment(attachment.id).catch((error: unknown) => {
      console.warn("Failed to delete a temporary generated image:", error);
    });
  }
}
