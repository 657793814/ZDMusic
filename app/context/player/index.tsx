"use client";

import type { PlayerSnapshot } from "@/app/lib/types";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LibraryProvider } from "./library";
import { QueueProvider, useQueue } from "./queue";
import { PlaybackProvider, usePlayback } from "./playback";

export { useLibrary } from "./library";
export { useQueue } from "./queue";
export { usePlayback } from "./playback";

/**
 * 播放内核装配：Library → Queue → Playback。
 * 队列快照只在此处读写一次，避免两个 Provider 各自请求。
 */
export function PlayerRoot({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;

    fetch("/api/player-state", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive) setSnapshot((data as PlayerSnapshot | null) ?? null);
      })
      .catch(() => {
        if (alive) setSnapshot(null);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <LibraryProvider>
      <QueueProvider snapshot={snapshot}>
        <PlaybackProvider snapshot={snapshot}>
          <PlayerPersistence />
          {children}
        </PlaybackProvider>
      </QueueProvider>
    </LibraryProvider>
  );
}

/** 队列快照持久化：结构变更 debounce 1.2s，进度节流 6s，暂停/页面隐藏立即落盘 */
function PlayerPersistence() {
  const { queue, currentUid, repeat, shuffle, hydrated } = useQueue();
  const { volume, muted, progress, playing } = usePlayback();

  const latestRef = useRef({ queue, currentUid, repeat, shuffle, volume, muted, progress });
  latestRef.current = { queue, currentUid, repeat, shuffle, volume, muted, progress };

  const hydratedRef = useRef(hydrated);
  hydratedRef.current = hydrated;

  const flush = useCallback(() => {
    if (!hydratedRef.current) return;

    const data = latestRef.current;
    void fetch("/api/player-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        queue: data.queue,
        currentUid: data.currentUid,
        progress: data.progress,
        volume: data.volume,
        muted: data.muted,
        repeat: data.repeat,
        shuffle: data.shuffle,
      }),
    }).catch(() => {
      /* 落盘失败不阻塞播放 */
    });
  }, []);

  // 队列结构 / 音量 / 模式变化 → debounce
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(flush, 1200);
    return () => clearTimeout(timer);
  }, [hydrated, queue, currentUid, repeat, shuffle, volume, muted, flush]);

  // 进度节流：至少每 6s 落一次
  const lastProgressWriteRef = useRef(0);
  useEffect(() => {
    if (!hydrated) return;
    const now = Date.now();
    if (now - lastProgressWriteRef.current < 6000) return;
    lastProgressWriteRef.current = now;
    flush();
  }, [progress, hydrated, flush]);

  // 暂停立即落盘
  useEffect(() => {
    if (!playing) flush();
  }, [playing, flush]);

  // 页面隐藏立即落盘
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [flush]);

  return null;
}
