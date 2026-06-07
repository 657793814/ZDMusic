"use client";

import { useMode, type AppMode } from "@/app/context/ModeContext";
import { useI18n } from "@/app/lib/i18n";

const MODES: { key: AppMode; label: string }[] = [
  { key: "local", label: "local" },
  { key: "cloud", label: "cloud" },
];

export function ModeSwitch() {
  const { mode, setMode } = useMode();
  const { t } = useI18n();

  return (
    <div
      className="flex overflow-hidden rounded-md border"
      style={{
        borderColor: "var(--color-outline-variant)",
        fontFamily: "var(--font-headline)",
      }}
    >
      {MODES.map(({ key, label }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            onClick={() => setMode(key)}
            className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors"
            style={{
              backgroundColor: active
                ? "color-mix(in srgb, var(--color-primary) 18%, transparent)"
                : "transparent",
              color: active
                ? "var(--color-primary)"
                : "var(--color-outline)",
            }}
          >
            {t(label as "local")}
          </button>
        );
      })}
    </div>
  );
}
