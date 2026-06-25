"use client";

import { AmbientBackground, DanmakuOverlay, FullScreenVisualizer, Logo, ModeSwitch } from "@/app/components/atoms";
import {
  AgentChat,
  ClockPanel,
  Player,
  Playlist,
  StatusBar,
} from "@/app/components/organisms";
import { usePlayer } from "@/app/context/PlayerContext";
import { useI18n } from "@/app/lib/i18n";
import { useEffect } from "react";

export default function Home() {
  const { analyser, state, vizReady, flipped, toggleFlip } = usePlayer();
  const { lang, cycleLang } = useI18n();

  // ESC 退出全屏模式
  useEffect(() => {
    if (!flipped) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        toggleFlip();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipped, toggleFlip]);

  return (
    <>
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

      <div className="flex min-h-[100dvh] items-center justify-center p-3 text-[color:var(--color-on-surface)] md:p-6 lg:p-8">
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
