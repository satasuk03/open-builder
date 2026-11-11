import { useState, type FormEvent } from "react";
import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "../../i18n";
import { useSettingsStore } from "../../store/settings";

const OPENROUTER_KEYS_URL = "https://openrouter.ai/keys";

interface FirstRunWelcomeProps {
  onOpenSettings: () => void;
}

export function FirstRunWelcome({ onOpenSettings }: FirstRunWelcomeProps) {
  const t = useT();
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const apiKey = key.trim();
    if (!apiKey) return;
    const { ai, setAI } = useSettingsStore.getState();
    setAI({ ...ai, apiKey });
    setKey("");
    setSaved(true);
  };

  return (
    <section
      aria-labelledby="first-run-title"
      className="my-auto rounded-2xl border bg-card p-5 shadow-sm"
    >
      <h2
        id="first-run-title"
        className="font-display text-2xl leading-tight font-semibold text-balance"
      >
        {t.welcome.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">
        {t.welcome.desc}
      </p>
      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="first-run-api-key">{t.welcome.keyLabel}</Label>
          <div className="relative">
            <KeyRound
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="first-run-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-or-v1-…"
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
                setSaved(false);
              }}
              className="pl-9"
            />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={!key.trim()}>
          {t.welcome.save}
        </Button>
        {saved && (
          <p role="status" className="text-xs text-primary">
            {t.welcome.saved}
          </p>
        )}
      </form>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <ShieldCheck size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{t.welcome.privacy}</span>
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t pt-3 text-xs">
        <a
          href={OPENROUTER_KEYS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          {t.welcome.getKey}
          <ExternalLink size={12} aria-hidden="true" />
        </a>
        <button
          type="button"
          onClick={onOpenSettings}
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t.welcome.moreSettings}
        </button>
      </div>
    </section>
  );
}
