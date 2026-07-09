"use client";

import { useCallback, useState } from "react";
import type { EQBand } from "@/app/hooks/useEqualizer";
import { EQ_PRESETS, formatFreqLabel } from "@/app/hooks/useEqualizer";
import { useI18n, type DictKey } from "@/app/lib/i18n";

interface EqualizerProps {
  bands: EQBand[];
  onBandChange: (index: number, gain: number) => void;
  onPresetChange: (presetName: string, bands: EQBand[]) => void;
  enabled: boolean;
  onToggleEnabled: () => void;
  currentPreset: string;
}

const PRESET_NAMES = ["flat", "pop", "rock", "classical", "vocal"] as const;

const PRESET_LABEL_KEYS: Record<string, DictKey> = {
  flat: "eqFlat",
  pop: "eqPop",
  rock: "eqRock",
  classical: "eqClassical",
  vocal: "eqVocal",
};

/* ─── 暗色主题常量 ─── */
const S = {
  trackBg: "var(--color-surface-overlay)",
  trackFill: "var(--color-primary)",
  text: "var(--color-on-surface)",
  textDim: "var(--color-outline)",
  outlineDim: "var(--color-outline-dim)",
  font: "var(--font-body)",
  radiusFull: "9999px",
} as const;

export function Equalizer({
  bands,
  onBandChange,
  onPresetChange,
  enabled,
  onToggleEnabled,
  currentPreset,
}: EqualizerProps) {
  const [open, setOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const toggleOpen = useCallback(() => setOpen((v) => !v), []);

  const { t, lang } = useI18n();

  return (
    <div
      style={{
        fontFamily: S.font,
        color: S.text,
        overflow: "hidden",
      }}
    >
      {/* ─── 标题栏 ─── */}
      <button
        type="button"
        onClick={toggleOpen}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "6px 12px",
          border: "none",
          background: "transparent",
          color: S.textDim,
          cursor: "pointer",
          fontFamily: S.font,
          fontSize: "12px",
          fontWeight: 500,
          letterSpacing: "0.02em",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = S.text;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = S.textDim;
        }}
        aria-label={open ? t("eqCloseAria") : t("eqOpenAria")}
        aria-expanded={open}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* EQ 图标 */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="6" width="4" height="12" rx="1" />
            <rect x="10" y="3" width="4" height="18" rx="1" />
            <rect x="16" y="8" width="4" height="8" rx="1" />
            <circle cx="6" cy="6" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="3" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="18" cy="8" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          {t("equalizer")}
        </span>
        <span
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s var(--ease-emphasized)",
            display: "flex",
            opacity: 0.5,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {/* ─── 主体面板 ─── */}
      {open && (
        <div
          style={{
            padding: "8px 12px 12px",
          }}
        >
          {/* 开关 + 预设行 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            {/* 开关 */}
            <button
              type="button"
              onClick={onToggleEnabled}
              style={{
                position: "relative",
                width: "36px",
                height: "20px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                background: enabled
                  ? "linear-gradient(135deg, var(--color-primary-dim), var(--color-primary))"
                  : S.trackBg,
                transition: "background 0.2s",
                padding: 0,
              }}
              aria-label={enabled ? t("eqEnabled") : t("eqDisabled")}
              role="switch"
              aria-checked={enabled}
            >
              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  left: enabled ? "18px" : "2px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s var(--ease-standard)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }}
              />
            </button>

            {/* 预设按钮 */}
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {PRESET_NAMES.map((name) => {
                const active = currentPreset === name;
                const preset = EQ_PRESETS[name];
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      if (preset) onPresetChange(name, preset);
                    }}
                    style={{
                      padding: "3px 8px",
                      fontSize: "10px",
                      fontWeight: 500,
                      fontFamily: S.font,
                      letterSpacing: "0.03em",
                      border: `1px solid ${
                        active ? S.trackFill : S.outlineDim
                      }`,
                      borderRadius: S.radiusFull,
                      background: active
                        ? "color-mix(in srgb, var(--color-primary) 15%, transparent)"
                        : "transparent",
                      color: active ? S.trackFill : S.textDim,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      textTransform: "capitalize",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.borderColor =
                          S.trackFill;
                        (e.currentTarget as HTMLElement).style.color = S.text;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.borderColor =
                          S.outlineDim;
                        (e.currentTarget as HTMLElement).style.color =
                          S.textDim;
                      }
                    }}
                  >
                    {t(PRESET_LABEL_KEYS[name])}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── 10 个垂直滑块 ─── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "2px",
              height: "180px",
              padding: "0 2px",
            }}
          >
            {bands.map((band, index) => {
              const freqLabel = formatFreqLabel(band.frequency);
              const isDragging = dragIndex === index;

              return (
                <div
                  key={band.frequency}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "3px",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {/* dB 值标签 */}
                  <div
                    style={{
                      fontSize: "9px",
                      lineHeight: "12px",
                      height: "12px",
                      color: isDragging
                        ? S.trackFill
                        : band.gain > 0
                          ? "var(--color-secondary)"
                          : band.gain < 0
                            ? "var(--color-error)"
                            : S.textDim,
                      fontWeight: isDragging ? 600 : 400,
                      transition: "color 0.15s",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {isDragging || band.gain !== 0
                      ? `${band.gain > 0 ? "+" : ""}${band.gain}`
                      : ""}
                  </div>

                  {/* 滑块容器 */}
                  <div
                    style={{
                      flex: 1,
                      width: "100%",
                      minHeight: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={band.gain}
                      onChange={(e) =>
                        onBandChange(index, Number(e.target.value))
                      }
                      onMouseDown={() => setDragIndex(index)}
                      onMouseUp={() => setDragIndex(null)}
                      onTouchStart={() => setDragIndex(index)}
                      onTouchEnd={() => setDragIndex(null)}
                      disabled={!enabled}
                      style={{
                        writingMode: "vertical-lr",
                        direction: "rtl",
                        WebkitAppearance: "slider-vertical",
                        appearance: "slider-vertical" as unknown as React.CSSProperties["appearance"],
                        width: "100%",
                        maxWidth: "28px",
                        height: "100%",
                        maxHeight: "148px",
                        cursor: enabled ? "pointer" : "not-allowed",
                        opacity: enabled ? 1 : 0.4,
                        accentColor: "var(--color-primary)",
                        background: "transparent",
                        outline: "none",
                        margin: 0,
                        padding: 0,
                        transition: "opacity 0.2s",
                      }}
                      aria-label={
                        lang === "zh-CN"
                          ? `${freqLabel} Hz 均衡器，增益 ${band.gain} dB`
                          : `${freqLabel} Hz equalizer, gain ${band.gain} dB`
                      }
                    />
                  </div>

                  {/* 频率标签 */}
                  <div
                    style={{
                      fontSize: "9px",
                      lineHeight: "12px",
                      height: "12px",
                      color: S.textDim,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {freqLabel}
                  </div>
                </div>
              );
            })}
          </div>

          {/* dB 刻度提示 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "8px",
              color: S.textDim,
              opacity: 0.5,
              marginTop: "4px",
              padding: "0 2px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>+12</span>
            <span>0</span>
            <span>-12</span>
          </div>
        </div>
      )}
    </div>
  );
}
