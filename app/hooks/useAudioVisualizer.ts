"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Audio API 频谱分析 hook
 * 连接一次 `createMediaElementSource`，永不重建。
 * 返回 analyser（state）触发组件重渲染，而非 ref。
 */
export function useAudioVisualizer(
  audioElement: HTMLAudioElement | null
) {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const connectedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
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
      source.connect(analyserNode);
      analyserNode.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyserNode;
      connectedRef.current = true;
      setAnalyser(analyserNode);

      if (ctx.state === "suspended") ctx.resume();
    } catch (err) {
      console.warn("AudioVisualizer: createMediaElementSource failed", err);
    }
  }, [audioElement]);

  // AudioContext 需要用户手势后恢复
  const ensureConnected = useCallback(() => {
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
    return connectedRef.current;
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
      connectedRef.current = false;
    };
  }, []);

  return { analyser, ready: analyser !== null, ensureConnected };
}
