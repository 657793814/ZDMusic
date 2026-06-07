"use client";

import { GlowDot } from "@/app/components/atoms/GlowDot";
import { Label } from "@/app/components/atoms/Label";
import { useI18n } from "@/app/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";

export function StatusBar() {
  const { t } = useI18n();
  const [memUsed, setMemUsed] = useState("—");
  const [memTotal, setMemTotal] = useState("—");
  const [cpuLoad, setCpuLoad] = useState("—");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/system/stats")
      .then((r) => r.json())
      .then((data) => {
        setMemUsed(data.mem.usedGB + "GB");
        setMemTotal(data.mem.totalGB + "GB");
        setCpuLoad(data.cpu.percent + "%");
      })
      .catch(() => {/* ignore */});
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  return (
    <footer
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-4 py-2 md:px-6"
      style={{
        borderColor: "var(--color-outline-variant)",
        backgroundColor: "var(--color-surface-container-low)",
      }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-2">
          <GlowDot color="primary" size={7} />
          <Label size="sm" className="text-[color:var(--color-primary)]">
            {t("systemOnline")}
          </Label>
        </span>
        <Label size="sm" className="text-[color:var(--color-outline)]">
          {t("mem")} {memUsed} / {memTotal}
        </Label>
        <Label size="sm" className="text-[color:var(--color-outline)]">
          {t("cpuLoad")} {cpuLoad}
        </Label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
        <Label size="sm" className="text-[color:var(--color-outline)]">
          {t("packetLoss")} 0.00%
        </Label>
        <Label size="sm" className="text-[color:var(--color-outline)]">
          {t("syncStatus")} VERIFIED
        </Label>
        <Label size="sm" className="text-[color:var(--color-on-surface)]">
          {t("nodeVersion")} 1.0.4-BETA
        </Label>
      </div>
    </footer>
  );
}
