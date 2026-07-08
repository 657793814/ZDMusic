"use client";

import { AmbientBackground, DanmakuOverlay, FullScreenVisualizer, Logo, ModeSwitch, LyricsDisplay } from "@/app/components/atoms";
import {
  AgentChat,
  ClockPanel,
  Player,
  Playlist,
  StatusBar,
} from "@/app/components/organisms";
import { SettingsDialog } from "@/app/components/molecules/SettingsDialog";
import { usePlayer } from "@/app/context/PlayerContext";
import { useI18n } from "@/app/lib/i18n";
import { useEffect, useState } from "react";
import { useLyrics } from "@/app/hooks/useLyrics";

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { analyser, state, vizReady, flipped, toggleFlip, lyricsOpen, toggleLyrics, seek } = usePlayer();
  const lyricsData = useLyrics(state.current);
  const { lang, cycleLang } = useI18n();

  // ESC 退出全屏/歌词模式
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (flipped) toggleFlip();
        if (lyricsOpen) toggleLyrics();
      }
    };
    if (!flipped && !lyricsOpen) return;
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipped, lyricsOpen, toggleFlip, toggleLyrics]);

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

      {/* 正常 UI（点击按钮显示全屏模式，正常 UI 自动隐藏） */}
      <AmbientBackground key={vizReady ? "bg-on" : "bg-off"} analyser={analyser} playing={state.playing} />

      <DanmakuOverlay />

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="flex h-dvh items-center justify-center overflow-hidden p-3 text-[color:var(--color-on-surface)] md:p-6 lg:p-8">
        <div
          className="flex h-[min(98dvh,75rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl"
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
              <ModeSwitch />
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
            {/* 左侧：Player + Playlist */}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
              <Player />
              <Playlist />
            </div>

            {/* 右侧：ClockPanel + AgentChat */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
              <div className="shrink-0"><ClockPanel /></div>
              <AgentChat />
            </div>
          </main>

          <StatusBar />
        </div>
      </div>
    </>
  );
}
