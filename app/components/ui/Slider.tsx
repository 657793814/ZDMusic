"use client";

import type { CSSProperties } from "react";

type SliderProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  className,
}: SliderProps) {
  const span = max - min;
  const pct = span > 0 ? ((value - min) / span) * 100 : 0;

  return (
    <input
      type="range"
      aria-label={label}
      className={`zd-slider${className ? ` ${className}` : ""}`}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ "--fill": `${Math.max(0, Math.min(100, pct))}%` } as CSSProperties}
    />
  );
}
