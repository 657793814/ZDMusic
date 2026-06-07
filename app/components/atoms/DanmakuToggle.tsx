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
        className="rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[var(--tracking-label)] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-30"
        style={{
          fontFamily: "var(--font-body)",
          backgroundColor: enabled
            ? "color-mix(in srgb, var(--color-primary) 15%, transparent)"
            : "transparent",
          color: enabled ? "var(--color-primary)" : "var(--color-outline)",
          border: enabled
            ? `1px solid var(--color-primary)`
            : "1px solid transparent",
        }}
      >
        {t("danmaku")}
      </button>
    </div>
  );
}
