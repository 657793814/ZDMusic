"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { useLibrary, useQueue } from "@/app/context/player";
import { useRecorder } from "@/app/lib/useRecorder";
import { CloseIcon, MicIcon, PlayIcon } from "@/app/components/ui/icons";
import { useCallback, useEffect, useRef, useState } from "react";

type RecognizeResult = {
  title: string;
  artists: string;
  album?: string;
  local?: boolean;
  score?: number;
  trackId?: string;
};

type Phase = "idle" | "recording" | "processing" | "result" | "error";

const MAX_SECONDS = 15;

/** 把服务端/浏览器的错误翻译成用户能直接照做的中文提示 */
function explain(raw: string): { message: string; hint: string | null } {
  if (/ACRCloud 密钥|未配置|未配置识曲/.test(raw)) {
    return {
      message: raw,
      hint: "打开 设置 → 听歌识曲，填入 ACRCloud 的 Access Key / Secret；也可以切换成「本地指纹」模式。",
    };
  }
  if (/fpcalc|chromaprint/.test(raw)) {
    return {
      message: raw,
      hint: "终端运行 brew install chromaprint 后再试，或在设置里切换为云端模式。",
    };
  }
  if (/ffmpeg/.test(raw)) {
    return {
      message: raw,
      hint: "终端运行 brew install ffmpeg 后再试。",
    };
  }
  if (/No result|No Result|no match/i.test(raw)) {
    return {
      message: "没有识别出歌曲",
      hint: "换一段更清晰、有主旋律的录音重试（建议 10–15 秒，尽量靠近声源）。",
    };
  }
  if (/未在本地曲库|未识别到歌曲|未找到匹配/.test(raw)) {
    return {
      message: raw,
      hint: "换一段更清晰、有主旋律的 10–15 秒录音重试；本地模式只能认出已入库的歌曲。",
    };
  }
  if (/NotAllowedError|Permission|权限/.test(raw)) {
    return {
      message: "麦克风权限被拒绝",
      hint: "在 系统设置 → 隐私与安全性 → 麦克风 中允许 ZDMusic，然后重新打开识曲。",
    };
  }
  if (/NotFoundError|Requested device not found|设备/.test(raw)) {
    return {
      message: "没有找到可用的麦克风",
      hint: "接上麦克风或在系统设置里选择输入设备后重试。",
    };
  }
  return { message: raw, hint: null };
}

export function RecognizerOverlay() {
  const { close } = useOverlay();
  const queue = useQueue();
  const { getTrack } = useLibrary();
  const recorder = useRecorder();

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RecognizeResult | null>(null);
  const [error, setError] = useState<{ message: string; hint: string | null } | null>(null);

  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const clearTimers = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      recorderRef.current.cleanup();
    };
  }, [clearTimers]);

  const recognize = useCallback(async (blob: Blob) => {
    setPhase("processing");
    try {
      const res = await fetch("/api/music-recognize", { method: "POST", body: blob });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        track?: RecognizeResult | null;
      };
      if (!res.ok && !data.error) {
        setError({ message: `识曲服务返回 ${res.status}`, hint: "稍后再试，或检查设置里的识曲模式。" });
        setPhase("error");
        return;
      }
      if (data.error) {
        setError(explain(data.error));
        setPhase("error");
        return;
      }
      if (data.track) {
        setResult(data.track);
        setPhase("result");
        return;
      }
      setError({ message: "未识别到歌曲", hint: "换一段录音再试，尽量靠近声源。" });
      setPhase("error");
    } catch (err) {
      setError({
        message: `识曲请求失败：${err instanceof Error ? err.message : "网络错误"}`,
        hint: "检查网络后重试。",
      });
      setPhase("error");
    }
  }, []);

  const finishRecording = useCallback(async () => {
    clearTimers();
    const blob = await recorder.stop();
    if (blob.size < 2000) {
      setError({ message: "录音太短", hint: "至少录制 5 秒，建议 10–15 秒。" });
      setPhase("error");
      return;
    }
    await recognize(blob);
  }, [clearTimers, recorder, recognize]);

  const start = useCallback(async () => {
    setError(null);
    setResult(null);
    setElapsed(0);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({
        message: "当前环境不支持录音",
        hint: "需要在支持麦克风的桌面环境运行，并允许麦克风权限。",
      });
      setPhase("error");
      return;
    }
    try {
      await recorder.start();
      setPhase("recording");
      tickTimerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
      stopTimerRef.current = setTimeout(() => {
        void finishRecording();
      }, MAX_SECONDS * 1000);
    } catch (err) {
      setError(explain(err instanceof Error ? err.message: String(err)));
      setPhase("error");
    }
  }, [recorder, finishRecording]);

  const handlePrimary = useCallback(() => {
    if (phase === "idle" || phase === "error" || phase === "result") {
      void start();
      return;
    }
    if (phase === "recording") {
      void finishRecording();
    }
  }, [phase, start, finishRecording]);

  const handlePlay = useCallback(() => {
    if (!result?.trackId) return;
    const track = getTrack(result.trackId);
    if (!track) return;
    queue.replaceQueue([track], { play: true, origin: "library" });
    close();
  }, [result, getTrack, queue, close]);

  const localTrack = result?.trackId ? getTrack(result.trackId) : null;
  const canPlay = !!(result && localTrack);

  const primaryLabel =
    phase === "idle"
      ? "开始识别"
      : phase === "recording"
        ? "停止并识别"
        : phase === "processing"
          ? "识别中…"
          : "重新识别";

  return (
    <>
      <div className="zd-recognizer-backdrop" onClick={close} aria-hidden />
      <section
        className="zd-recognizer glass-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="听歌识曲"
      >
        <header className="zd-recognizer-head">
          <span className="zd-kicker">LISTEN</span>
          <button
            type="button"
            className="zd-recognizer-close"
            aria-label="关闭识曲"
            onClick={close}
          >
            <CloseIcon size={13} />
          </button>
        </header>

        <div className="zd-recognizer-body">
          <div className="zd-recognizer-mic" data-phase={phase} aria-hidden>
            <MicIcon size={20} />
            <span className="zd-recognizer-wave">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>

          <h2 className="zd-recognizer-title">听歌识曲</h2>

          {phase === "idle" ? (
            <p className="zd-recognizer-copy">
              点击开始后录制 {MAX_SECONDS} 秒环境声，识别结果会在下方显示。
              <br />
              本地模式只比对已入库歌曲；云端模式需要 ACRCloud 密钥。
            </p>
          ) : null}

          {phase === "recording" ? (
            <p className="zd-recognizer-copy">
              正在录音 {elapsed}s / {MAX_SECONDS}s，请让歌曲靠近麦克风。
            </p>
          ) : null}

          {phase === "processing" ? (
            <p className="zd-recognizer-copy">正在比对指纹，请稍候…</p>
          ) : null}

          {phase === "result" && result ? (
            <div className="zd-recognizer-result">
              <span className="zd-recognizer-badge">
                {result.local ? "本地指纹匹配" : "云端识别"}
                {result.local && result.score != null
                  ? ` · ${Math.round(result.score * 100)}%`
                  : ""}
              </span>
              <strong className="zd-recognizer-result-title">{result.title || "未知歌曲"}</strong>
              <span className="zd-recognizer-result-sub">
                {result.artists || "未知歌手"}
                {result.album ? ` · ${result.album}` : ""}
              </span>
              {!canPlay ? (
                <span className="zd-recognizer-result-note">
                  这首不在本地曲库，暂不能直接播放；可以先用搜索或下载入库后再听。
                </span>
              ) : null}
            </div>
          ) : null}

          {phase === "error" && error ? (
            <div className="zd-recognizer-error">
              <strong>{error.message}</strong>
              {error.hint ? <span>{error.hint}</span> : null}
            </div>
          ) : null}
        </div>

        <footer className="zd-recognizer-actions">
          {phase === "result" && canPlay ? (
            <button type="button" className="zd-recognizer-primary" onClick={handlePlay}>
              <PlayIcon size={12} />
              播放这首
            </button>
          ) : (
            <button
              type="button"
              className="zd-recognizer-primary"
              onClick={handlePrimary}
              disabled={phase === "processing"}
            >
              {phase === "recording" ? <span className="zd-recognizer-stop" aria-hidden /> : null}
              {primaryLabel}
            </button>
          )}
          <button type="button" className="zd-chip" onClick={close}>
            关闭
          </button>
        </footer>
      </section>
    </>
  );
}
