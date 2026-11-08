"use client";

import type { PlayerSnapshot } from "@/app/lib/types";
import { useAudioPlayer } from "@/app/hooks/useAudioPlayer";
import { useAudioVisualizer } from "@/app/hooks/useAudioVisualizer";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueue } from "./queue";

type PlaybackCtx = {
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
  fadeIn: number;
  fadeOut: number;
  audioElement: HTMLAudioElement | null;
  analyser: AnalyserNode | null;
  vizReady: boolean;

  play: () => Promise<void>;
  pause: () => Promise<void>;
  toggle: () => void;
  seek: (seconds: number) => void;
  stop: () => void;
  setVolume: (value: number) => void;
  setRate: (value: number) => void;
  setFadeIn: (seconds: number) => void;
  setFadeOut: (seconds: number) => void;
  toggleMute: () => void;
  ensureVisualizer: () => void;
};

const PlaybackContext = createContext<PlaybackCtx | null>(null);

export function PlaybackProvider({
  snapshot,
  children,
}: {
  snapshot: PlayerSnapshot | null | undefined;
  children: ReactNode;
}) {
  const queue = useQueue();

  const endedRef = useRef<() => void>(() => {});
  const engine = useAudioPlayer({ onEnded: () => endedRef.current() });
  const visualizer = useAudioVisualizer(engine.audioElement);

  // 解构出稳定引用，避免 useCallback 依赖整个 engine 对象
  const {
    audioRef,
    audioElement,
    setAudioRef,
    playing,
    progress,
    duration,
    volume,
    rate,
    setVolume: engineSetVolume,
    setRate: engineSetRate,
    seek: engineSeek,
    load,
  } = engine;
  const { setMasterGain, rampMasterGain, ensureConnected, analyser, ready } = visualizer;

  const [muted, setMuted] = useState(false);
  const [fadeIn, setFadeInState] = useState(0.6);
  const [fadeOut, setFadeOutState] = useState(0.4);

  const fadeTokenRef = useRef(0);
  const lastUidRef = useRef<string | null>(null);
  const lastEpochRef = useRef(0);
  const pendingRestoreRef = useRef<number | null>(null);
  const snapshotHydratedRef = useRef(false);

  // 恢复上次音量/静音/进度（进度在音源装载后 seek）
  useEffect(() => {
    if (snapshotHydratedRef.current || snapshot === undefined) return;
    snapshotHydratedRef.current = true;
    if (!snapshot) return;

    engineSetVolume(snapshot.volume);
    setMuted(snapshot.muted);
    pendingRestoreRef.current = snapshot.progress > 0 ? snapshot.progress : null;
  }, [snapshot, engineSetVolume]);

  // 音量 / 静音 → 主 GainNode（只依赖稳定函数与就绪状态）
  useEffect(() => {
    if (!ready) return;
    setMasterGain(muted ? 0 : volume);
  }, [volume, muted, ready, setMasterGain]);

  const play = useCallback(async () => {
    const el = audioRef.current;
    if (!el || !queue.currentTrack) return;

    const token = ++fadeTokenRef.current;
    const target = muted ? 0 : volume;
    const fadeMs = Math.round(fadeIn * 1000);

    ensureConnected();
    if (fadeMs > 0) setMasterGain(0);
    else setMasterGain(target);

    try {
      await el.play();
    } catch {
      /* WebView 自动播放限制 */
    }
    if (fadeTokenRef.current !== token) return;
    if (fadeMs > 0) rampMasterGain(target, fadeMs);
  }, [
    audioRef,
    queue.currentTrack,
    muted,
    volume,
    fadeIn,
    ensureConnected,
    setMasterGain,
    rampMasterGain,
  ]);

  const pause = useCallback(async () => {
    const el = audioRef.current;
    if (!el || el.paused) return;

    const token = ++fadeTokenRef.current;
    const fadeMs = Math.round(fadeOut * 1000);

    if (fadeMs > 0) {
      rampMasterGain(0, fadeMs);
      await new Promise((resolve) => setTimeout(resolve, fadeMs));
      if (fadeTokenRef.current !== token) return;
    }

    el.pause();
  }, [audioRef, fadeOut, rampMasterGain]);

  const toggle = useCallback(() => {
    if (playing) void pause();
    else void play();
  }, [playing, pause, play]);

  const seek = useCallback(
    (seconds: number) => {
      engineSeek(seconds);
    },
    [engineSeek]
  );

  const stop = useCallback(() => {
    void pause();
    engineSeek(0);
  }, [pause, engineSeek]);

  const setVolume = useCallback(
    (value: number) => {
      engineSetVolume(value);
    },
    [engineSetVolume]
  );

  const toggleMute = useCallback(() => {
    setMuted((value) => !value);
  }, []);

  const setFadeIn = useCallback((seconds: number) => {
    setFadeInState(Math.max(0, Math.min(3, seconds)));
  }, []);

  const setFadeOut = useCallback((seconds: number) => {
    setFadeOutState(Math.max(0, Math.min(3, seconds)));
  }, []);

  // ── 音源装载：currentUid / playEpoch 驱动，autoplay 只由 playEpoch 决定 ──
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (!queue.currentTrack) {
      lastUidRef.current = null;
      el.pause();
      el.removeAttribute("src");
      el.load();
      return;
    }

    const epochChanged = queue.playEpoch !== lastEpochRef.current;
    if (queue.currentUid === lastUidRef.current && !epochChanged) return;

    lastUidRef.current = queue.currentUid;
    lastEpochRef.current = queue.playEpoch;

    load(queue.currentTrack.url);

    const restoreAt = pendingRestoreRef.current;
    pendingRestoreRef.current = null;
    if (restoreAt != null && restoreAt > 0) {
      // 快照恢复：装载后跳转，但不自动播放
      el.addEventListener(
        "loadedmetadata",
        () => {
          try {
            const max = Number.isFinite(el.duration)
              ? Math.max(0, el.duration - 0.25)
              : restoreAt;
            el.currentTime = Math.min(restoreAt, max);
          } catch {
            /* 元数据异常时放弃恢复 */
          }
        },
        { once: true }
      );
      return;
    }

    if (epochChanged) {
      void play();
    }
  }, [audioElement, audioRef, load, queue.currentUid, queue.currentTrack, queue.playEpoch, play]);

  // 自然播完：replay / advanced / stop
  endedRef.current = () => {
    const action = queue.onEnded();
    if (action !== "replay") return;

    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    void play();
  };

  // 播放历史：每首新曲开始播放后记一条，时长用于 Home 今日聆听聚合
  const recordedUidRef = useRef<string | null>(null);
  useEffect(() => {
    if (!playing || !queue.currentUid || !queue.currentTrack) return;
    if (recordedUidRef.current === queue.currentUid) return;
    recordedUidRef.current = queue.currentUid;

    const trackId = queue.currentTrack.id;
    const timer = setTimeout(() => {
      const seconds = audioRef.current?.duration ?? 0;
      void fetch("/api/play-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, duration: seconds }),
      }).catch(() => {
        /* 历史写入失败不影响播放 */
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [playing, queue.currentUid, queue.currentTrack, audioRef]);

  const value = useMemo<PlaybackCtx>(
    () => ({
      playing,
      progress,
      duration,
      volume,
      muted,
      rate,
      fadeIn,
      fadeOut,
      audioElement,
      analyser,
      vizReady: ready,
      play,
      pause,
      toggle,
      seek,
      stop,
      setVolume,
      setRate: engineSetRate,
      setFadeIn,
      setFadeOut,
      toggleMute,
      ensureVisualizer: ensureConnected,
    }),
    [
      playing,
      progress,
      duration,
      volume,
      muted,
      rate,
      fadeIn,
      fadeOut,
      audioElement,
      analyser,
      ready,
      play,
      pause,
      toggle,
      seek,
      stop,
      setVolume,
      engineSetRate,
      setFadeIn,
      setFadeOut,
      toggleMute,
      ensureConnected,
    ]
  );

  return (
    <PlaybackContext.Provider value={value}>
      <audio ref={setAudioRef} preload="metadata" />
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback(): PlaybackCtx {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used within PlaybackProvider");
  return ctx;
}
