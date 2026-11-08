"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { usePlayback, useQueue } from "@/app/context/player";
import { IconButton, Popover, Slider } from "@/app/components/ui";
import {
  AiIcon,
  ListIcon,
  LyricIcon,
  MicIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  SearchIcon,
  SettingsIcon,
  ShuffleIcon,
  StageIcon,
  VolumeIcon,
} from "@/app/components/ui/icons";
import { formatTime } from "@/app/lib/format";

export function PlayerDock({
  visible,
  onHover,
  onEnterStage,
  inStage = false,
}: {
  visible: boolean;
  onHover: (hovering: boolean) => void;
  onEnterStage?: () => void;
  inStage?: boolean;
}) {
  const { currentTrack, playMode, cyclePlayMode, prev, next } = useQueue();
  const {
    playing,
    progress,
    duration,
    volume,
    muted,
    fadeIn,
    fadeOut,
    toggle,
    seek,
    setVolume,
    setFadeIn,
    setFadeOut,
    toggleMute,
  } = usePlayback();
  const { active, open } = useOverlay();

  const playModeMeta = {
    sequential: {
      short: "顺序",
      label: "顺序播放（列表循环）",
      hint: "按队列顺序播放，播完回到第一首",
    },
    shuffle: {
      short: "随机",
      label: "随机播放",
      hint: "下一首从队列里随机挑选，不重复直到播完",
    },
    "repeat-one": {
      short: "单曲",
      label: "单曲循环",
      hint: "当前曲目播完后从头重播",
    },
  }[playMode];

  const handlePrev = () => {
    if (progress > 3) {
      seek(0);
      return;
    }
    const uid = prev();
    if (!uid) seek(0);
  };

  return (
    <div
      className="zd-dock-wrap"
      data-hidden={visible ? "false" : "true"}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <div className="zd-dock glass-dock">
        <div className="zd-dock-controls">
          <IconButton label="上一首" onClick={handlePrev}>
            <PrevIcon />
          </IconButton>
          <IconButton
            label={playing ? "暂停" : "播放"}
            size={42}
            onClick={toggle}
            active={playing}
            className="zd-dock-play"
          >
            {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
          </IconButton>
          <IconButton label="下一首" onClick={next}>
            <NextIcon />
          </IconButton>
        </div>

        <div className="zd-dock-track">
          <div className="zd-dock-meta">
            <span className="zd-dock-title">{currentTrack?.title ?? "未在播放"}</span>
            {currentTrack?.author ? (
              <span className="zd-dock-sub">{currentTrack.author}</span>
            ) : null}
          </div>
          <div className="zd-dock-progress">
            <span className="zd-dock-time">{formatTime(progress)}</span>
            <Slider
              label="播放进度"
              value={duration > 0 ? Math.min(progress, duration) : 0}
              max={duration || 1}
              step={0.1}
              onChange={seek}
            />
            <span className="zd-dock-time" data-align="start">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="zd-dock-controls zd-dock-controls-end">
          <span className="zd-dock-mode" data-mode={playMode}>
            <IconButton
              label={`播放模式：${playModeMeta.label}（点击切换）`}
              onClick={cyclePlayMode}
              active={playMode !== "sequential"}
              className="zd-dock-optional"
            >
              {playMode === "shuffle" ? (
                <ShuffleIcon />
              ) : (
                <span className="zd-dock-repeat">
                  <RepeatIcon size={14} />
                  <span>{playMode === "repeat-one" ? "1" : "∞"}</span>
                </span>
              )}
            </IconButton>
            <span className="zd-dock-mode-tip" role="tooltip">
              <strong>{playModeMeta.short}</strong>
              <span>{playModeMeta.label}</span>
              <span className="zd-dock-mode-hint">{playModeMeta.hint} · 点击切换</span>
            </span>
          </span>

          <Popover
            align="end"
            label="音量与淡入淡出"
            trigger={({ toggle: togglePopover }) => (
              <IconButton
                label="音量"
                onClick={togglePopover}
                active={muted || volume === 0}
              >
                <VolumeIcon />
              </IconButton>
            )}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, width: 210 }}>
              <IconButton
                label={muted ? "取消静音" : "静音"}
                size={30}
                onClick={toggleMute}
                active={muted}
              >
                <VolumeIcon size={14} />
              </IconButton>
              <Slider
                label="音量"
                value={muted ? 0 : volume}
                onChange={(value) => {
                  if (muted && value > 0) toggleMute();
                  setVolume(value);
                }}
              />
              <span className="zd-dock-time">{Math.round((muted ? 0 : volume) * 100)}%</span>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="zd-popover-label">淡入</span>
                <Slider label="淡入时长" value={fadeIn} max={2} step={0.1} onChange={setFadeIn} />
                <span className="zd-dock-time">{fadeIn.toFixed(1)}s</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="zd-popover-label">淡出</span>
                <Slider label="淡出时长" value={fadeOut} max={2} step={0.1} onChange={setFadeOut} />
                <span className="zd-dock-time">{fadeOut.toFixed(1)}s</span>
              </div>
            </div>
          </Popover>

          {onEnterStage && currentTrack ? (
            <IconButton label="沉浸舞台" onClick={onEnterStage} active={inStage}>
              <StageIcon />
            </IconButton>
          ) : null}

          {currentTrack ? (
            <IconButton
              label="歌词"
              onClick={() => open("lyrics")}
              active={active === "lyrics"}
            >
              <LyricIcon />
            </IconButton>
          ) : null}

          <IconButton
            label="听歌识曲"
            onClick={() => open("recognizer")}
            active={active === "recognizer"}
          >
            <MicIcon />
          </IconButton>

          <IconButton
            label="AI 助手（Cmd+J）"
            onClick={() => open("assistant")}
            active={active === "assistant"}
          >
            <AiIcon />
          </IconButton>

          <IconButton
            label="搜索（Cmd+K）"
            onClick={() => open("search")}
            active={active === "search"}
          >
            <SearchIcon />
          </IconButton>

          <IconButton
            label="播放队列"
            onClick={() => open("queue")}
            active={active === "queue"}
          >
            <ListIcon />
          </IconButton>

          <IconButton
            label="设置"
            onClick={() => open("settings")}
            active={active === "settings"}
          >
            <SettingsIcon />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
