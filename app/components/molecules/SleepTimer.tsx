"use client";

import type { SleepTimerDuration } from "@/app/hooks/useSleepTimer";
import { useCallback, useState } from "react";

interface SleepTimerProps {
  active: boolean;
  remaining: number; // seconds
  onStart: (minutes: SleepTimerDuration) => void;
  onStop: () => void;
  onAdd: (minutes: number) => void;
}

const OPTIONS: { label: string; labelEn: string; minutes: SleepTimerDuration }[] = [
  { label: "15分钟", labelEn: "15 min", minutes: 15 },
  { label: "30分钟", labelEn: "30 min", minutes: 30 },
  { label: "45分钟", labelEn: "45 min", minutes: 45 },
  { label: "60分钟", labelEn: "60 min", minutes: 60 },
  { label: "90分钟", labelEn: "90 min", minutes: 90 },
];

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SleepTimer({ active, remaining, onStart, onStop, onAdd }: SleepTimerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" style={{ fontFamily: "var(--font-body)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] transition-colors hover:border-[color:var(--color-primary)]"
        style={{
          borderColor: active ? "var(--color-primary)" : "var(--color-outline-dim)",
          color: active ? "var(--color-primary)" : "var(--color-outline)",
          fontFamily: "var(--font-body)",
        }}
        title="睡眠定时"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="M12 6v6l4 2" />
        </svg>
        {active && remaining > 0 ? (
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatTime(remaining)}</span>
        ) : (
          "定时"
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute z-50 mt-2 w-48 rounded-2xl p-3"
            style={{
              top: "100%",
              right: 0,
              backgroundColor: "var(--color-surface-overlay)",
              border: "1px solid var(--color-outline-dim)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <p
              className="mb-2 text-[11px] font-semibold tracking-[var(--tracking-label)] opacity-50"
              style={{ fontFamily: "var(--font-body)" }}
            >
              睡眠定时
            </p>

            {active ? (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] text-center" style={{ color: "var(--color-primary)" }}>
                  剩余 {formatTime(remaining)}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onAdd(15)}
                    className="flex-1 rounded-full border px-2 py-1.5 text-[11px] transition-colors hover:border-[color:var(--color-primary)]"
                    style={{ borderColor: "var(--color-outline-dim)", color: "var(--color-outline)" }}
                  >
                    +15分
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdd(30)}
                    className="flex-1 rounded-full border px-2 py-1.5 text-[11px] transition-colors hover:border-[color:var(--color-primary)]"
                    style={{ borderColor: "var(--color-outline-dim)", color: "var(--color-outline)" }}
                  >
                    +30分
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { onStop(); setOpen(false); }}
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "var(--color-error)" }}
                >
                  取消定时
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => { onStart(opt.minutes); setOpen(false); }}
                    className="rounded-full px-3 py-1.5 text-[12px] text-left transition-colors hover:bg-white/5"
                    style={{ color: "var(--color-on-surface)" }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
