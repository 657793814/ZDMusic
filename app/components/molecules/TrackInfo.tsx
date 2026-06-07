"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "@/app/lib/types";
import { DanmakuToggle, SpectrumBars } from "@/app/components/atoms";
import { useI18n } from "@/app/lib/i18n";

type Props = {
  track: Track | null;
  playing: boolean;
};

export function TrackInfo({ track, playing }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [needsMarquee, setNeedsMarquee] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) {
      setNeedsMarquee(false);
      return;
    }

    const check = () => {
      setNeedsMarquee(text.scrollWidth > container.clientWidth);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(container);
    return () => ro.disconnect();
  }, [track?.id, track?.title]);

  const hasTrack = !!track;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <div ref={containerRef} className="min-w-0 flex-1 overflow-hidden">
          <div className={needsMarquee ? "overflow-hidden" : ""}>
            <span
              ref={textRef}
              className={
                hasTrack
                  ? "text-base font-semibold tracking-[var(--tracking-label)] md:text-lg"
                  : "text-[13px] font-medium opacity-45"
              }
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-on-surface)",
                display: "inline-block",
                whiteSpace: needsMarquee ? "nowrap" : "normal",
                animation: needsMarquee ? "slide-up 8s linear infinite" : undefined,
              }}
            >
              {hasTrack ? track.title : t("noSignal")}
            </span>
          </div>
        </div>
        {hasTrack && (
          <span
            className="shrink-0 text-sm opacity-70"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {track.author}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[var(--tracking-label)]"
          style={{
            fontFamily: "var(--font-body)",
            backgroundColor: hasTrack && playing
              ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
              : "transparent",
            borderColor: hasTrack && playing ? "var(--color-primary)" : "var(--color-outline-dim)",
            color: hasTrack && playing ? "var(--color-primary)" : "var(--color-outline)",
            border: hasTrack && playing ? "1px solid" : "1px solid transparent",
            boxShadow: hasTrack && playing ? "0 0 8px color-mix(in srgb, var(--color-primary) 15%, transparent)" : "none",
          }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: hasTrack && playing ? "var(--color-success)" : "var(--color-outline)",
            }}
          />
          {playing ? t("playing") : t("paused")}
        </span>
        <SpectrumBars active={playing} muted={!hasTrack} />
        <DanmakuToggle />
      </div>
    </div>
  );
}
