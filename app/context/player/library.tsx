"use client";

import type { Track } from "@/app/lib/types";
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

type LibraryCtx = {
  /** 本地曲库（只读视图，与播放队列完全解耦） */
  tracks: Track[];
  loading: boolean;
  error: string | null;
  /** 重新扫描本地目录 */
  scan: () => Promise<void>;
  getTrack: (trackId: string) => Track | null;
};

const LibraryContext = createContext<LibraryCtx | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scanningRef = useRef(false);

  const trackMap = useMemo(() => {
    const map = new Map<string, Track>();
    for (const track of tracks) map.set(track.id, track);
    return map;
  }, [tracks]);

  const getTrack = useCallback(
    (trackId: string) => trackMap.get(trackId) ?? null,
    [trackMap]
  );

  const scan = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setLoading(true);

    try {
      const res = await fetch("/api/tracks/scan", { cache: "no-store" });
      if (!res.ok) throw new Error(`scan failed: ${res.status}`);
      const data = (await res.json()) as { tracks?: Track[] };
      setTracks(data.tracks ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "scan failed");
    } finally {
      setLoading(false);
      scanningRef.current = false;
    }
  }, []);

  // 首次挂载自动扫描一次
  useEffect(() => {
    void scan();
  }, [scan]);

  const value = useMemo<LibraryCtx>(
    () => ({ tracks, loading, error, scan, getTrack }),
    [tracks, loading, error, scan, getTrack]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryCtx {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
