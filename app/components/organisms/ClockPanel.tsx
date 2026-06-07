"use client";

import { GlowDot } from "@/app/components/atoms/GlowDot";
import { Label } from "@/app/components/atoms/Label";
import { useClock } from "@/app/hooks/useClock";
import { useI18n } from "@/app/lib/i18n";
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
    <div
      className="scanline-overlay rounded-sm border p-5"
      style={{ borderColor: "var(--color-surface-container-high)" }}
    >
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <GlowDot color="error" />
          <Label size="sm">{t("liveFeed")}</Label>
          <Label size="sm" className="text-[color:var(--color-primary)]">
            {t("strmSync")}
          </Label>
        </div>

        <div className="text-center">
          <div
            aria-live="polite"
            className="time block tracking-[-0.02em]"
            style={{
              fontFamily: "var(--font-press-start-2p)",
              fontSize: "48px",
              lineHeight: "1.05",
              color: "var(--color-primary)",
            }}
          >
            {hours}
            <span className="colon-blink">:</span>
            {minutes}
          </div>
          {mounted && (
            <div
              className="mt-4 flex flex-wrap items-baseline justify-center gap-x-4 gap-y-2 md:justify-start"
              style={{ fontFamily: "var(--font-headline)", color: "var(--color-on-surface)" }}
            >
              <span className="text-sm uppercase opacity-92" style={{ letterSpacing: "0.2em" }}>
                {day}
              </span>
              <span className="text-sm opacity-78" style={{ fontFamily: "var(--font-body)" }}>
                {date}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
