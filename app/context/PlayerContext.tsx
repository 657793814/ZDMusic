"use client";

import type { Track, PlayerState, PlayMode } from "@/app/lib/types";
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

type PlayerCtx = {
  state: PlayerState;
  playTrack: (track: Track, playlist?: Track[]) => void;
  addTracks: (tracks: Track[]) => void;
  removeTrack: (trackId: string) => void;
  next: () => void;
  prev: () => void;
  togglePlay: () => void | Promise<void>;
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
};

const PlayerContext = createContext<PlayerCtx | null>(null);

function pickNextIndex(mode: 'playlist' | 'shuffle', playlist: Track[], currentIndex: number): number {
  const len = playlist.length;
  if (len <= 1) return 0;
  if (mode !== 'shuffle') return (currentIndex + 1) % len;
  let ni: number;
  do {
    ni = Math.floor(Math.random() * len);
  } while (ni === currentIndex);
  return ni;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [playMode, setPlayMode] = useState<PlayMode>('playlist');
  const playlistRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  const playModeRef = useRef<PlayMode>('playlist');
  const playTrackInternalRef = useRef<(track: Track) => void>(() => {});
  const hasScannedRef = useRef(false);

  const [flipped, setFlipped] = useState(false);
  const toggleFlip = useCallback(() => setFlipped((v) => !v), []);

  const {
    audioRef,
    audioElement,
    setAudioRef,
    playing,
    progress,
    duration,
    volume,
    toggle,
    seek,
    setVolume,
    playTrack,
    pause,
  } = useAudioPlayer({ onEnded: () => onEndedRef.current() });

  const onEndedRef = useRef<() => void>(() => {});
  onEndedRef.current = useCallback(() => {
    const pl = playlistRef.current;
    const mode = playModeRef.current;
    const ci = indexRef.current;
    if (!pl.length) return;

    if (mode === 'single') {
      const t = pl[ci];
      if (t) playTrackInternalRef.current(t);
      return;
    }

    const ni = pickNextIndex(mode, pl, ci);
    setIndex(ni);
    indexRef.current = ni;
    const t = pl[ni];
    if (t) playTrackInternalRef.current(t);
  }, []);

  // useAudioVisualizer 使用 audioElement（state，驱动响应式更新）
  const { analyser, ready: vizReady, ensureConnected } = useAudioVisualizer(
    audioElement
  );

  // 首次挂载自动扫描本地曲库
  useEffect(() => {
    if (!hasScannedRef.current) {
      hasScannedRef.current = true;
      fetch("/api/tracks/scan", { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error(`scan failed: ${r.status}`);
          return r.json() as Promise<{ tracks?: Track[] }>;
        })
        .then((data) => {
          if (data.tracks?.length) {
            setPlaylist(data.tracks);
            playlistRef.current = data.tracks;
            if (indexRef.current < 0) {
              setIndex(0);
              indexRef.current = 0;
              // 自动播放第一首
              playTrackInternalRef.current(data.tracks[0]);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    playTrackInternalRef.current = playTrack;
  }, [playTrack]);

  // 播放时连接频谱分析器
  useEffect(() => {
    if (playing) ensureConnected();
  }, [playing, ensureConnected]);

  const current =
    index >= 0 && index < playlist.length ? playlist[index] ?? null : null;

  const addTracks = useCallback((tracks: Track[]) => {
    setPlaylist((prev) => {
      const ids = new Set(prev.map((t) => t.id));
      const fresh = tracks.filter((t) => !ids.has(t.id));
      if (!fresh.length) return prev;
      const next = [...prev, ...fresh];
      playlistRef.current = next;
      return next;
    });

    if (indexRef.current < 0) {
      const cur = playlistRef.current;
      const first = cur[0];
      if (first) {
        setIndex(0);
        indexRef.current = 0;
        playTrack(first);
      }
    }
  }, [playTrack]);

  const removeTrack = useCallback(
    (trackId: string) => {
      const prev = playlistRef.current;
      const rmIdx = prev.findIndex((t) => t.id === trackId);
      if (rmIdx < 0) return;

      const next = [...prev];
      next.splice(rmIdx, 1);
      const curIdx = indexRef.current;

      playlistRef.current = next;
      setPlaylist(next);

      if (rmIdx === curIdx) {
        if (next.length === 0) {
          indexRef.current = -1;
          setIndex(-1);
          pause();
        } else {
          const newIdx = Math.min(rmIdx, next.length - 1);
          indexRef.current = newIdx;
          setIndex(newIdx);
          playTrack(next[newIdx]);
        }
      } else if (rmIdx < curIdx) {
        const newIdx = curIdx - 1;
        indexRef.current = newIdx;
        setIndex(newIdx);
      }
    },
    [playTrack, pause]
  );

  const playTrackWrapped = useCallback(
    (track: Track, pl?: Track[]) => {
      if (pl?.length) {
        const nextPl = [...pl];
        const i = Math.max(nextPl.findIndex((t) => t.id === track.id), 0);
        setPlaylist(nextPl);
        playlistRef.current = nextPl;
        setIndex(i);
        indexRef.current = i;
        playTrack(track);
      } else {
        const cur = playlistRef.current;
        const i = cur.findIndex((t) => t.id === track.id);
        if (i >= 0) {
          setIndex(i);
          indexRef.current = i;
          playTrack(track);
        } else {
          const single = [track];
          setPlaylist(single);
          playlistRef.current = single;
          setIndex(0);
          indexRef.current = 0;
          playTrack(track);
        }
      }
    },
    [playTrack]
  );

  const next = useCallback(() => {
    const i = indexRef.current;
    const pl = playlistRef.current;
    if (!pl.length) return;
    const mode = playModeRef.current;

    if (mode === 'shuffle') {
      const ni = pickNextIndex('shuffle', pl, i);
      setIndex(ni);
      indexRef.current = ni;
      const t = pl[ni];
      if (t) playTrack(t);
    } else if (mode === 'single') {
      const ni = Math.min(pl.length - 1, Math.max(i + 1, 0));
      if (ni === i && i >= 0) return;
      setIndex(ni);
      indexRef.current = ni;
      const t = pl[ni];
      if (t) playTrack(t);
    } else {
      const ni = Math.min(pl.length - 1, Math.max(i + 1, 0));
      if (ni === i && i >= 0) return;
      setIndex(ni);
      indexRef.current = ni;
      const t = pl[ni];
      if (t) playTrack(t);
    }
  }, [playTrack]);

  const prev = useCallback(() => {
    const i = indexRef.current;
    const pl = playlistRef.current;
    if (!pl.length || i <= 0) return;
    const ni = Math.max(0, i - 1);
    setIndex(ni);
    indexRef.current = ni;
    const t = pl[ni];
    if (t) playTrack(t);
  }, [playTrack]);

  const togglePlayWrapped = useCallback(() => {
    const currentTrack = playlistRef.current[indexRef.current];
    if (!currentTrack) {
      const first = playlistRef.current[0];
      if (first && indexRef.current < 0) {
        setIndex(0);
        indexRef.current = 0;
        playTrack(first);
        return;
      }
      return;
    }
    const audio = audioRef.current;
    if (audio && !audio.src) {
      playTrack(currentTrack);
      return;
    }
    return toggle();
  }, [toggle, playTrack, audioRef]);

  const stop = useCallback(() => {
    pause();
    seek(0);
  }, [pause, seek]);

  const scanLocalTracks = useCallback(() => {
    fetch("/api/tracks/scan", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`scan failed: ${r.status}`);
        return r.json() as Promise<{ tracks?: Track[] }>;
      })
      .then((data) => {
        if (data.tracks?.length) {
          setPlaylist(data.tracks);
          playlistRef.current = data.tracks;
          if (indexRef.current < 0) {
            setIndex(0);
            indexRef.current = 0;
          }
        }
      })
      .catch(() => {});
  }, []);

  const state: PlayerState = useMemo(
    () => ({
      current,
      playlist,
      index: index < 0 ? 0 : index,
      playing,
      progress,
      duration,
      volume,
      playMode,
    }),
    [current, playlist, index, playing, progress, duration, volume, playMode]
  );

  const ctx: PlayerCtx = useMemo(
    () => ({
      state,
      playTrack: playTrackWrapped,
      addTracks,
      removeTrack,
      next,
      prev,
      togglePlay: togglePlayWrapped,
      seek,
      setVolume,
      stop,
      scanLocalTracks,
      playMode,
      setPlayMode,
      flipped,
      toggleFlip,
      analyser,
      ensureVisualizer: ensureConnected,
      vizReady,
    }),
    [state, playTrackWrapped, addTracks, removeTrack, next, prev, togglePlayWrapped, seek, setVolume, stop, scanLocalTracks, playMode, setPlayMode, flipped, toggleFlip, analyser, ensureConnected, vizReady]
  );

  return (
    <PlayerContext.Provider value={ctx}>
      <audio ref={setAudioRef} className="hidden" preload="metadata" aria-hidden />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const v = useContext(PlayerContext);
  if (!v) throw new Error("usePlayer must be used within PlayerProvider");
  return v;
}
