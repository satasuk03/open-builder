import { ChevronDown, Monitor } from "lucide-react";
import { useT } from "../../i18n";
import {
  ARTBOARD_PRESETS,
  artboardById,
  type ArtboardId,
} from "../../lib/artboard/presets";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

function sizeLabel(width: number, height: number) {
  return `${width}×${height}`;
}

/** A small outline drawn at the preset's real proportions. */
function AspectGlyph({
  width,
  height,
  box = 16,
  className,
}: {
  width: number;
  height: number;
  box?: number;
  className?: string;
}) {
  const scale = box / Math.max(width, height);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: box, height: box }}
    >
      <span
        className="block rounded-[2px] border-[1.5px] border-current"
        style={{
          width: Math.max(4, Math.round(width * scale)),
          height: Math.max(4, Math.round(height * scale)),
        }}
      />
    </span>
  );
}

export function ArtboardPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ArtboardId | null;
  onChange: (id: ArtboardId | null) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const labels = t.artboard;
  const active = artboardById(value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={
            active
              ? `${labels.label}: ${labels.presets[active.id]} ${sizeLabel(active.width, active.height)}`
              : labels.menuTitle
          }
          data-testid="artboard-picker"
          className={cn(
            "h-8 gap-2 rounded-lg border px-2.5",
            active
              ? "border-primary/30 bg-accent text-accent-foreground hover:bg-accent/80"
              : "border-border/70 text-muted-foreground hover:text-foreground",
          )}
        >
          {active ? (
            <AspectGlyph width={active.width} height={active.height} />
          ) : (
            <AspectGlyph width={1200} height={630} className="opacity-70" />
          )}
          {active ? (
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-[13px] font-semibold tracking-tight">
                {labels.presets[active.id]}
              </span>
              <span className="font-mono text-[10px] tabular-nums opacity-70">
                {sizeLabel(active.width, active.height)}
              </span>
            </span>
          ) : (
            <span className="text-xs font-medium">{labels.label}</span>
          )}
          <ChevronDown size={13} className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1.5">
        <DropdownMenuLabel className="px-2 pb-1 pt-1 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {labels.menuTitle}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={active?.id ?? ""}
          onValueChange={(next) => {
            const preset = artboardById(next);
            if (preset) onChange(preset.id);
          }}
        >
          {ARTBOARD_PRESETS.map((preset) => (
            <DropdownMenuRadioItem
              key={preset.id}
              value={preset.id}
              className="gap-3 py-2"
            >
              <AspectGlyph
                width={preset.width}
                height={preset.height}
                box={20}
                className={cn(
                  "text-muted-foreground",
                  active?.id === preset.id && "text-primary",
                )}
              />
              <span className="flex-1 truncate">
                {labels.presets[preset.id]}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {sizeLabel(preset.width, preset.height)}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-3 py-2 pl-8"
          disabled={!active}
          onSelect={() => onChange(null)}
        >
          <Monitor size={16} />
          <span className="flex flex-col">
            <span>{labels.responsive}</span>
            <span className="text-[11px] text-muted-foreground">
              {labels.responsiveHint}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
