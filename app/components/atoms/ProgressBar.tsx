"use client";

type ProgressBarProps = {
  value: number;
  className?: string;
};

export function ProgressBar({ value, className }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const pct = clamped * 100;

  return (
    <div
      className={[
        "relative h-1 w-full overflow-visible rounded-full",
        "bg-[color:var(--color-surface-overlay,#252529)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--color-primary-dim), var(--color-primary))",
        }}
      />
      <div
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--color-primary)]"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
