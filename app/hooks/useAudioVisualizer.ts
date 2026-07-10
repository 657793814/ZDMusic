"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Audio API 频谱分析 + 主音量控制 hook
 *
 * 连接一次 `createMediaElementSource`，永不重建。
 * 在音频链中插入一个 GainNode 用于控制主音量。
 *
 * ⚠️ 注意：一旦 audioElement 通过 createMediaElementSource 接入 AudioContext，
 *    audioElement.volume 和 audioElement.muted 将**失效**（Web Audio API 规范行为）。
 *    所以音量/静音必须通过 GainNode 控制。
 *
 * 音频链： source → masterGain → analyserNode → destination
 */
export function useAudioVisualizer(
  audioElement: HTMLAudioElement | null
) {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const connectedRef = useRef(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // audioElement 首次可用时连接（仅一次）
  useEffect(() => {
    if (!audioElement || connectedRef.current) return;

    try {
      const ctx = new AudioContext();
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.8;

      const source = ctx.createMediaElementSource(audioElement);

      // 主音量 GainNode
      const masterGain = ctx.createGain();
      masterGain.gain.value = audioElement.volume; // 继承当前音量

      // 音频链：source → masterGain → analyserNode → destination
      source.connect(masterGain);
      masterGain.connect(analyserNode);
      analyserNode.connect(ctx.destination);

      ctxRef.current = ctx;
      analyserRef.current = analyserNode;
      gainRef.current = masterGain;
      connectedRef.current = true;
      setAnalyser(analyserNode);

      if (ctx.state === "suspended") ctx.resume();
    } catch (err) {
      console.warn("AudioVisualizer: createMediaElementSource failed", err);
    }
  }, [audioElement]);

  /** 设置主音量（0~1），同时同步到 audioElement.volume（非 AudioContext 场景回退） */
  const setMasterGain = useCallback((value: number) => {
    const gain = gainRef.current;
    if (gain) {
      gain.gain.value = Math.max(0, Math.min(1, value));
    }
  }, []);

  /** 设置静音状态（不走 audioElement.muted，它对 AudioContext 无效） */
  const setMasterMuted = useCallback((muted: boolean) => {
    const gain = gainRef.current;
    if (gain) {
      gain.gain.value = muted ? 0 : 1;
    }
  }, []);

  // AudioContext 需要用户手势后恢复
  const ensureConnected = useCallback(() => {
    const ctx = ctxRef.current;
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
    return connectedRef.current;
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      ctxRef.current?.close();
      connectedRef.current = false;
    };
  }, []);

  return {
    analyser,
    ready: analyser !== null,
    ensureConnected,
    /** 控制主音量 GainNode（0~1） */
    setMasterGain,
    /** 控制主静音（true=静音，false=恢复） */
    setMasterMuted,
  };
}
