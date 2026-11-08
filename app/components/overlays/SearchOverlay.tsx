"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { useDownload } from "@/app/context/DownloadContext";
import { useLibrary, useQueue } from "@/app/context/player";
import type { BiliVideo } from "@/app/lib/bili";
import type { Track } from "@/app/lib/types";
import { IconButton } from "@/app/components/ui";
import {
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  ExternalIcon,
  MusicIcon,
  PlusIcon,
  SearchIcon,
} from "@/app/components/ui/icons";
import { useEffect, useMemo, useRef, useState } from "react";

type Tab = "local" | "bili";

export function SearchOverlay() {
  const { active, close } = useOverlay();
  const { tracks } = useLibrary();
  const { replaceQueue, addNext } = useQueue();
  const { download } = useDownload();

  const [tab, setTab] = useState<Tab>("local");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [biliResults, setBiliResults] = useState<BiliVideo[]>([]);
  const [biliLoading, setBiliLoading] = useState(false);
  const [biliError, setBiliError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = active === "search";

  useEffect(() => {
    if (!open) return;
    setTab("local");
    setQuery("");
    setSelected(0);
    const focus = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(focus);
  }, [open]);

  const localResults = useMemo<Track[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks.slice(0, 8);
    return tracks
      .filter((track) =>
        `${track.title} ${track.author} ${track.filename}`.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [tracks, query]);

  // B 站搜索：500ms 防抖
  useEffect(() => {
    if (!open || tab !== "bili" || !query.trim()) {
      setBiliResults([]);
      setBiliError(null);
      setBiliLoading(false);
      return;
    }

    let alive = true;
    setBiliLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/bili/search?keyword=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`B站搜索失败（${res.status}）`);
          return (await res.json()) as { videos?: BiliVideo[] };
        })
        .then((data) => {
          if (!alive) return;
          setBiliResults(data.videos ?? []);
          setBiliError(null);
        })
        .catch((err: unknown) => {
          if (!alive) return;
          setBiliResults([]);
          setBiliError(err instanceof Error ? err.message : "B站搜索失败");
        })
        .finally(() => {
          if (alive) setBiliLoading(false);
        });
    }, 500);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, tab, query]);

  useEffect(() => {
    setSelected(0);
  }, [query, tab]);

  if (!open) return null;

  const playLocal = (index: number) => {
    const track = localResults[index];
    if (!track) return;
    replaceQueue(localResults, { startIndex: index, play: true, origin: "search" });
    close();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const length = tab === "local" ? localResults.length : biliResults.length;
      if (length) setSelected((value) => (value + 1) % length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const length = tab === "local" ? localResults.length : biliResults.length;
      if (length) setSelected((value) => (value - 1 + length) % length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (tab === "local") {
        playLocal(selected);
      } else {
        const video = biliResults[selected];
        if (video) window.open(`https://www.bilibili.com/video/${video.bvid}`, "_blank");
      }
    }
  };

  return (
    <>
      <div className="zd-search-backdrop zd-scrim" onClick={close} aria-hidden />
      <div className="zd-search" role="dialog" aria-modal="true" aria-label="搜索">
        <div className="zd-search-bar glass-hero">
          <SearchIcon size={16} />
          <input
            ref={inputRef}
            className="zd-search-input"
            type="text"
            value={query}
            placeholder={tab === "local" ? "搜索本地曲库：标题 / 作者 / 文件名" : "搜索 B 站视频"}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="搜索关键词"
          />
          <IconButton label="关闭搜索" size={30} onClick={close}>
            <CloseIcon size={13} />
          </IconButton>
        </div>

        <div className="zd-search-tabs">
          <button
            type="button"
            className="zd-chip"
            data-active={tab === "local" ? "true" : "false"}
            onClick={() => setTab("local")}
          >
            <MusicIcon size={12} />
            本地曲库
          </button>
          <button
            type="button"
            className="zd-chip"
            data-active={tab === "bili" ? "true" : "false"}
            onClick={() => setTab("bili")}
          >
            B 站
          </button>
          <span className="zd-search-hint">Esc 关闭 · ↑↓ 选择 · Enter 播放</span>
        </div>

        <div className="zd-search-results">
          {tab === "local" ? (
            localResults.length === 0 ? (
              <div className="zd-empty">本地曲库没有匹配项。</div>
            ) : (
              localResults.map((track, index) => (
                <div
                  key={track.id}
                  className="zd-search-row"
                  data-selected={index === selected ? "true" : "false"}
                  role="button"
                  tabIndex={0}
                  onClick={() => playLocal(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      playLocal(index);
                    }
                  }}
                >
                  <span className="zd-search-row-icon">
                    <MusicIcon size={14} />
                  </span>
                  <span className="zd-search-row-meta">
                    <span className="zd-search-row-title">{track.title}</span>
                    <span className="zd-search-row-sub">
                      {track.author || track.subDir} · {track.filename}
                    </span>
                  </span>
                  <span className="zd-search-row-actions">
                    <IconButton
                      label="下载到本地"
                      size={28}
                      onClick={(event) => {
                        event.stopPropagation();
                        void download([track.id], track.title);
                      }}
                    >
                      <DownloadIcon size={12} />
                    </IconButton>
                    <IconButton
                      label="下一首播放"
                      size={28}
                      onClick={(event) => {
                        event.stopPropagation();
                        addNext(track, "search");
                      }}
                    >
                      <PlusIcon size={12} />
                    </IconButton>
                  </span>
                </div>
              ))
            )
          ) : biliLoading ? (
            <div className="zd-empty">正在搜索 B 站…</div>
          ) : biliError ? (
            <div className="zd-empty">{biliError}</div>
          ) : !query.trim() ? (
            <div className="zd-empty">
              输入关键词搜索 B 站视频；转成 MP3 可在 AI 助手里说「下载 BV 号」。
            </div>
          ) : biliResults.length === 0 ? (
            <div className="zd-empty">没有找到相关视频。</div>
          ) : (
            biliResults.map((video, index) => {
              const url = `https://www.bilibili.com/video/${video.bvid}`;
              return (
                <div
                  key={video.bvid}
                  className="zd-search-row"
                  data-selected={index === selected ? "true" : "false"}
                  role="button"
                  tabIndex={0}
                  onClick={() => window.open(url, "_blank")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      window.open(url, "_blank");
                    }
                  }}
                >
                  <span className="zd-search-row-icon">
                    <ExternalIcon size={14} />
                  </span>
                  <span className="zd-search-row-meta">
                    <span className="zd-search-row-title">{video.title}</span>
                    <span className="zd-search-row-sub">
                      {video.author} · {video.duration}
                    </span>
                  </span>
                  <span className="zd-search-row-actions">
                    <IconButton
                      label="复制链接"
                      size={28}
                      onClick={(event) => {
                        event.stopPropagation();
                        void navigator.clipboard?.writeText(url);
                      }}
                    >
                      <CopyIcon size={12} />
                    </IconButton>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
