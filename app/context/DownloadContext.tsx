"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type DownloadTone = "info" | "success" | "error";

type DownloadStatus = {
  visible: boolean;
  done: number;
  total: number;
  tone: DownloadTone;
  message: string;
};

const IDLE: DownloadStatus = {
  visible: false,
  done: 0,
  total: 0,
  tone: "info",
  message: "",
};

type DownloadContextValue = {
  status: DownloadStatus;
  download: (trackIds: string[], label?: string) => Promise<void>;
};

const DownloadContext = createContext<DownloadContextValue | null>(null);

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DownloadStatus>(IDLE);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const download = useCallback(async (trackIds: string[], label?: string) => {
    if (!trackIds.length || busyRef.current) return;

    busyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);

    const total = trackIds.length;
    const title = label ? `《${label}》` : "";
    setStatus({
      visible: true,
      done: 0,
      total,
      tone: "info",
      message: `正在下载${title} 0/${total}`,
    });

    let ok = 0;
    let dir = "";
    const errors: string[] = [];

    for (let index = 0; index < trackIds.length; index += 1) {
      try {
        const res = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId: trackIds[index] }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          dir?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        ok += 1;
        if (data.dir) dir = data.dir;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }

      setStatus({
        visible: true,
        done: index + 1,
        total,
        tone: "info",
        message: `正在下载${title} ${index + 1}/${total}`,
      });
    }

    busyRef.current = false;

    if (ok > 0 && errors.length === 0) {
      setStatus({
        visible: true,
        done: total,
        total,
        tone: "success",
        message: `已保存 ${ok} 首到 ${dir || "下载目录"}`,
      });
    } else if (ok > 0) {
      setStatus({
        visible: true,
        done: total,
        total,
        tone: "info",
        message: `已保存 ${ok} 首，${errors.length} 首失败：${errors[0]}`,
      });
    } else {
      setStatus({
        visible: true,
        done: total,
        total,
        tone: "error",
        message: `下载失败：${errors[0] || "未知错误"}`,
      });
    }

    timerRef.current = setTimeout(() => setStatus(IDLE), 5000);
  }, []);

  return (
    <DownloadContext.Provider value={{ status, download }}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error("useDownload must be used within DownloadProvider");
  }
  return context;
}
