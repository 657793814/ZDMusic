"use client";

import { AmbientBackground, DanmakuOverlay, FullScreenVisualizer, Logo, ModeSwitch, LyricsDisplay } from "@/app/components/atoms";
import {
  AgentChat,
  AlbumGrid,
  ClockPanel,
  Player,
  Playlist,
  StatusBar,
} from "@/app/components/organisms";
import { Equalizer } from "@/app/components/molecules/Equalizer";
import { SleepTimer } from "@/app/components/molecules/SleepTimer";
import { SettingsDialog } from "@/app/components/molecules/SettingsDialog";
import { usePlayer } from "@/app/context/PlayerContext";
import { useI18n } from "@/app/lib/i18n";
import { useEqualizer } from "@/app/hooks/useEqualizer";
import { useKeyboardShortcuts } from "@/app/hooks/useKeyboardShortcuts";
import { useMediaSession } from "@/app/hooks/useMediaSession";
import { useSleepTimer } from "@/app/hooks/useSleepTimer";
import { useEffect, useRef, useState } from "react";
import { useLyrics } from "@/app/hooks/useLyrics";

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAlbumGrid, setShowAlbumGrid] = useState(false);
  const { analyser, state, vizReady, flipped, toggleFlip, lyricsOpen, toggleLyrics, seek, next, prev, togglePlay, stop, setVolume } = usePlayer();
  const prevVolumeRef = useRef(0.8);
  const lyricsData = useLyrics(state.current);
  const { lang, cycleLang } = useI18n();
  const mainRef = useRef<HTMLDivElement>(null);

  // Sleep timer
  const sleepTimer = useSleepTimer(stop);

  // Equalizer
  const eq = useEqualizer();
  const eqAudioRef = useRef<HTMLAudioElement | null>(null);

  // 🔑 强制获取键盘焦点（Tauri WKWebView 需要）
  // macOS webview 启动后不会自动传递键盘事件到 JS，
  // 必须有一个 focusable 元素实际拥有焦点才能接收
  useEffect(() => {
    const focusMain = () => {
      if (mainRef.current) {
        mainRef.current.focus({ preventScroll: true });
        // 如果聚焦失败，fallback 到 body
        if (document.activeElement !== mainRef.current) {
          document.body.focus();
        }
      }
    };
    // 立即聚焦
    focusMain();
    // 延迟重试（webview 还没加载完成时第一次聚焦可能失败）
    const t1 = setTimeout(focusMain, 100);
    const t2 = setTimeout(focusMain, 500);
    // 窗口重新获得焦点时
    window.addEventListener("focus", focusMain);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") focusMain();
    });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("focus", focusMain);
      document.removeEventListener("visibilitychange", focusMain);
    };
  }, []);



  // Keyboard shortcuts
  useKeyboardShortcuts({
    onTogglePlay: () => togglePlay(),
    onPrev: prev,
    onNext: next,
    onVolumeUp: () => setVolume(Math.min(1, state.volume + 0.05)),
    onVolumeDown: () => setVolume(Math.max(0, state.volume - 0.05)),
    onMute: () => {
      if (state.volume > 0) {
        prevVolumeRef.current = state.volume;
        setVolume(0);
      } else {
        setVolume(prevVolumeRef.current);
      }
    },
  });

  // Media Session
  useMediaSession(state.current, state.playing, prev, next, seek);

  // ESC 退出全屏/歌词模式
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (flipped) toggleFlip();
        if (lyricsOpen) toggleLyrics();
        if (showAlbumGrid) setShowAlbumGrid(false);
      }
    };
    if (!flipped && !lyricsOpen) return;
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipped, lyricsOpen, toggleFlip, toggleLyrics, showAlbumGrid]);

  return (
    <>
      {/* 歌词模式 */}
      {lyricsOpen && (
        <LyricsDisplay
          syncedLyrics={lyricsData.synced}
          loading={lyricsData.loading}
          currentTime={state.progress}
          duration={state.duration}
          playing={state.playing}
          onSeek={seek}
          onExit={toggleLyrics}
          title={state.current?.title}
          artist={state.current?.author}
        />
      )}

      {/* 全屏沉浸模式 */}
      {flipped && (
        <FullScreenVisualizer
          analyser={analyser}
          playing={state.playing}
          onExit={toggleFlip}
        />
      )}

      {/* 正常 UI */}
      <AmbientBackground key={vizReady ? "bg-on" : "bg-off"} analyser={analyser} playing={state.playing} />
      <DanmakuOverlay />

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="flex h-dvh items-center justify-center overflow-hidden p-3 text-[color:var(--color-on-surface)] md:p-6 lg:p-8">
        <div
          ref={mainRef}
          tabIndex={0}
          className="flex h-[min(98dvh,75rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl outline-none"
          onKeyDown={(e) => {
            // 安全网：防止键盘事件逃逸
            e.stopPropagation();
          }}
          style={{
            backgroundColor: "var(--color-surface-raised)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          <header
            className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b px-4 py-4 md:px-6 md:py-5"
            style={{
              borderColor: "var(--color-outline-dim)",
              backgroundColor: "var(--color-surface-dim)",
            }}
          >
            <Logo />
            <nav aria-label="Main" className="flex flex-wrap items-center gap-3 md:gap-4">
              {/* 专辑视图切换 */}
              <button
                type="button"
                onClick={() => setShowAlbumGrid((v) => !v)}
                className="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
                style={{
                  borderColor: showAlbumGrid ? "var(--color-primary)" : "var(--color-outline-dim)",
                  color: showAlbumGrid ? "var(--color-primary)" : "var(--color-outline)",
                  fontFamily: "var(--font-body)",
                }}
                aria-label="专辑视图"
                title="专辑视图"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
                专辑
              </button>
              <SleepTimer
                active={sleepTimer.active}
                remaining={sleepTimer.remaining}
                onStart={sleepTimer.start}
                onStop={sleepTimer.stop}
                onAdd={sleepTimer.addMinutes}
              />
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                aria-label="设置"
                title="设置"
              >
                <span className="material-symbols-outlined text-[20px]">settings</span>
              </button>
              <button
                type="button"
                onClick={cycleLang}
                className="inline-flex h-8 min-w-[2.5rem] items-center justify-center rounded-full border px-2 text-[11px] font-semibold tracking-[var(--tracking-label)] transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
                style={{
                  borderColor: "var(--color-outline-dim)",
                  color: "var(--color-outline)",
                  fontFamily: "var(--font-body)",
                }}
                aria-label="切换语言"
                title="切换语言"
              >
                {lang === "zh-CN" ? "中" : "EN"}
              </button>
            </nav>
          </header>

          <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:grid md:grid-cols-2 md:gap-3 md:p-4">
            {/* 左侧 */}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
              {/* Player + EQ */}
              <Player />
              <Equalizer
                bands={eq.bands}
                onBandChange={eq.setBandGain}
                onPresetChange={(name, bands) => eq.applyPreset(name)}
                enabled={eq.enabled}
                onToggleEnabled={eq.toggleEnabled}
                currentPreset={eq.currentPreset}
              />

              {/* Playlist / AlbumGrid toggle */}
              {showAlbumGrid ? <AlbumGrid /> : <Playlist />}
            </div>

            {/* 右侧 */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
              <div className="shrink-0"><ClockPanel /></div>
              <AgentChat />
            </div>
          </main>

          <StatusBar />
        </div>
      </div>

      {/* 隐藏的 audio ref 供 EQ 使用 */}
      <audio ref={eqAudioRef} className="hidden" />
    </>
  );
}
