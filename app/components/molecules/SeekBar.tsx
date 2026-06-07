"use client";

import { useCallback, useRef } from "react";

type Props = {
  progress: number;
  duration: number;
  playing?: boolean;
  onSeek: (seconds: number) => void;
};

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SeekBar({ progress, duration, playing = false, onSeek }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const d = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const pct = d > 0 ? Math.min(100, Math.max(0, (progress / d) * 100)) : 0;

  const scrub = useCallback(
    (clientX: number) => {
      const el = barRef.current;
      if (!el || d <= 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
      onSeek(Math.max(0, Math.min(ratio, 1)) * d);
    },
    [d, onSeek]
  );

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    scrub(e.clientX);
    const mm = (ev: MouseEvent) => scrub(ev.clientX);
    const up = () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (d <= 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onSeek(Math.min(d, progress + 5));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSeek(Math.max(0, progress - 5));
    }
  };

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px] font-medium tracking-[var(--tracking-label)]"
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--color-outline)",
        }}>
        <span>{fmt(progress)}</span>
        <span>{fmt(duration)}</span>
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={Math.round(d)}
        aria-valuenow={Math.round(progress)}
        ref={barRef}
        className="relative h-1 w-full cursor-pointer overflow-visible rounded-full bg-[var(--color-surface-overlay)]"
        onMouseDown={onMouseDown}
        onKeyDown={onKeyDown}
      >
        <div
          className="h-1 rounded-full transition-[width] duration-75"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--color-primary-dim), var(--color-primary))",
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${pct}%`,
            transform: "translate(-50%, calc(-50% - 2px))",
          }}
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="var(--color-primary)"
              style={{
                filter: "drop-shadow(0 0 4px color-mix(in srgb, var(--color-primary) 60%, transparent))",
              }}
            />
            <circle cx="10" cy="10" r="5" fill="var(--color-surface-raised)" />
          </svg>
        </div>
      </div>
    </div>
  );
}
