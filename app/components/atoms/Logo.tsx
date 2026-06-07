"use client";

import Image from "next/image";
import { useI18n } from "@/app/lib/i18n";

export function Logo({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <div className={["flex items-center gap-3", className].filter(Boolean).join(" ")}>
      <Image
        src="/aura_logo_1.png"
        alt={t("title")}
        width={138}
        height={41}
        className="h-7 w-auto md:h-8"
        priority
      />
      <span className="font-['Caveat',var(--font-caveat),cursive] text-[20px] font-semibold tracking-[0.02em] text-[color:var(--color-primary,#6feee1)] md:text-[24px]">
        {t("title")}
      </span>
    </div>
  );
}
