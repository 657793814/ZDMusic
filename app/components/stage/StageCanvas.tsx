"use client";

import { brandPalette, coverPalette, type StagePalette } from "@/app/lib/coverPalette";
import {
  loadStageSettings,
  saveStageSettings,
  STAGE_DEFAULTS,
  type StageVisualSettings,
} from "@/app/lib/stageVisual";
import { useEffect, useRef, useState } from "react";
import { Stage3D, type StageStats } from "./Stage3D";
import { StageCssFallback } from "./StageCssFallback";
import { StageControls } from "./StageControls";
import { SonicEchoStage } from "./SonicEchoStage";

type RenderMode = "webgl" | "css";

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!context) return false;
    const lose = (context as WebGLRenderingContext).getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export type StageCanvasProps = {
  coverUrl: string | null;
  trackId?: string | null;
  analyser: AnalyserNode | null;
  playing: boolean;
  active: boolean;
  /** 音域回响需要的曲目元数据与播放进度 */
  title?: string;
  artist?: string;
  position?: number;
  duration?: number;
  /**
   * 预留接入点 · AI 深度：灰度深度图 URL。
   * 传空则继续用封面亮度启发式；外部模块就绪后直接传入即可生效。
   */
  depthMapUrl?: string | null;
  /**
   * 预留接入点 · 降级开关：强制走 CSS 基座。
   * 供低端机策略或外部模块（Sonic Workshop / AI 深度）在不可用时触发。
   */
  forceFallback?: boolean;
  /** 预留接入点 · 渲染模式变化回调，外部模块据此挂载/卸载 */
  onModeChange?: (mode: RenderMode) => void;
};

export function StageCanvas({
  coverUrl,
  trackId,
  analyser,
  playing,
  active,
  title = "",
  artist = "",
  position = 0,
  duration = 0,
  depthMapUrl = null,
  forceFallback = false,
  onModeChange,
}: StageCanvasProps) {
  // 先用 CSS 基座兜住，确认 WebGL 可用后再切 3D，避免白屏或黑屏
  const [mode, setMode] = useState<RenderMode>("css");
  const [settings, setSettings] = useState<StageVisualSettings>(STAGE_DEFAULTS);
  const [palette, setPalette] = useState<StagePalette>(() => brandPalette(trackId));
  const [stats, setStats] = useState<StageStats | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const probedRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setSettings(loadStageSettings());
  }, []);

  useEffect(() => {
    if (forceFallback) {
      setMode("css");
      return;
    }
    if (probedRef.current) return;
    probedRef.current = true;
    if (detectWebGL()) setMode("webgl");
  }, [forceFallback]);

  useEffect(() => {
    onModeChange?.(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    saveStageSettings(settings);
  }, [settings]);

  useEffect(() => {
    let alive = true;
    if (!coverUrl) {
      setPalette(brandPalette(trackId));
      return;
    }
    void coverPalette(coverUrl, trackId).then((next) => {
      if (alive) setPalette(next);
    });
    return () => {
      alive = false;
    };
  }, [coverUrl, trackId]);

  const updateSettings = (patch: Partial<StageVisualSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const echoActive = mode === "webgl" && settings.visualMode === "sonicEcho" && active && !reducedMotion;
  // 粒子云在音域回响模式下暂停渲染（不销毁几何/纹理，切回即用）
  const particleActive = active && (settings.visualMode === "particles" || (settings.visualMode === "sonicEcho" && reducedMotion));

  return (
    <>
      {mode === "webgl" ? (
        <Stage3D
          coverUrl={coverUrl}
          depthMapUrl={depthMapUrl}
          palette={palette}
          analyser={analyser}
          playing={playing}
          active={particleActive}
          settings={settings}
          onFail={() => setMode("css")}
          onStats={setStats}
        />
      ) : (
        <StageCssFallback
          coverUrl={coverUrl}
          palette={palette}
          analyser={analyser}
          playing={playing}
          active={active}
        />
      )}

      {echoActive ? (
        <SonicEchoStage
          analyser={analyser}
          playing={playing}
          audioReact={settings.audioReact}
          settings={settings}
          palette={palette}
          coverUrl={coverUrl}
          title={title}
          artist={artist}
          position={position}
          duration={duration}
        />
      ) : null}

      {active ? (
        <StageControls
          settings={settings}
          stats={stats}
          mode={mode}
          open={consoleOpen}
          onToggle={() => setConsoleOpen((prev) => !prev)}
          onChange={updateSettings}
          onReset={() => setSettings(STAGE_DEFAULTS)}
          onCameraReset={() => updateSettings({ cameraEpoch: settings.cameraEpoch + 1 })}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </>
  );
}
