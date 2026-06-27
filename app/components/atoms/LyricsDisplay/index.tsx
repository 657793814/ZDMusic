"use client";

import type { LyricLine } from "@/app/hooks/useLyrics";
import { useCallback, useEffect, useRef, useState } from "react";

const PRESET_COLORS = [
  { primary: "#f472b6", glow: "rgba(244,114,182,0.25)" },
  { primary: "#60a5fa", glow: "rgba(96,165,250,0.25)" },
  { primary: "#a78bfa", glow: "rgba(167,139,250,0.25)" },
  { primary: "#34d399", glow: "rgba(52,211,153,0.25)" },
  { primary: "#fb923c", glow: "rgba(251,146,60,0.25)" },
];

type Props = {
  syncedLyrics: LyricLine[];
  loading: boolean;
  currentTime: number;
  duration: number;
  playing: boolean;
  onSeek: (time: number) => void;
  onExit: () => void;
  title?: string;
  artist?: string;
};

export function LyricsDisplay({
  syncedLyrics,
  loading,
  currentTime,
  duration,
  playing,
  onSeek,
  onExit,
  title,
  artist,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const userScrollingRef = useRef(false);
  const programmaticScrollRef = useRef(false);

  // 主题色
  const [theme, setTheme] = useState(PRESET_COLORS[0]);
  useEffect(() => {
    setTheme(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]!);
  }, []);

  // ⏱ 手动偏移
  const [timeOffset, setTimeOffset] = useState(0);

  // 可变的引用值
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime + timeOffset;
  const syncedLyricsRef = useRef(syncedLyrics);
  syncedLyricsRef.current = syncedLyrics;

  const currentIdx = useRef(0);

  const scrollToLine = useCallback((idx: number, smooth = true) => {
    const container = containerRef.current;
    const lines = linesRef.current;
    if (!container || !lines) return;
    const lineEl = lines.children[idx] as HTMLElement | undefined;
    if (!lineEl) return;
    programmaticScrollRef.current = true;
    lineEl.scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "center" });
  }, []);
  const scrollToLineRef = useRef(scrollToLine);
  scrollToLineRef.current = scrollToLine;

  // ── 动画循环 ──
  useEffect(() => {
    if (!syncedLyrics.length) return;
    let running = true;

    // 初始渲染 + 滚动到第一行
    if (linesRef.current) {
      updateLineStyles(linesRef.current, -1, theme);
      if (syncedLyricsRef.current.length > 0) {
        scrollToLineRef.current(0, false);
      }
    }

    const tick = () => {
      if (!running) return;
      rafRef.current = requestAnimationFrame(tick);

      const time = currentTimeRef.current;
      const lines = syncedLyricsRef.current;

      // 二分查找当前行
      let lo = 0, hi = lines.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lines[mid].time <= time) lo = mid;
        else hi = mid - 1;
      }
      const nextIdx = lo;

      const changed = nextIdx !== currentIdx.current;
      currentIdx.current = nextIdx;

      // 自动滚动
      if (changed && !userScrollingRef.current) {
        programmaticScrollRef.current = true;
        scrollToLineRef.current(nextIdx);
      }

      // 更新行样式（仅行变化时）
      if (linesRef.current && changed) {
        updateLineStyles(linesRef.current, nextIdx, theme);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [syncedLyrics.length, theme]);

  const handleScroll = useCallback(() => {
    if (programmaticScrollRef.current) {
      programmaticScrollRef.current = false;
      return;
    }
    userScrollingRef.current = true;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 3000);
  }, []);

  const handleLineClick = useCallback(
    (time: number) => {
      const adjusted = Math.max(0, time - timeOffset);
      if (adjusted >= 0 && adjusted <= duration) {
        onSeek(adjusted);
        userScrollingRef.current = false;
      }
    },
    [onSeek, duration, timeOffset]
  );

  const hasLyrics = syncedLyrics.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#0a0a12" }}>
      {/* ─── 顶部栏 ─── */}
      <header
        className="flex shrink-0 items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          {/* 偏移调整 */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTimeOffset((v) => Math.max(-30, v - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition-colors hover:bg-white/10"
              style={{ color: timeOffset !== 0 ? theme.primary : "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
              title="歌词延迟 1 秒"
            >
              −1s
            </button>
            <span
              className="text-[10px] tabular-nums min-w-[2.5rem] text-center"
              style={{ color: timeOffset !== 0 ? theme.primary : "rgba(255,255,255,0.3)", fontFamily: "var(--font-body)", letterSpacing: "0.02em" }}
            >
              {timeOffset > 0 ? `+${timeOffset}s` : timeOffset < 0 ? `${timeOffset}s` : "同步"}
            </span>
            <button
              type="button"
              onClick={() => setTimeOffset((v) => Math.min(30, v + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition-colors hover:bg-white/10"
              style={{ color: timeOffset !== 0 ? theme.primary : "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
              title="歌词提前 1 秒"
            >
              +1s
            </button>
            {timeOffset !== 0 && (
              <button
                type="button"
                onClick={() => setTimeOffset(0)}
                className="flex h-7 items-center rounded-full px-2 text-[10px] transition-colors hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                重置
              </button>
            )}
          </div>

          {(title || artist) && (
            <span
              style={{
                color: "rgba(255,255,255,0.35)",
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                letterSpacing: "0.02em",
                marginLeft: "0.5rem",
              }}
            >
              {title}{artist ? ` — ${artist}` : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-body)", fontSize: "11px", letterSpacing: "0.1em" }}>
            ESC 退出
          </span>
          <button
            type="button"
            onClick={onExit}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}
            aria-label="退出歌词"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* ─── 歌词主体 ─── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto select-none scroll-smooth"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.08) transparent",
          WebkitOverflowScrolling: "touch",
          maskImage: "linear-gradient(to bottom, transparent, black 6%, black 94%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 6%, black 94%, transparent)",
        }}
        onScroll={handleScroll}
        onTouchStart={handleScroll}
      >
        {hasLyrics ? (
          <div ref={linesRef} className="flex flex-col items-center py-[35vh]">
            {syncedLyrics.map((line, i) => (
              <button
                key={i}
                type="button"
                data-line-idx={i}
                onClick={() => handleLineClick(line.time)}
                className="group w-full cursor-pointer px-8 py-1 text-center transition-all duration-200 hover:bg-white/5"
              >
                <span
                  data-lyric-text
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "clamp(1.1rem, 4vw, 1.6rem)",
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                    lineHeight: 2,
                    color: "rgba(255,255,255,0.2)",
                    transition: "none",
                  }}
                >
                  {line.text}
                </span>
              </button>
            ))}
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div
                className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: theme.primary }}
              />
              <p style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-body)", fontSize: "12px", letterSpacing: "0.05em" }}>
                正在获取歌词…
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-body)", fontSize: "14px", letterSpacing: "0.05em" }}>
              暂无歌词
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DOM 辅助 ──

function updateLineStyles(
  linesEl: HTMLDivElement,
  currentIdx: number,
  theme: (typeof PRESET_COLORS)[number],
) {
  for (let i = 0; i < linesEl.children.length; i++) {
    const span = linesEl.children[i].querySelector('[data-lyric-text]') as HTMLElement | null;
    if (!span) continue;

    if (currentIdx < 0 || i < currentIdx) {
      // 已唱过
      span.style.color = "rgba(255,255,255,0.5)";
      span.style.textShadow = "none";
    } else if (i > currentIdx) {
      // 未唱
      span.style.color = "rgba(255,255,255,0.2)";
      span.style.textShadow = "none";
    } else {
      // 当前行
      span.style.color = theme.primary;
      span.style.textShadow = `0 0 12px ${theme.glow}`;
    }
  }
}
