"use client";

type GlowDotColor = "primary" | "error" | "success";

type GlowDotProps = {
  color?: GlowDotColor;
  size?: number;
  className?: string;
};

const colorMap: Record<GlowDotColor, string> = {
  primary: "var(--color-primary)",
  error: "var(--color-error)",
  success: "var(--color-success)",
};

export function GlowDot({ color = "primary", size = 8, className }: GlowDotProps) {
  return (
    <span
      role="presentation"
      className={["inline-block shrink-0 rounded-full", className].filter(Boolean).join(" ")}
      style={{
        width: size,
        height: size,
        backgroundColor: colorMap[color],
        transition: "opacity var(--dur-short) var(--ease-standard)",
      }}
    />
  );
}
