"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
};

export function Chip({ active = false, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      data-active={active ? "true" : "false"}
      className={`zd-chip${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}
