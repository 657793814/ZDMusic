"use client";

import {
  STAGE_PRESETS,
  STAGE_SLIDERS,
  STAGE_TOGGLES,
  STAGE_UNSUPPORTED,
  STAGE_VISUAL_MODES,
  PRESET_SLIDERS,
  type StagePreset,
  type StageVisualMode,
  type StageVisualSettings,
  type SliderGroup,
  type SliderKey,
  type ToggleKey,
} from "@/app/lib/stageVisual";

import type { StageStats } from "./Stage3D";

const GROUP_META: { id: SliderGroup; label: string; note: string }[] = [
  { id: "rhythm", label: "律动", note: "音频驱动的位移与呼吸" },
  { id: "shape", label: "形态", note: "点云挤出、密度与运动" },
  { id: "camera", label: "镜头", note: "轨道、环绕与漂移" },
  { id: "glow", label: "辉光与色彩", note: "溢光、调色与背景压暗" },
];

function BandMeter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="zd-stage-band" data-tone={tone}>
      <span className="zd-stage-band-label">{label}</span>
      <span className="zd-stage-band-track">
        <span className="zd-stage-band-fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="zd-stage-band-value">{value.toFixed(2)}</span>
    </div>
  );
}

export function StageControls({
  settings,
  stats,
  mode,
  open,
  onToggle,
  onChange,
  onReset,
  onCameraReset,
  reducedMotion = false,
}: {
  settings: StageVisualSettings;
  stats: StageStats | null;
  mode: "webgl" | "css";
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<StageVisualSettings>) => void;
  onReset: () => void;
  onCameraReset: () => void;
  reducedMotion?: boolean;
}) {
  const presetSliders = PRESET_SLIDERS[settings.preset] ?? [];

  const renderSlider = (key: SliderKey) => {
    const slider = STAGE_SLIDERS.find((item) => item.key === key);
    if (!slider) return null;
    return (
      <label key={key} className="zd-stage-row">
        <span className="zd-stage-row-head">
          <span className="zd-stage-row-label">{slider.label}</span>
          <span className="zd-stage-row-value">{settings[key].toFixed(2)}</span>
        </span>
        <input
          className="zd-stage-range"
          type="range"
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={settings[key]}
          onChange={(event) => onChange({ [key]: Number(event.target.value) })}
        />
        <span className="zd-stage-row-driver">{slider.driver}</span>
      </label>
    );
  };

  return (
    <div className="zd-stage-console" data-stage-interactive data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="zd-stage-console-toggle glass-pill"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="zd-stage-console-panel"
      >
        <span className="zd-stage-console-dot" data-mode={mode} aria-hidden />
        <span>视觉控制</span>
      </button>

      {open ? (
      <div className="zd-stage-console-panel glass-panel" id="zd-stage-console-panel">
        <div className="zd-stage-console-head">
          <span className="zd-kicker">STAGE VISUAL</span>
          <span className="zd-stage-console-mode">
            {mode === "webgl" ? "WebGL" : "CSS 兜底"}
          </span>
        </div>

        <div className="zd-stage-modes">
          {STAGE_VISUAL_MODES.map((item) => {
            const muted = item.id === "sonicEcho" && reducedMotion;
            return (
              <button
                key={item.id}
                type="button"
                className="zd-stage-mode"
                data-active={settings.visualMode === item.id ? "true" : "false"}
                onClick={() => onChange({ visualMode: item.id as StageVisualMode })}
              >
                <span className="zd-stage-mode-label">{item.label}</span>
                <span className="zd-stage-mode-note">
                  {muted ? "系统减弱动效，已暂停" : item.note}
                </span>
              </button>
            );
          })}
        </div>

        <div className="zd-stage-presets">
          {STAGE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="zd-stage-preset"
              data-active={settings.preset === preset.id ? "true" : "false"}
              data-dim={settings.visualMode === "sonicEcho" ? "true" : "false"}
              onClick={() => onChange({ preset: preset.id as StagePreset })}
            >
              <span className="zd-stage-preset-label">{preset.label}</span>
              <span className="zd-stage-preset-note">{preset.note}</span>
            </button>
          ))}
        </div>

        {/* 实时频谱能量：bass / mid / high 各自驱动不同参数 */}
        <div className="zd-stage-bands" data-static={!settings.audioReact || settings.sensitivity <= 0}>
          <div className="zd-stage-bands-head">
            <span className="zd-kicker">LIVE BANDS</span>
            <span className="zd-stage-bands-note">
              {!settings.audioReact
                ? "律动已关闭"
                : settings.sensitivity <= 0
                  ? "灵敏度 0"
                  : "30fps 采样 · 包络跟随"}
            </span>
          </div>
          <BandMeter label="低频" value={stats?.bass ?? 0} tone="bass" />
          <BandMeter label="中频" value={stats?.mid ?? 0} tone="mid" />
          <BandMeter label="高频" value={stats?.high ?? 0} tone="high" />
        </div>

        {GROUP_META.map((group) => (
          <details key={group.id} className="zd-stage-group" open>
            <summary className="zd-stage-group-head">
              <span className="zd-stage-group-label">{group.label}</span>
              <span className="zd-stage-group-note">{group.note}</span>
            </summary>
            <div className="zd-stage-sliders">
              {STAGE_SLIDERS.filter((slider) => slider.group === group.id).map((slider) =>
                renderSlider(slider.key),
              )}
            </div>
          </details>
        ))}

        {presetSliders.length ? (
          <details className="zd-stage-group" open>
            <summary className="zd-stage-group-head">
              <span className="zd-stage-group-label">
                预设专属 · {STAGE_PRESETS.find((p) => p.id === settings.preset)?.label}
              </span>
              <span className="zd-stage-group-note">只对当前预设生效</span>
            </summary>
            <div className="zd-stage-sliders">{presetSliders.map((key) => renderSlider(key))}</div>
          </details>
        ) : null}

        <div className="zd-stage-switches">
          {STAGE_TOGGLES.map((toggle) => {
            const key = toggle.key as ToggleKey;
            return (
              <label key={key} className="zd-stage-switch">
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(event) => onChange({ [key]: event.target.checked })}
                />
                <span className="zd-stage-switch-track" aria-hidden />
                <span className="zd-stage-switch-text">
                  <span>{toggle.label}</span>
                  <span className="zd-stage-switch-driver">{toggle.driver}</span>
                </span>
              </label>
            );
          })}
        </div>

        <details className="zd-stage-group zd-stage-group-disabled" open>
          <summary className="zd-stage-group-head">
            <span className="zd-stage-group-label">未接入 / 本机不可用（{STAGE_UNSUPPORTED.length}）</span>
            <span className="zd-stage-group-note">如实标注，不提供假开关</span>
          </summary>
          <ul className="zd-stage-unsupported">
            {STAGE_UNSUPPORTED.map((item) => (
              <li key={item.label} className="zd-stage-unsupported-item">
                <span className="zd-stage-unsupported-label">
                  {item.label}
                  <span className="zd-stage-unsupported-tag" data-status={item.status}>
                    {item.status === "unavailable" ? "不可用" : "待接入"}
                  </span>
                </span>
                <span className="zd-stage-unsupported-reason">{item.reason}</span>
              </li>
            ))}
          </ul>
        </details>

        <div className="zd-stage-console-foot">
          <span className="zd-stage-stats">
            {stats
              ? `${stats.fps} fps · ${stats.particles.toLocaleString()} 粒子 · ${stats.drawCalls} draw · ${stats.geometries} geo · ${stats.textures} tex`
              : "等待性能数据…"}
          </span>
          <div className="zd-stage-console-actions">
            <button type="button" className="zd-stage-reset" onClick={onCameraReset}>
              镜头归位
            </button>
            <button type="button" className="zd-stage-reset" onClick={onReset}>
              恢复默认
            </button>
          </div>
        </div>
      </div>
      ) : null}
    </div>
  );
}
