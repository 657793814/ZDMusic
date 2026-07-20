"use client";

import { useCallback, useRef, useState } from "react";

export type RecorderState = "idle" | "recording";
export type AudioFormat = "wav" | "webm-opus";

/**
 * MediaRecorder 录音 Hook
 * 返回 start / stop 方法，统一管理音频录制。
 * start 会请求麦克风权限。
 * stop 会返回录音 Blob。
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const formatRef = useRef<AudioFormat>("webm-opus");

  const start = useCallback(async () => {
    // 请求麦克风
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // 选择最佳 mimeType
    let mimeType = "audio/webm;codecs=opus";
    let format: AudioFormat = "webm-opus";
    if (MediaRecorder.isTypeSupported("audio/wav")) {
      mimeType = "audio/wav";
      format = "wav";
    } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      mimeType = "audio/webm;codecs=opus";
    } else if (MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start();
    recorderRef.current = recorder;
    formatRef.current = format;
    setState("recording");
  }, []);

  const stop = useCallback(() => {
    return new Promise<Blob>((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(new Blob([]));
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        // 释放麦克风
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        recorderRef.current = null;
        setState("idle");
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const cleanup = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setState("idle");
  }, []);

  return { state, start, stop, cleanup };
}
