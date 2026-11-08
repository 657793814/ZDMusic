"use client";

import { useEffect, useRef, useState } from "react";
import type { StagePalette } from "@/app/lib/coverPalette";
import type { StageVisualSettings } from "@/app/lib/stageVisual";

/** 音域回响：独立 WebGL 模块（静态包），通过 postMessage 喂频谱/媒体/属性 */
const MSG = {
  audio: "mineradio-sonic-workshop-audio",
  media: "mineradio-sonic-workshop-media",
  props: "mineradio-sonic-workshop-properties",
} as const;

const PAUSED_GAIN = 0.2;
const AUDIO_INTERVAL = 33; // 约 30fps，避免每帧 FFT

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeHex(hex: string, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : fallback;
}

function mixHex(from: string, to: string, amount: number) {
  const read = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const a = read(normalizeHex(from, "#000000"));
  const b = read(normalizeHex(to, "#ffffff"));
  const mix = a.map((value, index) => Math.round(value + (b[index] - value) * amount));
  return `#${mix.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function buildTheme(palette: StagePalette, glow: number) {
  const primary = normalizeHex(palette.primary, "#cb6c89");
  const secondary = normalizeHex(palette.secondary, "#f4d28a");
  const lighten = (hex: string, amount: number) => mixHex(hex, "#ffffff", amount);
  const deepen = (hex: string, amount: number) => mixHex(hex, "#05070a", amount);

  return {
    name: "ZDMusic Cover",
    id: "mineradio-custom",
    __primaryColor: primary,
    uGlowIntensity: clamp(glow, 0.2, 2.5),
    uBaseColor1: deepen(primary, 0.32),
    uBaseColor2: deepen(secondary, 0.5),
    uCoolCore: secondary,
    uCoolEdge: lighten(secondary, 0.18),
    uWarmCore: primary,
    uWarmEdge: lighten(primary, 0.24),
    uRippleColor: mixHex(primary, secondary, 0.5),
    uPeakColor: "#ffffff",
  };
}

export function SonicEchoStage({
  analyser,
  playing,
  audioReact,
  settings,
  palette,
  coverUrl,
  title,
  artist,
  position,
  duration,
}: {
  analyser: AnalyserNode | null;
  playing: boolean;
  audioReact: boolean;
  settings: StageVisualSettings;
  palette: StagePalette;
  coverUrl: string | null;
  title: string;
  artist: string;
  position: number;
  duration: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playingRef = useRef(playing);
  const [ready, setReady] = useState(false);

  playingRef.current = playing;

  // 属性：主题 8 色 + 渲染参数（值不加 {value} 包装）
  useEffect(() => {
    if (!ready) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;

    win.postMessage(
      {
        type: MSG.props,
        properties: {
          theme: "mineradio-custom",
          mineradioCustomTheme: buildTheme(palette, 0.6 + settings.bloom * 1.2),
          audioIntensity: clamp(0.4 + settings.intensity * 1.3, 0.3, 2.5),
          responseRange: clamp(0.3 + settings.sensitivity * 1.0, 0.3, 2.5),
          peakColorIntensity: clamp(settings.bloom * 1.4, 0, 1.5),
          gridSize: 320,
          pulseEnabled: settings.audioReact,
          pulseSensitivity: clamp(settings.sensitivity * 0.06, 0, 0.4),
          idleWaveEnabled: settings.audioReact,
          autoRotateEnabled: settings.autoOrbit > 0,
          autoRotateSpeed: clamp(3 + settings.speed * 5, 0, 20),
          cameraDistance: 80,
          showPlayerController: false,
          showAlbumCover: false,
        },
      },
      "*",
    );
  }, [
    ready,
    palette.primary,
    palette.secondary,
    settings.bloom,
    settings.intensity,
    settings.sensitivity,
    settings.speed,
    settings.autoOrbit,
    settings.audioReact,
  ]);

  // 媒体：曲目元数据 + 播放状态；进度按秒节流，避免每秒 60 次 postMessage
  const roundedPosition = Math.round(position);
  useEffect(() => {
    if (!ready) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;

    win.postMessage(
      {
        type: MSG.media,
        media: {
          title,
          artist,
          thumbnail: coverUrl ?? "",
          primaryColor: normalizeHex(palette.primary, "#cb6c89"),
          textColor: "#f4f6f8",
          isPlaying: playing,
          position: roundedPosition,
          duration,
        },
      },
      "*",
    );
  }, [ready, title, artist, coverUrl, palette.primary, playing, roundedPosition, duration]);

  // 频段：复用已有 AnalyserNode，不另开音频上下文；只在播放且开启律动时读取
  useEffect(() => {
    if (!ready) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;

    if (!analyser || !playing || !audioReact) {
      win.postMessage({ type: MSG.audio, samples: new Array(128).fill(0) }, "*");
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let lastAt = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - lastAt < AUDIO_INTERVAL) return;
      lastAt = now;

      analyser.getByteFrequencyData(data);
      const gain = playingRef.current ? 1 : PAUSED_GAIN;
      const samples = new Array<number>(data.length);
      for (let i = 0; i < data.length; i += 1) samples[i] = (data[i] / 255) * gain;
      win.postMessage({ type: MSG.audio, samples }, "*");
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, analyser, playing, audioReact]);

  return (
    <iframe
      ref={iframeRef}
      className="zd-stage-echo-layer"
      src="/visual/sonic-echo/index.html"
      title="音域回响"
      aria-hidden="true"
      tabIndex={-1}
      data-echo-layer
      onLoad={() => setReady(true)}
    />
  );
}
