"use client";

import { useI18n } from "@/app/lib/i18n";

export function Logo({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <div className={["flex items-center gap-3", className].filter(Boolean).join(" ")}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="16" cy="16" r="15" fill="color-mix(in_srgb,var(--color-primary) 10%, transparent)" stroke="var(--color-primary)" strokeWidth="1.5" />
        <path d="M13 10.5V21.5L23 16L13 10.5Z" fill="var(--color-primary)" opacity="0.85" />
        <circle cx="10" cy="16" r="6" stroke="var(--color-primary)" strokeWidth="1.2" fill="none" opacity="0.4" />
      </svg>
      <span
        className="font-semibold tracking-[var(--tracking-label)] text-[color:var(--color-primary,#a78bfa)] md:text-[20px] text-[17px]"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {t("title")}
      </span>
    </div>
  );
}
