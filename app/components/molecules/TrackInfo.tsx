"use client";

import { useRef } from "react";
import type { Track } from "@/app/lib/types";
import { DanmakuToggle } from "@/app/components/atoms";
import { useI18n } from "@/app/lib/i18n";

type Props = {
  track: Track | null;
  playing: boolean;
};

export function TrackInfo({ track, playing }: Props) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const hasTrack = !!track;

  const containerWidth = containerRef.current?.clientWidth ?? 0;
  const totalWidth = containerWidth + (textRef.current?.scrollWidth ?? 0);
  const gap = 12; // gap between title and author
  const dur = Math.max(10, (totalWidth + gap) / 60);
  const pauseDur = Math.max(0, 5 - dur);
  const pausePct = (pauseDur / (dur + pauseDur)) * 100;
  const animName = pauseDur > 0
    ? `marquee-with-pause ${dur + pauseDur}s linear infinite`
    : "marquee 8s linear infinite";

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={containerRef}
        className="relative h-[1.1rem] overflow-hidden md:h-[1.35rem]"
        style={pauseDur > 0 ? { "--pause-pct": `${pausePct}%` } as React.CSSProperties : undefined}
      >
        <span
          ref={textRef}
          className="text-base font-semibold tracking-[var(--tracking-label)] md:text-lg"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--color-on-surface)",
            whiteSpace: "nowrap",
            display: "inline-block",
            animation: animName,
          }}
        >
          {hasTrack ? track.title : t("noSignal")}
          {hasTrack && (
            <span
              style={{ marginLeft: "0.75rem", fontWeight: 400, fontSize: "0.875rem", opacity: 0.7 }}
            >
              — {track.author}
            </span>
          )}
        </span>
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
        <DanmakuToggle />
      </div>
    </div>
  );
}
