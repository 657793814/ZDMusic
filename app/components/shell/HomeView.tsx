"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { useHomeData } from "@/app/hooks/useHomeData";
import { usePlayback, useQueue } from "@/app/context/player";
import { ContinueListening } from "@/app/components/home/ContinueListening";
import { ListeningProfileCard } from "@/app/components/home/ListeningProfileCard";
import { MyPlaylists } from "@/app/components/home/MyPlaylists";
import { TrackRail, type RailItem } from "@/app/components/home/TrackRail";
import { HeroClock } from "@/app/components/home/HeroClock";
import { TodayStats } from "@/app/components/home/TodayStats";
import { PlayIcon, SearchIcon, SparklesIcon } from "@/app/components/ui/icons";
import { useCallback, useEffect, useMemo } from "react";

export function HomeView({ active }: { active: boolean }) {
  const {
    summary,
    summaryLoading,
    feed,
    feedLoading,
    tracks,
    recentTracks,
    loading,
    scan,
    refreshSummary,
    refreshFeed,
  } = useHomeData();
  const { replaceQueue, currentTrack } = useQueue();
  const { play } = usePlayback();
  const { open } = useOverlay();

  // 每次回到 Home 都刷新统计与推荐（播放历史由播放内核写入）
  useEffect(() => {
    if (active) void refreshSummary();
  }, [active, refreshSummary]);

  const handlePlayRail = useCallback(
    (items: RailItem[], index: number) => {
      if (!items.length) return;
      replaceQueue(
        items.map((item) => item.track),
        { startIndex: index, play: true, origin: "library" }
      );
    },
    [replaceQueue]
  );

  const handleRescan = useCallback(async () => {
    await scan();
    void refreshSummary();
  }, [scan, refreshSummary]);

  const recentItems = useMemo<RailItem[]>(
    () => recentTracks.map((track) => ({ track })),
    [recentTracks]
  );

  return (
    <main
      className="zd-view zd-home-view"
      data-active={active ? "true" : "false"}
      aria-hidden={!active}
    >
      <div className="zd-home-shell">
        <section className="zd-home-hero glass-hero">
          <HeroClock />
          <TodayStats summary={summary} loading={summaryLoading} />
        </section>

        <div className="zd-home-shortcuts">
          <button type="button" className="zd-chip" onClick={() => open("search")}>
            <SearchIcon size={12} />
            搜索
          </button>
          <button
            type="button"
            className="zd-chip"
            data-active={currentTrack ? "true" : "false"}
            onClick={() => {
              if (currentTrack) void play();
              else open("search");
            }}
          >
            <PlayIcon size={12} />
            {currentTrack ? "继续听" : "选一首开始"}
          </button>
          <button type="button" className="zd-chip" onClick={() => void handleRescan()}>
            重新扫描
          </button>
          <button type="button" className="zd-chip" onClick={() => open("library")}>
            管理曲库
          </button>
          <span className="zd-home-count">
            {loading
              ? "扫描中…"
              : `本地 ${tracks.length} 首${summary.totalCount ? ` · 历史 ${summary.totalCount} 次播放` : ""}`}
          </span>
        </div>

        <div className="zd-home-split">
          <ContinueListening />
          <ListeningProfileCard profile={feed.profile} loading={feedLoading} />
        </div>

        <TrackRail
          kicker="每日推荐"
          hint={feed.daily.length ? "本地曲库 · 当天稳定" : undefined}
          items={feed.daily}
          loading={feedLoading}
          emptyText="曲库为空，先把 mp3 放进本地音乐目录再重新扫描。"
          delay={180}
          onPlay={(index) => handlePlayRail(feed.daily, index)}
          action={
            <button
              type="button"
              className="zd-home-link"
              onClick={() => void refreshFeed(true)}
              disabled={feedLoading}
            >
              <SparklesIcon size={12} />
              换一批
            </button>
          }
        />

        <TrackRail
          kicker="本地推荐"
          hint="依据本地曲库与播放历史，不接平台歌单"
          items={feed.local}
          loading={feedLoading}
          emptyText="还没有足够的本地曲目可以推荐。"
          delay={240}
          onPlay={(index) => handlePlayRail(feed.local, index)}
        />

        <MyPlaylists />

        <TrackRail
          kicker="最近入库"
          hint={tracks.length ? `共 ${tracks.length} 首` : undefined}
          items={recentItems}
          loading={loading}
          emptyText="没有找到本地歌曲。把 mp3 放到 ~/Documents/bili 后重新扫描。"
          delay={300}
          onPlay={(index) => handlePlayRail(recentItems, index)}
          action={
            <button type="button" className="zd-home-link" onClick={() => open("search")}>
              <SearchIcon size={12} />
              在曲库中搜索
            </button>
          }
        />
      </div>
    </main>
  );
}
