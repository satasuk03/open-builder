import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { useT } from "../../i18n";
import { getProjectAssetBlob } from "../../lib/project-assets/core";
import type { ProjectImageAssetContent } from "../../lib/project-assets/tool-result";
import { useConversationStore } from "../../store/conversation";

export function ProjectImageResultCard({
  content,
}: {
  content: ProjectImageAssetContent;
}) {
  const t = useT();
  const blobRef = useConversationStore((state) => {
    const conversation = state.activeId
      ? state.conversations[state.activeId]
      : undefined;
    const asset = conversation?.assets?.[content.path];
    return asset?.digest === content.digest ? asset.blobRef : undefined;
  });
  const [thumbnail, setThumbnail] = useState<{
    blobRef: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!blobRef) return;
    let url: string | null = null;
    let cancelled = false;
    void getProjectAssetBlob(blobRef)
      .then((blob) => {
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setThumbnail({ blobRef, url });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [blobRef]);

  const thumbnailUrl =
    blobRef && thumbnail?.blobRef === blobRef ? thumbnail.url : null;
  const size =
    content.width && content.height
      ? `${content.width}×${content.height}`
      : null;

  return (
    <figure className="max-w-xs overflow-hidden rounded-lg border bg-card text-xs">
      {blobRef ? (
        <div className="flex aspect-video items-center justify-center bg-muted/50">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={t.imageResult.alt.replace("{path}", content.publicPath)}
              className="max-h-60 w-full object-contain"
            />
          ) : (
            <ImageIcon
              size={20}
              aria-hidden="true"
              className="text-muted-foreground"
            />
          )}
        </div>
      ) : null}
      <figcaption className="space-y-0.5 px-3 py-2">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <ImageIcon size={13} aria-hidden="true" />
          {t.imageResult.title}
        </div>
        <code className="block truncate font-mono text-muted-foreground">
          {content.publicPath}
        </code>
        <div className="text-muted-foreground">
          {blobRef
            ? [size, content.model].filter(Boolean).join(" · ")
            : t.imageResult.missing}
        </div>
      </figcaption>
    </figure>
  );
}
