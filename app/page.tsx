"use client";

import { DanmakuOverlay, Logo, ModeSwitch } from "@/app/components/atoms";
import {
  AgentChat,
  ClockPanel,
  Player,
  Playlist,
  StatusBar,
} from "@/app/components/organisms";
import { useI18n } from "@/app/lib/i18n";

export default function Home() {
  const { lang, cycleLang } = useI18n();

  return (
    <>
      <DanmakuOverlay />
      <div className="dot-matrix-bg flex min-h-[100dvh] items-center justify-center p-3 text-[color:var(--color-on-surface)] md:p-6 lg:p-8">
        <div
          className="flex h-[min(98dvh,75rem)] w-full max-w-7xl flex-col overflow-hidden rounded-md border shadow-lg"
          style={{
            borderColor: "var(--color-outline-variant)",
            backgroundColor: "color-mix(in srgb, var(--color-surface) 97%, transparent)",
          }}
        >
          <header
            className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b px-4 py-3 md:px-6"
            style={{
              borderColor: "var(--color-outline-variant)",
              backgroundColor: "color-mix(in srgb, var(--color-surface-container-low) 94%, transparent)",
            }}
          >
            <Logo />
            <nav aria-label="Main" className="flex flex-wrap items-center gap-3 md:gap-4">
              <ModeSwitch />
              <button
                type="button"
                onClick={cycleLang}
                className="inline-flex h-8 min-w-[2.5rem] items-center justify-center rounded-sm border px-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
                style={{
                  borderColor: "var(--color-outline-variant)",
                  color: "var(--color-outline)",
                  fontFamily: "var(--font-headline)",
                }}
                aria-label="切换语言"
                title="切换语言"
              >
                {lang === "zh-CN" ? "中" : "EN"}
              </button>
            </nav>
          </header>

          <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:grid md:grid-cols-2 md:gap-6 md:p-6">
            {/* 左侧：Player + Playlist */}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
              <Player />
              <Playlist />
            </div>

            {/* 右侧：ClockPanel + AgentChat */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
              <ClockPanel />
              <AgentChat />
            </div>
          </main>

          <StatusBar />
        </div>
      </div>
    </>
  );
}
