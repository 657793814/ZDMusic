"use client";

import { useEffect, type ReactNode } from "react";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right" | "bottom";
  label: string;
  children: ReactNode;
};

export function Sheet({ open, onClose, side = "right", label, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="zd-sheet-backdrop" onClick={onClose} aria-hidden />
      <div
        className="zd-sheet glass-drawer"
        data-side={side}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </>
  );
}
