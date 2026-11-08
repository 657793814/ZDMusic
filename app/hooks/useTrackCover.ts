"use client";

import { useEffect, useState } from "react";

type MetadataTrack = { id: string; coverDataUrl?: string | null };

let coversPromise: Promise<Map<string, string | null>> | null = null;

function loadCovers(): Promise<Map<string, string | null>> {
  if (!coversPromise) {
    coversPromise = fetch("/api/tracks/metadata", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { tracks: [] }))
      .then((data: { tracks?: MetadataTrack[] }) => {
        const map = new Map<string, string | null>();
        for (const track of data.tracks ?? []) {
          map.set(track.id, track.coverDataUrl ?? null);
        }
        return map;
      })
      .catch(() => new Map<string, string | null>());
  }
  return coversPromise;
}

/** 懒加载一次元数据，按 trackId 取封面；无封面返回 null，由调用方做渐变回退。 */
export function useTrackCover(trackId?: string | null): string | null {
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    if (!trackId) {
      setCover(null);
      return;
    }

    let alive = true;
    void loadCovers().then((map) => {
      if (alive) setCover(map.get(trackId) ?? null);
    });

    return () => {
      alive = false;
    };
  }, [trackId]);

  return cover;
}
