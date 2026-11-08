"use client";

import { useLibrary } from "@/app/context/player";
import type { ListeningProfile, PickItem } from "@/app/lib/recommend";
import type { Track } from "@/app/lib/types";
import { useCallback, useMemo, useState } from "react";

export type ListenSummary = {
  todayCount: number;
  todayMinutes: number;
  streakDays: number;
  weekCount: number;
  totalCount: number;
};

export type HomeFeed = {
  daily: PickItem[];
  local: PickItem[];
  profile: ListeningProfile;
  libraryCount: number;
};

const EMPTY_SUMMARY: ListenSummary = {
  todayCount: 0,
  todayMinutes: 0,
  streakDays: 0,
  weekCount: 0,
  totalCount: 0,
};

const EMPTY_PROFILE: ListeningProfile = {
  sampleSize: 0,
  sufficient: false,
  topArtist: null,
  topSong: null,
  distinctTracks: 0,
  activeDays: 0,
  totalMinutes: 0,
};

const EMPTY_FEED: HomeFeed = {
  daily: [],
  local: [],
  profile: EMPTY_PROFILE,
  libraryCount: 0,
};

function normalizeFeed(data: Partial<HomeFeed> | null): HomeFeed {
  if (!data) return EMPTY_FEED;
  return {
    daily: Array.isArray(data.daily) ? data.daily : [],
    local: Array.isArray(data.local) ? data.local : [],
    profile: data.profile ?? EMPTY_PROFILE,
    libraryCount: data.libraryCount ?? 0,
  };
}

export function useHomeData() {
  const { tracks, loading, error, scan } = useLibrary();
  const [summary, setSummary] = useState<ListenSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [feed, setFeed] = useState<HomeFeed>(EMPTY_FEED);
  const [feedLoading, setFeedLoading] = useState(true);

  const refreshFeed = useCallback(async (rotate = false) => {
    setFeedLoading(true);
    try {
      const res = await fetch(`/api/home/feed${rotate ? "?rotate=1" : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`feed failed: ${res.status}`);
      setFeed(normalizeFeed((await res.json()) as Partial<HomeFeed>));
    } catch {
      setFeed(EMPTY_FEED);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/play-history?action=summary", { cache: "no-store" });
      if (!res.ok) throw new Error(`summary failed: ${res.status}`);
      const data = (await res.json()) as Partial<ListenSummary>;
      setSummary({
        todayCount: data.todayCount ?? 0,
        todayMinutes: data.todayMinutes ?? 0,
        streakDays: data.streakDays ?? 0,
        weekCount: data.weekCount ?? 0,
        totalCount: data.totalCount ?? 0,
      });
    } catch {
      setSummary(EMPTY_SUMMARY);
    } finally {
      setSummaryLoading(false);
    }
    await refreshFeed();
  }, [refreshFeed]);

  /** 最近入库：文件名日期倒序，取 8 首；无日期按标题排。 */
  const recentTracks = useMemo<Track[]>(() => {
    const sorted = [...tracks].sort((a, b) => {
      const da = a.date || "";
      const db = b.date || "";
      if (da && db && da !== db) return db.localeCompare(da);
      if (da && !db) return -1;
      if (!da && db) return 1;
      return a.title.localeCompare(b.title, "zh-CN");
    });
    return sorted.slice(0, 8);
  }, [tracks]);

  return {
    summary,
    summaryLoading,
    feed,
    feedLoading,
    tracks,
    recentTracks,
    loading,
    error,
    scan,
    refreshSummary: refresh,
    refreshFeed,
  };
}
