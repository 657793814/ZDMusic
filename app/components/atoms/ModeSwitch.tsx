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
      className="flex rounded-full overflow-hidden"
      style={{
        border: "1px solid var(--color-outline-dim)",
        fontFamily: "var(--font-body)",
      }}
    >
      {MODES.map(({ key, label }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            onClick={() => setMode(key)}
            className="px-3.5 py-1 text-[11px] font-medium tracking-[var(--tracking-label)] transition-all duration-150 rounded-full"
            style={{
              backgroundColor: active
                ? "var(--color-primary)"
                : "transparent",
              color: active
                ? "var(--color-on-primary)"
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
