"use client";

import type { Track } from "@/app/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

export interface LyricLine {
  time: number;
  text: string;
}

interface LyricsData {
  synced: LyricLine[];
  plain: string | null;
  title: string;
  artist: string;
  duration: number;
  notFound?: boolean;
  loading: boolean;
  error?: string;
}

// LRU cache per track id
const lyricsCache = new Map<string, LyricsData>();
const CACHE_MAX = 50;

export function useLyrics(track: Track | null) {
  const [data, setData] = useState<LyricsData>({
    synced: [],
    plain: null,
    title: "",
    artist: "",
    duration: 0,
    loading: false,
  });
  const fetchingRef = useRef<string | null>(null);

  const fetchLyrics = useCallback(async (title: string, artist: string, trackId: string) => {
    // Check cache
    const cached = lyricsCache.get(trackId);
    if (cached) {
      setData(cached);
      return;
    }

    // Prevent duplicate fetches
    if (fetchingRef.current === trackId) return;
    fetchingRef.current = trackId;

    setData((prev) => ({ ...prev, loading: true }));

    try {
      const params = new URLSearchParams({ title });
      if (artist) params.set("artist", artist);
      // 传 trackId 让服务端优先查本地 .lrc 文件，查到则保存
      params.set("track", trackId);

      const res = await fetch(`/api/lyrics?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const result: LyricsData = {
        synced: json.synced ?? [],
        plain: json.plain ?? null,
        title: json.title ?? title,
        artist: json.artist ?? artist,
        duration: json.duration ?? 0,
        notFound: json.notFound ?? false,
        loading: false,
        error: json.error,
      };

      // Cache it
      if (lyricsCache.size >= CACHE_MAX) {
        const firstKey = lyricsCache.keys().next().value;
        if (firstKey) lyricsCache.delete(firstKey);
      }
      lyricsCache.set(trackId, result);

      setData(result);
    } catch (err) {
      setData({
        synced: [],
        plain: null,
        title,
        artist,
        duration: 0,
        loading: false,
        error: String(err),
      });
    } finally {
      if (fetchingRef.current === trackId) {
        fetchingRef.current = null;
      }
    }
  }, []);

  // Track changes → fetch lyrics
  useEffect(() => {
    if (!track) {
      setData({ synced: [], plain: null, title: "", artist: "", duration: 0, loading: false });
      return;
    }

    // Build a query key: clean title + author
    const title = track.title || "";
    if (!title) {
      setData({ synced: [], plain: null, title: "", artist: "", duration: 0, loading: false });
      return;
    }

    // Smart title/artist extraction:
    // 「周杰伦《稻香》完整版无损音质」→ title=稻香, artist=周杰伦
    // （不使用 track.author，因为它是上传者，不是真实歌手）
    let cleanTitle = title;
    let cleanArtist = "";

    const bracketMatch = title.match(/《([^》]+)》/);
    if (bracketMatch) {
      let bracketContent = bracketMatch[1]!;
      // 《辞九门回忆-邓寓君(等什么君)》→ 取「-」前面的「辞九门回忆」
      // 《稻香》→ 直接是稻香
      const dashIdx = bracketContent.search(/[-—–]/);
      if (dashIdx > 1) {
        cleanTitle = bracketContent.slice(0, dashIdx).trim();
        const afterDash = bracketContent.slice(dashIdx + 1).trim();
        // afterDash 如「邓寓君(等什么君)」含歌手名
        if (!cleanArtist && afterDash) {
          const innerArtist = afterDash
            .replace(/[（(][^）)]*[）)]/g, "")
            .replace(/[-—|\s]+$/, "")
            .trim();
          if (innerArtist && innerArtist.length < 30) cleanArtist = innerArtist;
        }
      } else {
        cleanTitle = bracketContent;
      }

      // 提取《》前的文字作为歌手（如「周杰伦」）
      const beforeBracket = title.split(/《/)[0]?.trim() || "";
      const possibleArtist = beforeBracket
        .replace(/^【[^】]*】/g, "")
        .replace(/^[-—\s]+/g, "")
        .replace(/[-—|\s]+$/, "")
        .trim();
      if (possibleArtist && possibleArtist.length < 30) {
        cleanArtist = possibleArtist;
      }
    } else {
      cleanTitle = title
        .replace(/【[^】]*】/g, "")
        .replace(/\(.*?\)/g, "")
        .replace(/\[.*?\]/g, "")
        .replace(/「.*?」/g, "")
        .replace(/『.*?』/g, "")
        .replace(/[-—|].*$/, "")
        .trim();
    }

    fetchLyrics(cleanTitle, cleanArtist, track.id);
  }, [track?.id, track?.title, fetchLyrics]);

  return data;
}
