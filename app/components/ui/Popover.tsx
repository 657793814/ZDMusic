"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type PopoverProps = {
  trigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  label?: string;
};

export function Popover({ trigger, children, align = "end", label }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className="zd-popover glass-popover"
          role="dialog"
          aria-label={label}
          style={{
            bottom: "calc(100% + 10px)",
            right: align === "end" ? 0 : undefined,
            left: align === "start" ? 0 : undefined,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
