"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/lib/i18n";

type Props = {
  volume: number;
  onChange: (value: number) => void;
};

export function VolumeControl({ volume, onChange }: Props) {
  const { t } = useI18n();
  const v = Number.isFinite(volume) ? volume : 0;
  const pct = Math.round(v * 100);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  return (
    <div className="flex items-center gap-2.5 max-w-[180px]">
      <span className="shrink-0 text-[color:var(--color-outline)]" aria-hidden>
        {v <= 0.001 ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11 5L6 9H4a1 1 0 00-1 1v4a1 1 0 001 1h2l5 4V5z" strokeLinejoin="miter" />
            <path d="M18 18l6-6M18 12l6 6" strokeLinecap="square" />
          </svg>
        ) : v < 0.5 ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11 5L6 9H4a1 1 0 00-1 1v4a1 1 0 001 1h2l5 4V5z" strokeLinecap="square" />
            <path d="M15 10a3.5 3.5 0 010 4" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11 5L6 9H4a1 1 0 00-1 1v4a1 1 0 001 1h2l5 4V5z" strokeLinecap="square" />
            <path d="M15 9a5 5 0 010 6" strokeLinecap="round" />
            <path d="M18.5 6.5a8.5 8.5 0 010 11" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <label className="sr-only" htmlFor="aura-volume">
        {t("volume")}
      </label>
      <div className="relative flex flex-1 items-center" style={{ height: "18px" }}>
        <div
          className="pointer-events-none absolute left-0 right-0 overflow-hidden rounded-full"
          style={{
            height: "4px",
            backgroundColor: "var(--color-surface-overlay)",
          }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(to right, var(--color-primary-dim), var(--color-primary))",
            }}
          />
        </div>
        <input
          id="aura-volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={v}
          onChange={onInput}
          className={[
            "relative z-[1] w-full cursor-pointer appearance-none bg-transparent",
            "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0",
            "[&::-webkit-slider-thumb]:bg-[color:var(--color-primary)]",
            "[&::-webkit-slider-thumb]:shadow-[0_0_8px_color-mix(in_srgb,var(--color-primary)_50%,transparent)]",
            "[&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-4",
            "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0",
            "[&::-moz-range-thumb]:bg-[color:var(--color-primary)]",
            "[&::-moz-range-thumb]:shadow-[0_0_8px_color-mix(in_srgb,var(--color-primary)_50%,transparent)]",
            "[&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-4 [&::-moz-range-track]:border-0",
            "focus-visible:outline-none",
          ].join(" ")}
          style={{ height: "18px" }}
        />
      </div>
    </div>
  );
}
