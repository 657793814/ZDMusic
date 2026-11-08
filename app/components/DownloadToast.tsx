"use client";

import { useDownload } from "@/app/context/DownloadContext";
import { DownloadIcon } from "@/app/components/ui/icons";

export function DownloadToast() {
  const { status } = useDownload();
  if (!status.visible) return null;

  const ratio = status.total > 0 ? status.done / status.total : 0;

  return (
    <div
      className="zd-download-toast glass-popover"
      data-tone={status.tone}
      role="status"
      aria-live="polite"
    >
      <span className="zd-download-icon">
        <DownloadIcon size={14} />
      </span>
      <div className="zd-download-body">
        <span className="zd-download-message">{status.message}</span>
        {status.total > 1 || status.tone === "info" ? (
          <span className="zd-download-track">
            <span style={{ width: `${Math.round(ratio * 100)}%` }} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
