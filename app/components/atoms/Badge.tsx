"use client";

type BadgeVariant = "primary" | "error" | "default";

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  className?: string;
};

const variantStyles: Record<BadgeVariant, string> = {
  primary:
    "bg-[color-mix(in_srgb,var(--color-primary,#a78bfa)_12%,transparent)] text-[color:var(--color-primary,#a78bfa)]",
  error:
    "bg-[color-mix(in_srgb,var(--color-error,#f87171)_12%,transparent)] text-[color:var(--color-error,#f87171)]",
  default:
    "text-[color:var(--color-on-surface,#e8e8e8)] bg-[color:var(--color-surface-overlay,#252529)]",
};

export function Badge({ label, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5",
        "text-[12px] font-medium tracking-[var(--tracking-label)]",
        variantStyles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </span>
  );
}
