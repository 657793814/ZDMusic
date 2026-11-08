"use client";

import { useTrackCover } from "@/app/hooks/useTrackCover";
import { CoverPlaceholder } from "@/app/components/home/CoverPlaceholder";
import type { Track } from "@/app/lib/types";
import { ListIcon } from "@/app/components/ui/icons";

export function TrackThumb({
  track,
  onClick,
}: {
  track: Track | null;
  onClick: () => void;
}) {
  const cover = useTrackCover(track?.id);

  if (!track) return null;

  return (
    <button
      type="button"
      className="zd-track-thumb glass-panel"
      onClick={onClick}
      data-stage-interactive
      title="打开播放队列"
    >
      <span
        className="zd-track-thumb-art"
        style={cover ? { backgroundImage: `url("${cover}")` } : undefined}
        aria-hidden
      >
        {!cover ? <CoverPlaceholder trackId={track.id} /> : null}
      </span>
      <span className="zd-track-thumb-meta">
        <span className="zd-track-thumb-title">{track.title}</span>
        <span className="zd-track-thumb-sub">{track.author || "未知作者"}</span>
      </span>
      <ListIcon size={13} />
    </button>
  );
}
