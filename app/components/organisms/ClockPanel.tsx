"use client";

import { GlowDot } from "@/app/components/atoms/GlowDot";
import { Label } from "@/app/components/atoms/Label";
import { useI18n } from "@/app/lib/i18n";
import { useClock } from "@/app/hooks/useClock";
import { useEffect, useState } from "react";

export function ClockPanel() {
  const { t } = useI18n();
  const locale = typeof document !== "undefined" ? document.documentElement.lang : "en-US";
  const { time, day, date } = useClock(locale);
  const [hours, minutes] = time.split(":");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center rounded-2xl md:min-h-0">
      <div
        className="flex h-full w-full flex-col items-center overflow-hidden rounded-2xl"
        style={{
          backgroundColor: "var(--color-surface-dim)",
          border: "1px solid var(--color-outline-dim)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
          paddingTop: "8px",
          paddingBottom: "8px",
          paddingLeft: "12px",
          paddingRight: "12px",
        }}
      >
        <div className="mb-1 flex items-center gap-2">
          <GlowDot color="primary" size={7} />
          <Label size="sm" className="text-[color:var(--color-primary)]">
            {t("strmSync")}
          </Label>
        </div>

        <div
          aria-live="polite"
          className="mt-2 block text-center tracking-[-0.02em] text-[color:var(--color-primary)]"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "48px",
            lineHeight: "1.05",
          }}
        >
          {hours}
          <span className="animate-[pulse_2s_ease-in-out_infinite] opacity-80">:</span>
          {minutes}
        </div>

        {mounted && (
          <div className="mt-2 flex items-center gap-x-4">
            <span
              className="text-sm font-medium"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-on-surface)" }}
            >
              {day}
            </span>
            <span
              className="text-sm opacity-70"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {date}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
