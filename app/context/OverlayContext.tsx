"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type OverlayId =
  | "search"
  | "queue"
  | "settings"
  | "assistant"
  | "library"
  | "lyrics"
  | "recognizer";
export type QueueTab = "queue" | "playlists";

type OverlayCtx = {
  active: OverlayId | null;
  /** 队列抽屉打开时要显示的 tab（首页“我的歌单”入口可直接落到歌单页） */
  queueTab: QueueTab;
  open: (id: OverlayId) => void;
  openQueue: (tab?: QueueTab) => void;
  close: () => void;
  toggle: (id: OverlayId) => void;
};

const OverlayContext = createContext<OverlayCtx | null>(null);

/** 主浮层互斥：同一时间只允许搜索 / 队列 / 设置 / AI 助手之一。 */
export function OverlayProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<OverlayId | null>(null);
  const [queueTab, setQueueTab] = useState<QueueTab>("queue");

  const open = useCallback((id: OverlayId) => {
    if (id === "queue") setQueueTab("queue");
    setActive(id);
  }, []);
  const openQueue = useCallback((tab: QueueTab = "queue") => {
    setQueueTab(tab);
    setActive("queue");
  }, []);
  const close = useCallback(() => setActive(null), []);
  const toggle = useCallback(
    (id: OverlayId) => setActive((current) => (current === id ? null : id)),
    []
  );

  const value = useMemo<OverlayCtx>(
    () => ({ active, queueTab, open, openQueue, close, toggle }),
    [active, queueTab, open, openQueue, close, toggle]
  );

  // 供样式层区分「歌词专注模式」等场景，避免组件里到处判断浮层状态
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.overlay = active ?? "none";
  }, [active]);

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlay(): OverlayCtx {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlay must be used within OverlayProvider");
  return ctx;
}
