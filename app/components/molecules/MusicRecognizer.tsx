"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/lib/i18n";
import { useRecorder } from "@/app/lib/useRecorder";
import { useAgent } from "@/app/context/AgentContext";
import { usePlayer } from "@/app/context/PlayerContext";

type RecognizeResult = {
  title: string;
  artists: string;
  album?: string;
  durationMs: number;
  /** Cloud 模式 */
  acrId?: string;
  externalIds?: Record<string, string>;
  playOffsetMs?: number;
  /** Local 模式 */
  local?: boolean;
  score?: number;
  trackId?: string;
};

type Phase = "idle" | "recording" | "processing" | "result" | "error";

/**
 * 听歌识曲按钮组件
 * 点击录音 → 录制 10-15 秒 → 发送到 /api/music-recognize
 * 结果弹窗在按钮下方展示。
 */
export function MusicRecognizer() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<RecognizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const recorder = useRecorder();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 识曲按钮点击 */
  const handleClick = useCallback(() => {
    if (phase === "result" || phase === "error") {
      setPhase("idle");
      setResult(null);
      setError(null);
      setSuggestion(null);
      return;
    }

    if (phase === "recording") {
      clearTimeout(timerRef.current ?? undefined);
      setPhase("processing");
      recorder.stop().then((blob) => {
        if (blob.size < 2000) {
          setError("录音太短，请录制更长时间（建议 10-15 秒）");
          setPhase("error");
          return;
        }
        recognizeTrack(blob);
      });
      return;
    }

    // idle → 开始录音
    startRecording();
  }, [phase, recorder]);

  /** 开始录音 */
  const startRecording = useCallback(async () => {
    setError(null);
    setSuggestion(null);
    setResult(null);

    try {
      await recorder.start();
      setPhase("recording");

      // 15 秒自动停止
      timerRef.current = setTimeout(async () => {
        if (recorder.state !== "recording") return;
        setPhase("processing");
        const blob = await recorder.stop();
        if (blob.size < 2000) {
          setError("录音太短，请录制更长时间（建议 10-15 秒）");
          setPhase("error");
          return;
        }
        recognizeTrack(blob);
      }, 15000);
    } catch (e: any) {
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setError("麦克风权限被拒绝，请在系统设置中允许");
      } else {
        setError(`启动录音失败: ${e.message}`);
      }
      setPhase("error");
    }
  }, [recorder]);

  /** 发送音频识曲 */
  const recognizeTrack = useCallback(async (blob: Blob) => {
    try {
      const res = await fetch("/api/music-recognize", {
        method: "POST",
        body: blob,
      });
      const data = await res.json();

      if (data.error) {
        // 根据模式生成建议
        let suggestion = "";
        if (data.mode === "local") {
          if (data.error.includes("未在本地曲库")) {
            suggestion =
              "此歌曲不在指纹库中。可切换云端模式（设置 → 听歌识曲 → 云端）或手动添加歌曲后重建指纹。";
          } else if (data.error.includes("fpcalc")) {
            suggestion = "请运行 brew install chromaprint 安装 fpcalc，或切换云端模式。";
          }
        } else if (data.mode === "cloud") {
          if (data.error.includes("未配置")) {
            suggestion =
              "请在设置页面配置 ACRCloud 密钥，或切换本地模式（设置 → 听歌识曲 → 本地）。";
          }
        }
        setError(data.error);
        setSuggestion(suggestion);
        setPhase("error");
        return;
      }

      if (data.track) {
        setResult(data.track);
        setPhase("result");
      } else {
        setError("未识别到歌曲");
        setPhase("error");
      }
    } catch (e: any) {
      setError(`识曲失败: ${e.message}`);
      setPhase("error");
    }
  }, []);

  const agent = useAgent();
  const player = usePlayer();

  /** 播放已识别的歌曲 */
  const playTrack = useCallback(() => {
    if (!result) return;

    if (result.local && result.trackId) {
      // 本地模式：从当前播放列表中找到匹配的曲目并播放
      const match = player.state.playlist.find((t) => t.id === result.trackId || t.title === result.title);
      if (match) {
        player.playTrack(match);
      } else {
        agent.sendMessage(`搜索并播放歌曲：${result.title} ${result.artists}`);
      }
    } else {
      // Cloud 模式：由 AI 助手搜索并播放
      const query = `${result.title} ${result.artists}`.trim();
      agent.sendMessage(`搜索并播放歌曲：${query}`);
    }

    setPhase("idle");
    setResult(null);
  }, [result, agent, player]);

  return (
    <div className="relative">
      {/* 识曲按钮 */}
      <button
        type="button"
        onClick={handleClick}
        className="flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
        style={{
          borderColor:
            phase === "recording"
              ? "var(--color-error)"
              : "var(--color-outline-dim)",
          color:
            phase === "recording"
              ? "var(--color-error)"
              : phase === "result"
                ? "var(--color-primary)"
                : "var(--color-outline)",
          fontFamily: "var(--font-body)",
          backgroundColor:
            phase === "recording"
              ? "color-mix(in srgb, var(--color-error) 15%, transparent)"
              : "transparent",
        }}
        aria-label={t("musicRecognize")}
        title={t("musicRecognize")}
      >
        {phase === "recording" ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1.5" stroke="none" />
          </svg>
        ) : phase === "processing" ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="animate-spin">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M22 12a10 10 0 0 0-20 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
            <path d="M9 18V5l12-2v13" />
          </svg>
        )}
      </button>

      {/* 识曲结果弹出窗（下方展示） */}
      {phase === "result" && result && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setPhase("idle"); setResult(null); }}
          />
          <div
            className="absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl p-4 shadow-2xl"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-outline-dim)",
            }}
          >
            <button
              type="button"
              onClick={() => { setPhase("idle"); setResult(null); }}
              className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--color-outline)] hover:text-[color:var(--color-on-surface)]"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="mb-3 flex items-center gap-2">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 15%, transparent)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--color-primary)" }}>
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
                {t("musicRecognizeResult")}
              </span>
              {result.local && result.score != null && (
                <span className="ml-auto text-[10px]" style={{ color: "var(--color-outline)" }}>
                  {Math.round(result.score * 100)}%
                </span>
              )}
            </div>

            <div className="mb-3">
              <p className="truncate text-sm font-semibold" style={{ color: "var(--color-on-surface)" }}>
                {result.title || "未知歌曲"}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--color-outline)" }}>
                {result.artists || "未知歌手"}
                {result.album ? ` · ${result.album}` : ""}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={playTrack}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[color:var(--color-on-primary)] transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {t("play")}
              </button>
              <button
                type="button"
                onClick={() => { setPhase("idle"); setResult(null); }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ border: "1px solid var(--color-outline-dim)", color: "var(--color-outline)" }}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 错误提示弹出窗（下方展示） */}
      {phase === "error" && error && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setPhase("idle"); setError(null); setSuggestion(null); }}
          />
          <div
            className="absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl p-4 shadow-2xl"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-error)",
            }}
          >
            <button
              type="button"
              onClick={() => { setPhase("idle"); setError(null); setSuggestion(null); }}
              className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--color-outline)] hover:text-[color:var(--color-on-surface)]"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="mb-2 flex items-center gap-2">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: "color-mix(in srgb, var(--color-error) 20%, transparent)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: "var(--color-error)" }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <span className="text-xs font-medium" style={{ color: "var(--color-on-surface)" }}>
                {t("musicRecognizeError")}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--color-outline)" }}>
              {error}
            </p>
            {suggestion && (
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--color-primary)" }}>
                💡 {suggestion}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
