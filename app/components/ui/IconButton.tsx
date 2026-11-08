"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  size?: number;
  children: ReactNode;
};

export function IconButton({
  label,
  active = false,
  size = 34,
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-active={active ? "true" : "false"}
      className={`zd-icon-btn${className ? ` ${className}` : ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: size <= 30 ? "var(--zd-radius-sub)" : "var(--zd-radius-cover)",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
