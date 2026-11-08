"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { usePlayback, useQueue } from "@/app/context/player";
import { useTrackCover } from "@/app/hooks/useTrackCover";
import { StageCanvas } from "@/app/components/stage/StageCanvas";
import { TrackThumb } from "@/app/components/stage/TrackThumb";
import { ArrowLeftIcon } from "@/app/components/ui/icons";

export function StageView({ active, onExit }: { active: boolean; onExit: () => void }) {
  const { currentTrack } = useQueue();
  const { playing, analyser, progress, duration } = usePlayback();
  const { open } = useOverlay();
  const cover = useTrackCover(currentTrack?.id);

  return (
    <section
      className="zd-view zd-stage-view"
      data-active={active ? "true" : "false"}
      aria-hidden={!active}
    >
      <StageCanvas
        coverUrl={cover}
        trackId={currentTrack?.id}
        analyser={analyser}
        playing={playing}
        active={active}
        title={currentTrack?.title ?? ""}
        artist={currentTrack?.author ?? ""}
        position={progress}
        duration={duration}
      />

      {active ? (
        <button
          type="button"
          className="zd-stage-back glass-pill"
          onClick={onExit}
          aria-label="返回主界面"
          data-stage-interactive
        >
          <ArrowLeftIcon size={16} />
          <span>返回</span>
        </button>
      ) : null}

      {currentTrack ? (
        <div className="zd-stage-info">
          <span className="zd-kicker">NOW PLAYING</span>
          <h1 className="zd-stage-title">{currentTrack.title}</h1>
          <p className="zd-stage-artist">{currentTrack.author || "未知作者"}</p>
          {currentTrack.album ? (
            <span className="zd-stage-album">{currentTrack.album}</span>
          ) : null}
        </div>
      ) : null}

      <TrackThumb track={currentTrack} onClick={() => open("queue")} />
    </section>
  );
}
