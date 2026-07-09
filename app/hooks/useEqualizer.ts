"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface EQBand {
  frequency: number;
  gain: number; // -12 to +12 dB
  type: BiquadFilterType;
}

export const EQ_DEFAULT_BANDS: EQBand[] = [
  { frequency: 32, gain: 0, type: "lowshelf" },
  { frequency: 64, gain: 0, type: "peaking" },
  { frequency: 125, gain: 0, type: "peaking" },
  { frequency: 250, gain: 0, type: "peaking" },
  { frequency: 500, gain: 0, type: "peaking" },
  { frequency: 1000, gain: 0, type: "peaking" },
  { frequency: 2000, gain: 0, type: "peaking" },
  { frequency: 4000, gain: 0, type: "peaking" },
  { frequency: 8000, gain: 0, type: "peaking" },
  { frequency: 16000, gain: 0, type: "highshelf" },
];

export const EQ_PRESETS: Record<string, EQBand[]> = {
  flat: EQ_DEFAULT_BANDS.map((b) => ({ ...b, gain: 0 })),
  pop: [
    { frequency: 32, gain: 2, type: "lowshelf" },
    { frequency: 64, gain: 3, type: "peaking" },
    { frequency: 125, gain: 1, type: "peaking" },
    { frequency: 250, gain: -1, type: "peaking" },
    { frequency: 500, gain: -2, type: "peaking" },
    { frequency: 1000, gain: 0, type: "peaking" },
    { frequency: 2000, gain: 3, type: "peaking" },
    { frequency: 4000, gain: 4, type: "peaking" },
    { frequency: 8000, gain: 3, type: "peaking" },
    { frequency: 16000, gain: 2, type: "highshelf" },
  ],
  rock: [
    { frequency: 32, gain: 4, type: "lowshelf" },
    { frequency: 64, gain: 3, type: "peaking" },
    { frequency: 125, gain: 2, type: "peaking" },
    { frequency: 250, gain: 0, type: "peaking" },
    { frequency: 500, gain: -1, type: "peaking" },
    { frequency: 1000, gain: 0, type: "peaking" },
    { frequency: 2000, gain: 2, type: "peaking" },
    { frequency: 4000, gain: 3, type: "peaking" },
    { frequency: 8000, gain: 2, type: "peaking" },
    { frequency: 16000, gain: 1, type: "highshelf" },
  ],
  classical: [
    { frequency: 32, gain: 3, type: "lowshelf" },
    { frequency: 64, gain: 2, type: "peaking" },
    { frequency: 125, gain: 1, type: "peaking" },
    { frequency: 250, gain: 1, type: "peaking" },
    { frequency: 500, gain: 2, type: "peaking" },
    { frequency: 1000, gain: 2, type: "peaking" },
    { frequency: 2000, gain: 1, type: "peaking" },
    { frequency: 4000, gain: 0, type: "peaking" },
    { frequency: 8000, gain: -1, type: "peaking" },
    { frequency: 16000, gain: -2, type: "highshelf" },
  ],
  vocal: [
    { frequency: 32, gain: -2, type: "lowshelf" },
    { frequency: 64, gain: -1, type: "peaking" },
    { frequency: 125, gain: 0, type: "peaking" },
    { frequency: 250, gain: 3, type: "peaking" },
    { frequency: 500, gain: 4, type: "peaking" },
    { frequency: 1000, gain: 4, type: "peaking" },
    { frequency: 2000, gain: 3, type: "peaking" },
    { frequency: 4000, gain: 1, type: "peaking" },
    { frequency: 8000, gain: 0, type: "peaking" },
    { frequency: 16000, gain: 0, type: "highshelf" },
  ],
};

/** 将频率数字转为显示标签（32 → "32", 1000 → "1k", 16000 → "16k"） */
export function formatFreqLabel(freq: number): string {
  if (freq >= 1000) {
    const n = freq / 1000;
    return n % 1 === 0 ? `${n}k` : `${n.toFixed(1)}k`;
  }
  return String(freq);
}

interface UseEqualizerOptions {
  /** 音频元素。提供后尝试插入 EQ 处理链 */
  audioElement?: HTMLAudioElement | null;
}

export function useEqualizer(options?: UseEqualizerOptions) {
  const audioElement = options?.audioElement ?? null;

  const [enabled, setEnabled] = useState(false);
  const [currentPreset, setCurrentPreset] = useState("flat");
  const [bands, setBands] = useState<EQBand[]>(() =>
    EQ_DEFAULT_BANDS.map((b) => ({ ...b, gain: 0 }))
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const bypassGainRef = useRef<GainNode | null>(null);
  const connectedRef = useRef(false);

  // 创建音频链（尝试连接 audioElement）
  useEffect(() => {
    // 清理已有连接
    if (connectedRef.current) {
      try {
        sourceRef.current?.disconnect();
        filtersRef.current.forEach((f) => f.disconnect());
        bypassGainRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      audioCtxRef.current?.close();
      connectedRef.current = false;
      sourceRef.current = null;
      filtersRef.current = [];
      bypassGainRef.current = null;
    }

    if (!audioElement) return;

    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // 注意：如果 audioElement 已被 useAudioVisualizer 的 createMediaElementSource 使用，
      // 此处会抛出错误。此时 EQ 降级为状态管理（UI 可操作，音频链需后续统一重构）。
      let source: MediaElementAudioSourceNode;
      try {
        source = ctx.createMediaElementSource(audioElement);
      } catch {
        // 已被占用 — 只做状态管理
        connectedRef.current = false;
        ctx.close();
        audioCtxRef.current = null;
        return;
      }
      sourceRef.current = source;

      // 创建 10 个 EQ filter 节点
      filtersRef.current = EQ_DEFAULT_BANDS.map((band) => {
        const filter = ctx.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.frequency;
        filter.gain.value = 0;
        return filter;
      });

      // 创建 bypass 节点（EQ 关闭时直通）
      const bypass = ctx.createGain();
      bypass.gain.value = 1;
      bypassGainRef.current = bypass;

      // 默认旁路
      source.connect(bypass);
      bypass.connect(ctx.destination);

      connectedRef.current = true;

      if (ctx.state === "suspended") ctx.resume();
    } catch (err) {
      console.warn("useEqualizer: could not create audio chain", err);
    }

    return () => {
      try {
        sourceRef.current?.disconnect();
        filtersRef.current.forEach((f) => f.disconnect());
        bypassGainRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      audioCtxRef.current?.close();
      connectedRef.current = false;
      sourceRef.current = null;
      filtersRef.current = [];
      bypassGainRef.current = null;
    };
  }, [audioElement]);

  // enabled/bands 变化时重新接线
  useEffect(() => {
    if (!connectedRef.current) return;
    const source = sourceRef.current;
    const filters = filtersRef.current;
    const bypass = bypassGainRef.current;
    const ctx = audioCtxRef.current;
    if (!source || !ctx || !bypass || filters.length === 0) return;

    // 断开所有
    try {
      source.disconnect();
      filters.forEach((f) => f.disconnect());
      bypass.disconnect();
    } catch {
      /* ignore */
    }

    if (enabled) {
      // 插入 EQ 链：source → filter[0] → filter[1] → … → destination
      source.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }
      filters[filters.length - 1].connect(ctx.destination);

      // 应用当前增益值
      bands.forEach((band, i) => {
        if (filters[i]) filters[i].gain.value = band.gain;
      });
    } else {
      // 旁路：source → bypass → destination
      source.connect(bypass);
      bypass.connect(ctx.destination);
    }
  }, [enabled, bands]);

  /** 设置某个频段的增益 */
  const setBandGain = useCallback(
    (index: number, gain: number) => {
      const clamped = Math.max(-12, Math.min(12, gain));
      setBands((prev) =>
        prev.map((b, i) => (i === index ? { ...b, gain: clamped } : b))
      );
      if (enabled && filtersRef.current[index]) {
        filtersRef.current[index].gain.value = clamped;
      }
    },
    [enabled]
  );

  /** 应用预设 */
  const applyPreset = useCallback(
    (name: string) => {
      const preset = EQ_PRESETS[name];
      if (!preset) return;
      setCurrentPreset(name);
      const clamped = preset.map((b) => ({
        ...b,
        gain: Math.max(-12, Math.min(12, b.gain)),
      }));
      setBands(clamped);
      if (enabled) {
        clamped.forEach((band, i) => {
          if (filtersRef.current[i]) {
            filtersRef.current[i].gain.value = band.gain;
          }
        });
      }
    },
    [enabled]
  );

  /** 切换 EQ 开关 */
  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  return {
    bands,
    enabled,
    toggleEnabled,
    setBandGain,
    currentPreset,
    applyPreset,
  };
}
