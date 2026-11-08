"use client";

import { usePlayback, useQueue } from "@/app/context/player";
import { useTrackCover } from "@/app/hooks/useTrackCover";
import type { Track } from "@/app/lib/types";
import type { ReactNode } from "react";
import { CoverPlaceholder } from "./CoverPlaceholder";

export interface RailItem {
  track: Track;
  /** 推荐理由：显示在作者前面，让用户知道“为什么是这首” */
  reason?: string;
}

function RailTile({
  item,
  index,
  current,
  playing,
  onPlay,
}: {
  item: RailItem;
  index: number;
  current: boolean;
  playing: boolean;
  onPlay: (index: number) => void;
}) {
  const { track, reason } = item;
  const cover = useTrackCover(track.id);
  const sub = reason
    ? `${reason} · ${track.author || track.subDir}`
    : track.author || track.subDir;

  return (
    <button
      type="button"
      className="zd-home-tile"
      data-current={current ? "true" : "false"}
      onClick={() => onPlay(index)}
      title={`${track.title} · ${sub}`}
    >
      <span
        className="zd-home-tile-art"
        data-current={current ? "true" : "false"}
        aria-hidden
      >
        {cover ? (
          // 封面统一 1:1 裁切，靠 CSS 的 object-fit 保证不拉伸
          <img className="zd-home-tile-cover" src={cover} alt="" loading="lazy" draggable={false} />
        ) : (
          <CoverPlaceholder trackId={track.id} />
        )}
        {current ? (
          <span className="zd-home-tile-bars" data-playing={playing ? "true" : "false"}>
            <i />
            <i />
            <i />
          </span>
        ) : null}
      </span>
      <span className="zd-home-tile-title">{track.title}</span>
      <span className="zd-home-tile-sub">{sub}</span>
    </button>
  );
}

export function TrackRail({
  kicker,
  hint,
  items,
  loading,
  emptyText,
  action,
  onPlay,
  delay = 180,
}: {
  kicker: string;
  hint?: string;
  items: RailItem[];
  loading?: boolean;
  emptyText: string;
  action?: ReactNode;
  onPlay: (index: number) => void;
  /** 进场动画延迟（毫秒），让多个条形成节奏 */
  delay?: number;
}) {
  const { currentTrack } = useQueue();
  const { playing } = usePlayback();

  return (
    <section
      className="zd-home-discover"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="zd-home-card-head">
        <span className="zd-kicker">
          {kicker}
          {hint ? <span className="zd-home-rail-hint">{hint}</span> : null}
        </span>
        {action}
      </div>

      {loading ? (
        <div className="zd-empty">正在扫描本地曲库…</div>
      ) : items.length === 0 ? (
        <div className="zd-empty">{emptyText}</div>
      ) : (
        <div className="zd-home-rail">
          {items.map((item, index) => (
            <RailTile
              key={`${item.track.id}-${index}`}
              item={item}
              index={index}
              current={item.track.id === currentTrack?.id}
              playing={playing}
              onPlay={onPlay}
            />
          ))}
        </div>
      )}
    </section>
  );
}
