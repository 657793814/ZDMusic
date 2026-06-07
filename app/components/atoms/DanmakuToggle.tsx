"use client";

import { useDanmaku } from "@/app/context/DanmakuContext";
import { useI18n } from "@/app/lib/i18n";

export function DanmakuToggle() {
  const { enabled, hasDanmaku, hasBvidOrSearch, toggleDanmaku } = useDanmaku();
  const { t } = useI18n();
  const canToggle = hasDanmaku || hasBvidOrSearch;

  return (
    <div className="relative ml-auto">
      <button
        onClick={toggleDanmaku}
        disabled={!canToggle}
        title={canToggle ? undefined : t("danmakuUnavailable")}
        className="rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors disabled:cursor-not-allowed disabled:opacity-30"
        style={{
          fontFamily: "var(--font-headline), 'Space Grotesk', sans-serif",
          borderColor: enabled
            ? "var(--color-primary)"
            : hasDanmaku
              ? "var(--color-outline-variant)"
              : "var(--color-outline)",
          color: enabled ? "var(--color-primary)" : hasDanmaku ? "var(--color-outline)" : "var(--color-outline-variant)",
          boxShadow: enabled
            ? "0 0 8px rgba(111, 238, 225, 0.25)"
            : "none",
        }}
      >
        {t("danmaku")}
      </button>
    </div>
  );
}
