"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/lib/i18n";
import { useRecorder } from "@/app/lib/useRecorder";

type Props = {
  onRecognize: (text: string) => void;
  disabled?: boolean;
};

type Phase = "idle" | "recording" | "processing" | "done";

/**
 * 语音输入组件（四态：🎤 → ■ → ⏳ → ✈️）
 *
 * 点击录音 → MediaRecorder 采集音频
 * 点击停止 → 音频发到 /api/stt（阿里云 NLS）
 * 识别完成 → 点发送图标填入文本框
 */
export function VoiceInput({ onRecognize, disabled = false }: Props) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const recorder = useRecorder();
  const resultRef = useRef("");
  const onRecognizeRef = useRef(onRecognize);
  onRecognizeRef.current = onRecognize;

  // 卸载时释放录音资源
  useEffect(() => {
    return () => recorder.cleanup();
  }, [recorder]);

  /** 开始录音 */
  const startRecording = useCallback(async () => {
    setError(null);
    resultRef.current = "";

    try {
      await recorder.start();
      setPhase("recording");
    } catch (e: any) {
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setError(t("voicePermissionDenied"));
      } else {
        setError(t("voiceError"));
      }
    }
  }, [recorder, t]);

  /** 发送音频到后端识别 */
  const recognize = useCallback(async (blob: Blob) => {
    try {
      const res = await fetch("/api/stt", {
        method: "POST",
        body: blob,
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setPhase("idle");
        return;
      }

      if (data.text) {
        resultRef.current = data.text;
        setPhase("done");
      } else {
        setError(t("voiceNoSpeech"));
        setPhase("idle");
      }
    } catch (e: any) {
      setError(`${t("voiceError")}: ${e.message}`);
      setPhase("idle");
    }
  }, [t]);

  /** 停止录音并提交识别 */
  const stopRecording = useCallback(async () => {
    setPhase("processing");

    try {
      const blob = await recorder.stop();
      if (blob.size < 200) {
        setError(t("voiceNoSpeech"));
        setPhase("idle");
        return;
      }
      await recognize(blob);
    } catch (e: any) {
      setError(`${t("voiceError")}: ${e.message}`);
      setPhase("idle");
    }
  }, [recorder, recognize, t]);

  /** 发送结果 */
  const sendResult = useCallback(() => {
    const text = resultRef.current;
    resultRef.current = "";
    setPhase("idle");
    if (text && onRecognizeRef.current) {
      onRecognizeRef.current(text);
    }
  }, []);

  /** 点击切换四态 */
  const handleClick = useCallback(() => {
    if (phase === "done") {
      sendResult();
    } else if (phase === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  }, [phase, startRecording, stopRecording, sendResult]);

  return (
    <div className="relative flex items-center">
      {/* 浮动提示 */}
      {error && (
        <div
          className="absolute right-full mr-3 top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium shadow-lg"
          style={{ backgroundColor: "var(--color-error)", color: "#fff" }}
        >
          {error}
        </div>
      )}
      {phase === "recording" && (
        <div
          className="absolute right-full mr-3 top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium shadow-lg flex items-center gap-1.5"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-on-primary)",
          }}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-white animate-pulse" />
          {t("voiceListening")}
        </div>
      )}
      {phase === "processing" && (
        <div
          className="absolute right-full mr-3 top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium shadow-lg flex items-center gap-1.5"
          style={{
            backgroundColor: "var(--color-outline)",
            color: "var(--color-on-surface)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M22 12a10 10 0 0 0-20 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {t("voiceProcessing")}
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        aria-label={
          phase === "done"
            ? t("send")
            : phase === "recording"
              ? t("voiceStop")
              : t("voiceStart")
        }
        className={[
          "group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-150 outline-none",
          "focus-visible:ring-1 focus-visible:ring-[color:var(--color-primary)]",
          phase === "done"
            ? "border-[color:var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[color:var(--color-primary)]"
            : phase === "recording"
              ? "border-[color:var(--color-error)] bg-[color-mix(in_srgb,var(--color-error)_15%,transparent)] animate-pulse"
              : phase === "processing"
                ? "border-[color:var(--color-outline-dim)] text-[color:var(--color-outline)] pointer-events-none"
                : "border-[color:var(--color-outline-dim)] text-[color:var(--color-outline)] hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]",
        ].join(" ")}
        style={{ fontFamily: "var(--font-body)" }}
        disabled={disabled || phase === "processing"}
      >
        {phase === "done" ? (
          /* ✈️ 发送 */
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        ) : phase === "recording" ? (
          /* ■ 停止 */
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1.5" stroke="none" />
          </svg>
        ) : phase === "processing" ? (
          /* ⏳ 转圈 */
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M22 12a10 10 0 0 0-20 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          /* 🎤 麦克风 */
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
            <path
              d="M19 10v1a7 7 0 0 1-14 0v-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line x1="12" y1="18" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}

        {/* Tooltip */}
        <span
          className="pointer-events-none absolute -bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium tracking-[var(--tracking-label)] opacity-0 transition-opacity group-hover:opacity-100"
          style={{
            fontFamily: "var(--font-body)",
            backgroundColor: "var(--color-surface-raised)",
            color: "var(--color-on-surface)",
            border: "1px solid var(--color-outline-dim)",
          }}
        >
          {phase === "done"
            ? t("send")
            : phase === "recording"
              ? t("voiceStop")
              : phase === "processing"
                ? t("voiceProcessing")
                : t("voiceStart")}
        </span>
      </button>
    </div>
  );
}
