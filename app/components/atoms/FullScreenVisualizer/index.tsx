"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPresetDefinitions,
  getPresetRenderer,
  getDefaultPresetId,
  getPresetDefinition,
  type PresetDefinition,
} from "./presets";

// 持久化 key
const STORAGE_KEY = "aura-fullscreen-preset";

type Props = {
  analyser: AnalyserNode | null;
  playing: boolean;
  onExit: () => void;
};

export function FullScreenVisualizer({ analyser, playing, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [currentId, setCurrentId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEY) || getDefaultPresetId();
  });

  const [showPicker, setShowPicker] = useState(false);
  const [pickerHover, setPickerHover] = useState(false);
  const definitions = getPresetDefinitions();
  const currentDef = getPresetDefinition(currentId);

  // 下拉打开时锚点到当前选中效果
  useEffect(() => {
    if (!showPicker) return;
    // microtask 确保 DOM 已渲染
    const id = setTimeout(() => {
      const el = dropdownRef.current?.querySelector(`[data-preset-id="${currentId}"]`);
      (el as HTMLElement | null)?.scrollIntoView({ block: "nearest" });
    }, 0);
    return () => clearTimeout(id);
  }, [showPicker, currentId]);

  // 预设切换
  const switchPreset = useCallback((id: string) => {
    setCurrentId(id);
    localStorage.setItem(STORAGE_KEY, id);
    setShowPicker(false);
  }, []);

  // 运行当前预设的渲染器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentId) return;

    // 清理上一次的渲染器
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const createRenderer = getPresetRenderer(currentId);
    if (!createRenderer) return;

    cleanupRef.current = createRenderer(canvas, analyser, playing);

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [currentId, analyser, playing]);

  // ESC 退出由 page.tsx 统一处理
  // Keyboard ESC is managed by page.tsx to avoid double-toggle conflicts

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ backgroundColor: "#05050a" }}
      onMouseEnter={() => setPickerHover(true)}
      onMouseLeave={() => {
        setPickerHover(false);
        setTimeout(() => setShowPicker(false), 300);
      }}
    >
      <canvas
        ref={canvasRef}
        className="fixed inset-0"
        aria-hidden
      />

      {/* ── 顶部提示栏 ── */}
      <div
        className="fixed top-5 left-5 right-5 z-50 flex items-center justify-between"
        style={{ pointerEvents: "none" }}
      >
        {/* 预设切换按钮 */}
        <div style={{ pointerEvents: "auto" }}>
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] transition-all hover:bg-white/10"
            style={{
              backgroundColor: showPicker
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.12)",
              fontFamily: "var(--font-body)",
              opacity: pickerHover || showPicker ? 1 : 0.5,
            }}
            aria-label="切换沉浸效果"
            title="切换沉浸效果"
          >
            <span style={{ fontSize: "13px", lineHeight: 1 }}>
              {currentDef?.icon ?? "✦"}
            </span>
            <span style={{ letterSpacing: "0.05em" }}>
              {currentDef?.name ?? "预设"}
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ opacity: 0.5 }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* 预设选择面板 */}
          {showPicker && (
            <div
              ref={dropdownRef}
              className="absolute top-10 left-0 overflow-hidden rounded-xl"
              style={{
                backgroundColor: "rgba(10,10,15,0.92)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(12px)",
                minWidth: "180px",
                maxHeight: "40vh",
                overflowY: "auto",
                boxShadow:
                  "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              <div
                style={{
                  padding: "6px 10px",
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  color: "rgba(255,255,255,0.35)",
                  fontFamily: "var(--font-body)",
                  textTransform: "uppercase",
                }}
              >
                沉浸效果
              </div>
              {definitions.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => switchPreset(def.id)}
                  data-preset-id={def.id}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors hover:bg-white/10"
                  style={{
                    color:
                      def.id === currentId
                        ? "rgba(255,255,255,0.9)"
                        : "rgba(255,255,255,0.55)",
                    fontFamily: "var(--font-body)",
                    letterSpacing: "0.02em",
                  }}
                >
                  <span style={{ fontSize: "16px", lineHeight: 1 }}>
                    {def.icon}
                  </span>
                  <span className="flex flex-col">
                    <span>{def.name}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.3)",
                        marginTop: "1px",
                      }}
                    >
                      {def.description}
                    </span>
                  </span>
                  {def.id === currentId && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      style={{ marginLeft: "auto", opacity: 0.6 }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 提示 + 关闭按钮 */}
        <div
          className="flex items-center gap-3"
          style={{ pointerEvents: "auto" }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.35)",
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              letterSpacing: "0.1em",
            }}
          >
            ESC 退出
          </span>
          <button
            type="button"
            onClick={onExit}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
            aria-label="退出全屏"
            title="退出全屏 (ESC)"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
