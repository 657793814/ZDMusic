"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { useLibrary, usePlayback, useQueue } from "@/app/context/player";
import { AgentChat } from "@/app/components/organisms/AgentChat";
import { Sheet } from "@/app/components/ui";
import { useMemo } from "react";

export function AssistantDrawer() {
  const { active, close } = useOverlay();
  const { currentTrack, queue } = useQueue();
  const { playing, progress, duration } = usePlayback();
  const { tracks, getTrack } = useLibrary();

  const open = active === "assistant";

  // 每次打开时按最新播放状态重建，助手能感知当前曲目 / 队列 / 曲库
  const requestContext = useMemo(
    () => ({
      playing,
      current: currentTrack
        ? {
            title: currentTrack.title,
            author: currentTrack.author || null,
            album: currentTrack.album || null,
          }
        : null,
      progressSec: Math.round(progress),
      durationSec: Math.round(duration),
      queueLength: queue.length,
      queue: queue.slice(0, 12).map((item) => {
        const track = getTrack(item.trackId);
        return {
          title: track?.title ?? item.trackId,
          author: track?.author || null,
        };
      }),
      libraryCount: tracks.length,
    }),
    [playing, currentTrack, progress, duration, queue, tracks.length, getTrack]
  );

  return (
    <Sheet open={open} onClose={close} side="right" label="AI 助手">
      <div className="zd-assistant">
        <header className="zd-assistant-head">
          <span className="zd-kicker">AI 助手</span>
          <span className="zd-assistant-hint">Cmd+J 开关 · 可读当前播放与队列</span>
          <button
            type="button"
            className="zd-assistant-close"
            onClick={close}
            aria-label="关闭 AI 助手"
          >
            ×
          </button>
        </header>
        <div className="zd-assistant-body">
          <AgentChat requestContext={requestContext} />
        </div>
      </div>
    </Sheet>
  );
}
