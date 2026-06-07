"use client";

type SliderProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
};

export function Slider({ value, onChange, className }: SliderProps) {
  const safe = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.001}
      value={safe}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
      }}
      className={[
        "h-2 w-full appearance-none cursor-pointer bg-transparent",
        "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full",
        "[&::-webkit-slider-runnable-track]:bg-[color:var(--color-surface-overlay,#252529)]",
        "[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-0",
        "[&::-moz-range-track]:bg-[color:var(--color-surface-overlay,#252529)]",
        "[&::-webkit-slider-thumb]:-mt-[6px] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5",
        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0",
        "[&::-webkit-slider-thumb]:bg-[color:var(--color-primary)]",
        "[&::-webkit-slider-thumb]:shadow-[0_0_8px_color-mix(in_srgb,var(--color-primary)_50%,transparent)]",
        "[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0",
        "[&::-moz-range-thumb]:bg-[color:var(--color-primary)]",
        "[&::-moz-range-thumb]:shadow-[0_0_8px_color-mix(in_srgb,var(--color-primary)_50%,transparent)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface,#0a0a0b)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
