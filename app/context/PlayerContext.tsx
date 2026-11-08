"use client";

/**
 * 旧 UI 兼容层。
 * 真正的播放内核已拆到 app/context/player/{library,queue,playback}；
 * 这里把三者组合成旧的 `usePlayer()` 形状，供尚未迁移的组件继续使用。
 * P2+ 页面迁移完成后应删除本文件。
 */

import type { PlayerState, PlayMode, Track } from "@/app/lib/types";
import { PlayerRoot, useLibrary, usePlayback, useQueue } from "@/app/context/player";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";

type PlayerCtx = {
  state: PlayerState;
  playTrack: (track: Track, playlist?: Track[]) => void;
  addTracks: (tracks: Track[]) => void;
  removeTrack: (trackId: string) => void;
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
  seek: (n: number) => void;
  setVolume: (n: number) => void;
  stop: () => void;
  scanLocalTracks: () => void;
  playMode: PlayMode;
  setPlayMode: (mode: PlayMode) => void;
  flipped: boolean;
  toggleFlip: () => void;
  analyser: AnalyserNode | null;
  ensureVisualizer: () => void;
  vizReady: boolean;
  lyricsOpen: boolean;
  toggleLyrics: () => void;
};

const PlayerContext = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  return (
    <PlayerRoot>
      <LegacyPlayerBridge>{children}</LegacyPlayerBridge>
    </PlayerRoot>
  );
}

function LegacyPlayerBridge({ children }: { children: ReactNode }) {
  const library = useLibrary();
  const queue = useQueue();
  const playback = usePlayback();

  const [flipped, setFlipped] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  const toggleFlip = useCallback(() => {
    setFlipped((v) => !v);
    setLyricsOpen(false);
  }, []);

  const toggleLyrics = useCallback(() => {
    setLyricsOpen((v) => !v);
    setFlipped(false);
  }, []);

  const playlist = useMemo(
    () =>
      queue.queue
        .map((item) => library.getTrack(item.trackId))
        .filter((track): track is Track => Boolean(track)),
    [queue.queue, library]
  );

  const playMode: PlayMode = queue.shuffle
    ? "shuffle"
    : queue.repeat === "track"
      ? "single"
      : "playlist";

  const setPlayMode = useCallback(
    (mode: PlayMode) => {
      if (mode === "shuffle") {
        queue.setRepeat("queue");
        if (!queue.shuffle) queue.toggleShuffle();
        return;
      }
      if (queue.shuffle) queue.toggleShuffle();
      queue.setRepeat(mode === "single" ? "track" : "queue");
    },
    [queue]
  );

  const playTrack = useCallback(
    (track: Track, list?: Track[]) => {
      if (list?.length) {
        const startIndex = Math.max(0, list.findIndex((item) => item.id === track.id));
        queue.replaceQueue(list, { startIndex, play: true, origin: "library" });
        return;
      }

      const index = library.tracks.findIndex((item) => item.id === track.id);
      if (index >= 0) {
        queue.replaceQueue(library.tracks, {
          startIndex: index,
          play: true,
          origin: "library",
        });
      } else {
        queue.replaceQueue([track], { play: true, origin: "library" });
      }
    },
    [queue, library.tracks]
  );

  const addTracks = useCallback(
    (tracks: Track[]) => {
      queue.enqueue(tracks);
    },
    [queue]
  );

  const removeTrack = useCallback(
    (trackId: string) => {
      const targets = queue.queue.filter((item) => item.trackId === trackId);
      for (const item of targets) queue.removeItem(item.uid);
    },
    [queue]
  );

  const next = useCallback(() => {
    queue.next();
  }, [queue]);

  const prev = useCallback(() => {
    if (playback.progress > 3) {
      playback.seek(0);
      return;
    }
    const uid = queue.prev();
    if (!uid) playback.seek(0);
  }, [playback, queue]);

  const togglePlay = useCallback(() => {
    playback.ensureVisualizer();
    playback.toggle();
  }, [playback]);

  const seek = useCallback(
    (n: number) => {
      playback.seek(n);
    },
    [playback]
  );

  const setVolume = useCallback(
    (n: number) => {
      playback.setVolume(n);
    },
    [playback]
  );

  const stop = useCallback(() => {
    playback.stop();
  }, [playback]);

  const scanLocalTracks = useCallback(() => {
    void library.scan();
  }, [library]);

  const state: PlayerState = useMemo(
    () => ({
      current: queue.currentTrack,
      playlist,
      index: queue.currentIndex < 0 ? 0 : queue.currentIndex,
      playing: playback.playing,
      progress: playback.progress,
      duration: playback.duration,
      volume: playback.volume,
      playMode,
    }),
    [
      queue.currentTrack,
      queue.currentIndex,
      playlist,
      playback.playing,
      playback.progress,
      playback.duration,
      playback.volume,
      playMode,
    ]
  );

  const ctx = useMemo<PlayerCtx>(
    () => ({
      state,
      playTrack,
      addTracks,
      removeTrack,
      next,
      prev,
      togglePlay,
      seek,
      setVolume,
      stop,
      scanLocalTracks,
      playMode,
      setPlayMode,
      flipped,
      toggleFlip,
      analyser: playback.analyser,
      ensureVisualizer: playback.ensureVisualizer,
      vizReady: playback.vizReady,
      lyricsOpen,
      toggleLyrics,
    }),
    [
      state,
      playTrack,
      addTracks,
      removeTrack,
      next,
      prev,
      togglePlay,
      seek,
      setVolume,
      stop,
      scanLocalTracks,
      playMode,
      setPlayMode,
      flipped,
      toggleFlip,
      playback.analyser,
      playback.ensureVisualizer,
      playback.vizReady,
      lyricsOpen,
      toggleLyrics,
    ]
  );

  return <PlayerContext.Provider value={ctx}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerCtx {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
