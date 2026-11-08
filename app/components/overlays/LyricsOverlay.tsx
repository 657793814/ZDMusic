"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { usePlayback, useQueue } from "@/app/context/player";
import { invalidateLyrics, useLyrics, type LyricLine } from "@/app/hooks/useLyrics";
import {
  DEFAULT_PREFS,
  loadUiPrefs,
  saveUiPrefs,
  type LyricAlign,
  type LyricPosition,
  type UiPrefs,
} from "@/app/lib/ui-prefs";
import { CloseIcon, LyricIcon } from "@/app/components/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const OFFSET_KEY = "zdmusic.lyric-offset.v1";

function loadOffset(trackId: string): number {
  try {
    const raw = window.localStorage.getItem(OFFSET_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, number>;
    const value = map[trackId];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function saveOffset(trackId: string, value: number) {
  try {
    const raw = window.localStorage.getItem(OFFSET_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    if (value === 0) delete map[trackId];
    else map[trackId] = value;
    window.localStorage.setItem(OFFSET_KEY, JSON.stringify(map));
  } catch {
    /* 忽略隐私模式写入失败 */
  }
}

function formatOffset(value: number): string {
  if (value === 0) return "同步";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}s`;
}

function lrcFromLines(lines: LyricLine[], plain: string | null): string {
  if (lines.length) {
    return lines
      .map((line) => {
        const mm = Math.floor(line.time / 60).toString().padStart(2, "0");
        const ss = (line.time % 60).toFixed(2).padStart(5, "0");
        return `[${mm}:${ss}]${line.text}`;
      })
      .join("\n");
  }
  return plain ?? "";
}

function decodeFile(buffer: ArrayBuffer): string {
  let text = new TextDecoder("utf-8").decode(buffer);
  if (!text.includes("\uFFFD")) return text.replace(/^\uFEFF/, "");
  try {
    text = new TextDecoder("gbk").decode(buffer);
  } catch {
    /* 浏览器不支持 GBK 时保留 UTF-8 */
  }
  return text.replace(/^\uFEFF/, "");
}

const SOURCE_LABEL: Record<string, string> = {
  local: "本地 .lrc",
  embedded: "内嵌歌词标签",
  lrclib: "LRCLIB 网络",
  custom: "自定义",
  none: "无来源",
};

export function LyricsOverlay() {
  const { active, close } = useOverlay();
  const { currentTrack } = useQueue();
  const { playing, progress, duration, seek, audioElement } = usePlayback();

  const [reloadToken, setReloadToken] = useState(0);
  const lyrics = useLyrics(currentTrack ?? null, reloadToken);

  const [prefs, setPrefs] = useState<UiPrefs>(DEFAULT_PREFS);
  const [offset, setOffset] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement | null>(null);
  const userScrolledRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotionRef = useRef(false);

  const trackId = currentTrack?.id ?? "";

  // 打开时读取偏好与偏移；关闭时清理临时编辑态
  useEffect(() => {
    if (active !== "lyrics") {
      setEditing(false);
      setNotice(null);
      setDraft("");
      return;
    }
    setPrefs(loadUiPrefs());
    setOffset(trackId ? loadOffset(trackId) : 0);
    setCurrentIdx(-1);
  }, [active, trackId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = query.matches;
    const onChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // 关闭时把偏移写盘
  useEffect(() => {
    if (!trackId) return;
    return () => {
      if (offset !== 0) saveOffset(trackId, offset);
    };
  }, [trackId, offset]);

  const lines = lyrics.synced;
  const hasTimed = lines.length > 0;

  // progress 每 250ms 变一次；用 ref 读取，避免 effect 被高频重建
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const readTime = useCallback((): number => {
    const element = audioElement;
    const base = element ? element.currentTime : progressRef.current;
    return base + offset;
  }, [audioElement, offset]);

  const indexForTime = useCallback(
    (time: number): number => {
      if (!lines.length) return -1;
      let lo = 0;
      let hi = lines.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lines[mid]!.time <= time) lo = mid;
        else hi = mid - 1;
      }
      return lines[lo]!.time <= time ? lo : -1;
    },
    [lines]
  );

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const list = listRef.current;
    const target = list?.children[index] as HTMLElement | undefined;
    target?.scrollIntoView({
      behavior: smooth && !reducedMotionRef.current ? "smooth" : "instant",
      block: "center",
    });
  }, []);

  // 打开 / 歌词到位 / 偏移变化时立刻定位，避免面板停在列表开头
  useEffect(() => {
    if (active !== "lyrics" || !hasTimed) return;
    const index = indexForTime(readTime());
    setCurrentIdx(index);
    if (index >= 0) scrollToIndex(index, false);
  }, [active, hasTimed, lines, offset, readTime, indexForTime, scrollToIndex]);

  // 时间推进：读音频元素，暂停时冻结高亮位置
  useEffect(() => {
    if (active !== "lyrics" || !hasTimed) return;
    let frame = 0;
    let lastIdx = currentIdx;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const next = indexForTime(readTime());
      if (next === lastIdx) return;
      lastIdx = next;
      setCurrentIdx(next);
      if (!userScrolledRef.current) scrollToIndex(next, true);
    };
    if (playing) frame = requestAnimationFrame(tick);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
    // currentIdx 只在启动时取一次，不作为依赖避免循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hasTimed, playing, offset, readTime, indexForTime, scrollToIndex]);

  const handleScroll = useCallback(() => {
    userScrolledRef.current = true;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      userScrolledRef.current = false;
    }, 2500);
  }, []);

  const changePrefs = useCallback((patch: Partial<UiPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveUiPrefs(next);
      return next;
    });
  }, []);

  const changeOffset = useCallback(
    (delta: number) => {
      setOffset((prev) => {
        const next = Math.max(-30, Math.min(30, Math.round((prev + delta) * 10) / 10));
        if (trackId) saveOffset(trackId, next);
        return next;
      });
    },
    [trackId]
  );

  const jumpToLine = useCallback(
    (time: number, index: number) => {
      seek(Math.max(0, time - offset));
      setCurrentIdx(index);
      scrollToIndex(index, false);
      userScrolledRef.current = false;
    },
    [seek, offset, scrollToIndex]
  );

  const openEditor = useCallback(() => {
    setDraft(lrcFromLines(lyrics.synced, lyrics.plain));
    setNotice(null);
    setEditing(true);
  }, [lyrics.synced, lyrics.plain]);

  const importFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      setDraft(decodeFile(buffer));
      setEditing(true);
      setNotice(`已读入 ${file.name}，确认后保存`);
    } catch {
      setNotice("读取失败：文件无法解析");
    }
  }, []);

  const persist = useCallback(async () => {
    if (!trackId) return;
    if (!draft.trim()) {
      setNotice("歌词内容为空，无法保存");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, content: draft }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; synced?: number };
      if (!res.ok) throw new Error(json.error ?? `保存失败（${res.status}）`);
      invalidateLyrics(trackId);
      setReloadToken((value) => value + 1);
      setEditing(false);
      setNotice(
        json.synced
          ? `已保存自定义歌词（${json.synced} 句带时间轴）`
          : "已保存纯文本歌词（无时间轴，不做逐行高亮）",
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [trackId, draft]);

  const clearLyrics = useCallback(async () => {
    if (!trackId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/lyrics", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId }),
      });
      const json = (await res.json()) as { ok?: boolean; removed?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? `清除失败（${res.status}）`);
      invalidateLyrics(trackId);
      setReloadToken((value) => value + 1);
      setEditing(false);
      setNotice(json.removed ? "已清除本地歌词文件，将重新在线匹配" : "本地没有可清除的歌词文件");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "清除失败");
    } finally {
      setSaving(false);
    }
  }, [trackId]);

  const position: LyricPosition = prefs.lyricPosition;
  const align: LyricAlign = prefs.lyricAlign;

  const emptyHint = useMemo(() => {
    if (!currentTrack) return "当前没有在播放的曲目";
    if (lyrics.error) return `读取歌词失败：${lyrics.error}`;
    if (lyrics.loading) return "正在匹配歌词…";
    return "这首歌还没有歌词，可以导入 LRC 或自己粘贴一份";
  }, [currentTrack, lyrics.error, lyrics.loading]);

  return (
    <div className="zd-lyrics" data-stage-interactive data-align={align} data-position={position}>
      <div
        className="zd-lyrics-backdrop"
        style={{
          backgroundColor: `color-mix(in srgb, var(--zd-bg) ${Math.round(
            prefs.lyricBackdrop * 100,
          )}%, transparent)`,
        }}
      />

      <header className="zd-lyrics-head">
        <div className="zd-lyrics-head-left">
          <span className="zd-kicker">LYRICS</span>
          {currentTrack ? (
            <span className="zd-lyrics-meta">
              {currentTrack.title}
              {currentTrack.author ? ` — ${currentTrack.author}` : ""}
            </span>
          ) : null}
          {lyrics.source ? (
            <span className="zd-lyrics-source" data-source={lyrics.source}>
              {SOURCE_LABEL[lyrics.source] ?? lyrics.source}
            </span>
          ) : null}
        </div>

        <div className="zd-lyrics-head-right">
          <div className="zd-lyrics-offset" role="group" aria-label="歌词偏移微调">
            <button type="button" onClick={() => changeOffset(-0.1)} aria-label="歌词提前 0.1 秒">
              −0.1
            </button>
            <span data-active={offset !== 0 ? "true" : "false"}>{formatOffset(offset)}</span>
            <button type="button" onClick={() => changeOffset(0.1)} aria-label="歌词延后 0.1 秒">
              +0.1
            </button>
            {offset !== 0 ? (
              <button type="button" className="zd-lyrics-offset-reset" onClick={() => changeOffset(-offset)}>
                重置
              </button>
            ) : null}
          </div>
          <button type="button" className="zd-lyrics-action" onClick={openEditor}>
            编辑 / 粘贴
          </button>
          <button type="button" className="zd-lyrics-close" onClick={close} aria-label="关闭歌词">
            <CloseIcon size={14} />
          </button>
        </div>
      </header>

      {editing ? (
        <div className="zd-lyrics-editor">
          <textarea
            className="zd-lyrics-textarea"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="把 LRC 或纯文本歌词粘贴到这里，支持 [00:12.50] 时间轴"
            spellCheck={false}
          />
          <div className="zd-lyrics-editor-foot">
            <label className="zd-lyrics-import">
              <input
                type="file"
                accept=".lrc,.txt,text/plain"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                  event.target.value = "";
                }}
              />
              导入 LRC 文件
            </label>
            <span className="zd-lyrics-editor-note">{notice ?? "保存后写入同目录同名 .lrc，下次自动加载"}</span>
            <button type="button" onClick={() => setEditing(false)} disabled={saving}>
              取消
            </button>
            <button type="button" className="zd-lyrics-primary" onClick={persist} disabled={saving}>
              {saving ? "保存中…" : "保存歌词"}
            </button>
            <button type="button" onClick={clearLyrics} disabled={saving}>
              清除本地歌词
            </button>
          </div>
        </div>
      ) : (
        <div className="zd-lyrics-body" ref={containerRef} onScroll={handleScroll} onWheel={handleScroll}>
          {hasTimed ? (
            <ol className="zd-lyrics-lines" ref={listRef} data-align={align}>
              {lines.map((line, index) => (
                <li key={`${index}-${line.time}`}>
                  <button
                    type="button"
                    className="zd-lyrics-line"
                    data-state={
                      index === currentIdx ? "current" : index < currentIdx ? "past" : "future"
                    }
                    onClick={() => jumpToLine(line.time, index)}
                  >
                    {line.text}
                  </button>
                </li>
              ))}
            </ol>
          ) : lyrics.plain ? (
            <p className="zd-lyrics-plain">{lyrics.plain}</p>
          ) : (
            <div className="zd-lyrics-empty">
              <LyricIcon size={22} />
              <p>{emptyHint}</p>
              {currentTrack ? (
                <div className="zd-lyrics-empty-actions">
                  <button type="button" onClick={openEditor}>
                    粘贴歌词
                  </button>
                  <label className="zd-lyrics-import">
                    <input
                      type="file"
                      accept=".lrc,.txt,text/plain"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void importFile(file);
                        event.target.value = "";
                      }}
                    />
                    导入 LRC 文件
                  </label>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {!editing && notice ? <p className="zd-lyrics-notice">{notice}</p> : null}

      <footer className="zd-lyrics-tools">
        <div className="zd-lyrics-tool">
          <span>位置</span>
          <button type="button" data-active={position === "center" ? "true" : "false"} onClick={() => changePrefs({ lyricPosition: "center" })}>
            居中
          </button>
          <button type="button" data-active={position === "bottom" ? "true" : "false"} onClick={() => changePrefs({ lyricPosition: "bottom" })}>
            底部
          </button>
        </div>
        <div className="zd-lyrics-tool">
          <span>对齐</span>
          {(["left", "center", "right"] as LyricAlign[]).map((value) => (
            <button
              key={value}
              type="button"
              data-active={align === value ? "true" : "false"}
              onClick={() => changePrefs({ lyricAlign: value })}
            >
              {value === "left" ? "左" : value === "center" ? "中" : "右"}
            </button>
          ))}
        </div>
        <div className="zd-lyrics-tool">
          <span>字号</span>
          {[0.85, 1, 1.15].map((value) => (
            <button
              key={value}
              type="button"
              data-active={prefs.lyricScale === value ? "true" : "false"}
              onClick={() => changePrefs({ lyricScale: value })}
            >
              {Math.round(value * 100)}%
            </button>
          ))}
        </div>
        <label className="zd-lyrics-tool zd-lyrics-tool-range">
          <span>背景</span>
          <input
            type="range"
            min={0}
            max={0.8}
            step={0.02}
            value={prefs.lyricBackdrop}
            onChange={(event) => changePrefs({ lyricBackdrop: Number(event.target.value) })}
            aria-label="歌词背景透明度"
          />
          <span className="zd-lyrics-tool-value">{Math.round(prefs.lyricBackdrop * 100)}%</span>
        </label>
        <span className="zd-lyrics-hint">
          {playing ? "点击任意一行跳转到该句" : "已暂停 · 高亮位置保持不变"}
        </span>
      </footer>
    </div>
  );
}
