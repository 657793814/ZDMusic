"use client";

import { useCallback, useEffect, useState } from "react";

/* ─── Types ─── */

interface DownloadItem {
  id: string;
  filename: string;
  status: "downloading" | "completed" | "failed";
  progress: number; // 0–100
  startedAt: number;
  completedAt?: number;
  error?: string;
}

/* ─── Styles ─── */

const overlayBase: React.CSSProperties = {
  position: "fixed",
  bottom: 80,
  right: 20,
  zIndex: 100,
  width: 360,
  maxHeight: "calc(100dvh - 140px)",
  display: "flex",
  flexDirection: "column",
  borderRadius: 16,
  backgroundColor: "var(--color-surface-overlay, #252529)",
  border: "1px solid var(--color-outline-dim, #2a2a2e)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
  overflow: "hidden",
  fontFamily: "var(--font-body)",
};

const toggleBtnStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 20,
  right: 20,
  zIndex: 99,
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: "1px solid var(--color-outline-dim, #2a2a2e)",
  backgroundColor: "var(--color-surface-overlay, #252529)",
  color: "var(--color-on-surface, #e8e6e7)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  borderBottom: "1px solid var(--color-outline-dim, #2a2a2e)",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: "var(--color-on-surface, #e8e6e7)",
};

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "4px 0",
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "10px 14px",
  borderBottom: "1px solid var(--color-outline-dim, #2a2a2e)",
};

const filenameStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--color-on-surface, #e8e6e7)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const progressTrackStyle: React.CSSProperties = {
  width: "100%",
  height: 4,
  borderRadius: 9999,
  backgroundColor: "var(--color-outline-dim, #2a2a2e)",
  overflow: "hidden",
};

const statusRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const statusTextStyle = (status: string): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 500,
  color:
    status === "completed"
      ? "var(--color-success, #4ade80)"
      : status === "failed"
        ? "var(--color-error, #f87171)"
        : "var(--color-primary, #a78bfa)",
});

const emptyStyle: React.CSSProperties = {
  padding: "24px 14px",
  textAlign: "center",
  fontSize: 12,
  color: "var(--color-outline, #6e6e72)",
};

const badgeStyle: React.CSSProperties = {
  position: "absolute",
  top: -4,
  right: -4,
  minWidth: 18,
  height: 18,
  borderRadius: 9999,
  backgroundColor: "var(--color-primary, #a78bfa)",
  color: "var(--color-on-primary, #0a0a0b)",
  fontSize: 10,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 4px",
  lineHeight: 1,
};

const smallBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 500,
  padding: "2px 8px",
  borderRadius: 8,
  transition: "background-color 0.15s",
};

/* ─── Helpers ─── */

const STORAGE_KEY = "zdmusic-downloads";

function loadDownloads(): DownloadItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DownloadItem[];
  } catch {}
  return [];
}

function saveDownloads(items: DownloadItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

/* ─── Component ─── */

export function DownloadManager() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DownloadItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    setItems(loadDownloads());
  }, []);

  // Persist on change
  const updateItems = useCallback((next: DownloadItem[]) => {
    setItems(next);
    saveDownloads(next);
  }, []);

  // Active (non-completed) download count
  const activeCount = items.filter(
    (d) => d.status === "downloading"
  ).length;

  // Completed items (last 10)
  const completedItems = items
    .filter((d) => d.status === "completed")
    .slice(-10)
    .reverse();

  // Failed items
  const failedItems = items.filter((d) => d.status === "failed");

  // Items to show in the panel: active first, then recent completed, then failed
  const displayItems = [
    ...items.filter((d) => d.status === "downloading"),
    ...completedItems,
    ...failedItems,
  ];

  // Retry a failed download — reset to "downloading" with 0 progress
  const retry = useCallback(
    (id: string) => {
      const next = items.map((d) =>
        d.id === id
          ? { ...d, status: "downloading" as const, progress: 0, error: undefined }
          : d
      );
      updateItems(next);
    },
    [items, updateItems]
  );

  // Clear all history
  const clearAll = useCallback(() => {
    updateItems([]);
  }, [updateItems]);

  // Helper to format a timestamp
  const fmtTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={toggleBtnStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1)";
          e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
        }}
        aria-label="下载管理"
        title="下载管理"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="M8 11l4 4 4-4" />
          <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        {activeCount > 0 && (
          <span style={badgeStyle}>{activeCount}</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={overlayBase}>
          {/* Header */}
          <div style={headerStyle}>
            <span>
              📥 下载管理
              {activeCount > 0 && (
                <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6, marginLeft: 6 }}>
                  ({activeCount} 进行中)
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  style={{
                    ...smallBtnStyle,
                    color: "var(--color-error, #f87171)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  清空
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  ...smallBtnStyle,
                  color: "var(--color-outline, #6e6e72)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* List */}
          <div style={listStyle}>
            {displayItems.length === 0 ? (
              <div style={emptyStyle}>暂无下载记录</div>
            ) : (
              displayItems.map((item) => {
                const isActive = item.status === "downloading";
                const isFailed = item.status === "failed";
                const barColor = isFailed
                  ? "var(--color-error, #f87171)"
                  : "var(--color-primary, #a78bfa)";

                return (
                  <div key={item.id} style={itemStyle}>
                    <div style={filenameStyle} title={item.filename}>
                      {item.filename}
                    </div>

                    {/* Progress bar */}
                    <div style={progressTrackStyle}>
                      <div
                        style={{
                          height: "100%",
                          width: `${isActive || isFailed ? item.progress : 100}%`,
                          maxWidth: "100%",
                          borderRadius: 9999,
                          background:
                            isActive
                              ? `linear-gradient(90deg, var(--color-primary-dim, #8b6cf0), ${barColor})`
                              : barColor,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>

                    {/* Status row */}
                    <div style={statusRowStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {/* Status indicator dot */}
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor:
                              isActive
                                ? "var(--color-primary, #a78bfa)"
                                : isFailed
                                  ? "var(--color-error, #f87171)"
                                  : "var(--color-success, #4ade80)",
                            animation: isActive ? "pulse 1.5s infinite" : "none",
                          }}
                        />
                        <span style={statusTextStyle(item.status)}>
                          {isActive
                            ? "下载中"
                            : isFailed
                              ? `失败${item.error ? `: ${item.error}` : ""}`
                              : `已完成 ${fmtTime(item.completedAt || item.startedAt)}`}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--color-outline, #6e6e72)" }}>
                          {item.progress}%
                        </span>
                      </div>

                      {/* Actions */}
                      {isFailed && (
                        <button
                          type="button"
                          onClick={() => retry(item.id)}
                          style={{
                            ...smallBtnStyle,
                            color: "var(--color-primary, #a78bfa)",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(167,139,250,0.1)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          重试
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Pulse animation keyframes injected once */}
      {typeof document !== "undefined" && !document.getElementById("zd-dl-pulse") && (() => {
        const style = document.createElement("style");
        style.id = "zd-dl-pulse";
        style.textContent = `
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `;
        document.head.appendChild(style);
        return null;
      })()}
    </>
  );
}
