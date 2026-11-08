"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { usePlayback, useQueue } from "@/app/context/player";
import { useTrackCover } from "@/app/hooks/useTrackCover";
import { formatTime } from "@/app/lib/format";
import { ListIcon, PlayIcon } from "@/app/components/ui/icons";
import { CoverPlaceholder } from "./CoverPlaceholder";

export function ContinueListening() {
  const { currentTrack, currentItem, currentIndex, queue } = useQueue();
  const { playing, progress, duration, play } = usePlayback();
  const { open } = useOverlay();
  const cover = useTrackCover(currentTrack?.id);

  const percent =
    duration > 0 ? Math.max(0, Math.min(100, (progress / duration) * 100)) : 0;

  return (
    <section className="zd-home-card glass-panel">
      <div className="zd-home-card-head">
        <span className="zd-kicker">继续听</span>
        <span className="zd-home-stats-hint">
          {queue.length ? `队列 ${currentIndex + 1} / ${queue.length}` : "队列为空"}
        </span>
      </div>

      {currentTrack ? (
        <>
          <div className="zd-home-continue-body">
            <div
              className="zd-home-continue-art"
              aria-hidden
              style={cover ? { backgroundImage: `url("${cover}")` } : undefined}
            >
              {!cover ? <CoverPlaceholder trackId={currentTrack.id} /> : null}
            </div>
            <div className="zd-home-continue-meta">
              <div className="zd-home-continue-title">{currentTrack.title}</div>
              <div className="zd-home-continue-sub">
                {currentTrack.author || "未知作者"} · {formatTime(progress)} /{" "}
                {formatTime(duration)}
              </div>
              <div className="zd-home-continue-bar" aria-hidden>
                <span style={{ width: `${percent}%` }} />
              </div>
            </div>
          </div>
          <div className="zd-home-continue-actions">
            <button type="button" className="zd-chip" data-active="true" onClick={() => void play()}>
              <PlayIcon size={12} />
              {playing ? "正在播放" : "继续听"}
            </button>
            <button
              type="button"
              className="zd-chip"
              onClick={() => open("queue")}
            >
              <ListIcon size={12} />
              查看队列
            </button>
            {currentItem ? (
              <span className="zd-home-continue-uid">快照已恢复</span>
            ) : null}
          </div>
        </>
      ) : (
        <div className="zd-empty">
          还没有可继续的曲目。播放第一首后，这里会保留上次的队列与进度。
        </div>
      )}
    </section>
  );
}
