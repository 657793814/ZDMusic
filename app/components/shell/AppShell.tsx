"use client";

/**
 * 三层骨架：舞台背景(z0) / Home & Stage(z4) / 控制条(z6) / 浮层(z30)。
 * P2/P3/P5：Home 首屏、舞台粒子与节拍镜头、搜索/队列/设置浮层。
 */

import { OverlayProvider } from "@/app/context/OverlayContext";
import { usePlayback, useQueue } from "@/app/context/player";
import { useKeyboardShortcuts } from "@/app/hooks/useKeyboardShortcuts";
import { useMediaSession } from "@/app/hooks/useMediaSession";
import { applyUiPrefs, loadUiPrefs } from "@/app/lib/ui-prefs";
import { useCallback, useEffect, useRef, useState } from "react";
import { DownloadToast } from "@/app/components/DownloadToast";
import { HomeView } from "./HomeView";
import { OverlayLayer } from "./OverlayLayer";
import { PlayerDock } from "./PlayerDock";
import { StageView } from "./StageView";

const HIDE_DELAY = 3000;

export function AppShell() {
  const queue = useQueue();
  const playback = usePlayback();

  const [dockVisible, setDockVisible] = useState(true);
  const [enteredStage, setEnteredStage] = useState(false);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dockHoverRef = useRef(false);

  // 用户偏好（强调色/密度/歌词字号）写进 CSS 变量
  useEffect(() => {
    applyUiPrefs(loadUiPrefs());
  }, []);

  // WKWebView 启动后不会自动获得键盘焦点
  useEffect(() => {
    try {
      document.body.focus();
    } catch {
      /* ignore */
    }
  }, []);

  const handlePrev = useCallback(() => {
    if (playback.progress > 3) {
      playback.seek(0);
      return;
    }
    const uid = queue.prev();
    if (!uid) playback.seek(0);
  }, [playback, queue]);

  const handleNext = useCallback(() => {
    queue.next();
  }, [queue]);

  const handleSeek = useCallback(
    (time: number) => {
      playback.seek(time);
    },
    [playback]
  );

  useKeyboardShortcuts({
    onTogglePlay: playback.toggle,
    onPrev: handlePrev,
    onNext: handleNext,
    onVolumeUp: () => playback.setVolume(Math.min(1, playback.volume + 0.05)),
    onVolumeDown: () => playback.setVolume(Math.max(0, playback.volume - 0.05)),
    onMute: playback.toggleMute,
  });

  useMediaSession(
    queue.currentTrack,
    playback.playing,
    handlePrev,
    handleNext,
    handleSeek
  );

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    // 暂停时不收起；鼠标停在底栏上也不收起
    if (!playback.playing || dockHoverRef.current) return;
    hideTimerRef.current = setTimeout(() => {
      if (!dockHoverRef.current) setDockVisible(false);
    }, HIDE_DELAY);
  }, [clearHideTimer, playback.playing]);

  const reveal = useCallback(() => {
    setDockVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  // 暂停立即显示；播放中开始计时
  useEffect(() => {
    if (!playback.playing) {
      clearHideTimer();
      setDockVisible(true);
      return;
    }
    reveal();
  }, [playback.playing, clearHideTimer, reveal]);

  // 任意移动 / 点击 / 触屏 / 按键都能唤出；底部热区内不收起
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!playback.playing) return;
      setDockVisible(true);
      if (event.clientY > window.innerHeight - 160 || dockHoverRef.current) {
        clearHideTimer();
      } else {
        scheduleHide();
      }
    };

    const onInteract = () => {
      if (!playback.playing) return;
      reveal();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onInteract, { passive: true });
    window.addEventListener("touchstart", onInteract, { passive: true });
    window.addEventListener("keydown", onInteract);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("touchstart", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, [playback.playing, clearHideTimer, scheduleHide, reveal]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  // 进入舞台 / 回到 Home 时先显示底栏
  const view = queue.currentTrack && enteredStage ? "stage" : "home";

  // 返回 Home 只退出沉浸视图：播放、队列、进度全部保留
  const exitStage = useCallback(() => {
    setEnteredStage(false);
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) focused.blur();
    try {
      document.body.focus();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (view === "stage") reveal();
    else {
      clearHideTimer();
      setDockVisible(true);
    }
  }, [view, reveal, clearHideTimer]);

  // 本会话真正开始播放后才进舞台；快照恢复但暂停时留在 Home
  useEffect(() => {
    if (playback.playing && queue.currentTrack) setEnteredStage(true);
  }, [playback.playing, queue.currentTrack]);

  useEffect(() => {
    if (!queue.currentTrack) setEnteredStage(false);
  }, [queue.currentTrack]);

  const handleDockHover = useCallback(
    (hovering: boolean) => {
      dockHoverRef.current = hovering;
      if (hovering) {
        clearHideTimer();
        setDockVisible(true);
      } else {
        scheduleHide();
      }
    },
    [clearHideTimer, scheduleHide]
  );

  return (
    <OverlayProvider>
      <div className="zd-app" data-view={view}>
        <div className="zd-stage-bg" aria-hidden />
        <HomeView active={view === "home"} />
        <StageView active={view === "stage"} onExit={exitStage} />
        <OverlayLayer />
        <DownloadToast />
        <button
          type="button"
          className="zd-handle"
          aria-label="显示或隐藏控制条"
          onPointerEnter={() => {
            dockHoverRef.current = true;
            reveal();
          }}
          onPointerLeave={() => {
            dockHoverRef.current = false;
            scheduleHide();
          }}
          onClick={() => {
            if (dockVisible) {
              clearHideTimer();
              setDockVisible(false);
            } else {
              reveal();
            }
          }}
        />
        <PlayerDock
          visible={dockVisible}
          onHover={handleDockHover}
          inStage={view === "stage"}
          onEnterStage={() => {
            if (queue.currentTrack) setEnteredStage(true);
          }}
        />
      </div>
    </OverlayProvider>
  );
}
