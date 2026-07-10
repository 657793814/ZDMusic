"use client";
import { useEffect, useRef } from "react";

interface ShortcutHandlers {
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
  onMute: () => void;
}

/**
 * 键盘快捷键 Hook
 *
 * 兼容 Tauri (macOS WKWebView)：
 * - webview 启动后不会自动获得键盘焦点
 * - ArrowUp/ArrowDown 在 WKWebView 中需特殊处理（event.code 可能不匹配）
 * - createMediaElementSource 后 audioElement.volume 失效，
 *   音量通过 AudioContext GainNode 控制（见 useAudioVisualizer）
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const h = handlersRef.current;
      let handled = false;

      // 同时匹配 event.code 和 event.key（WKWebView 兼容）
      const code = e.code;
      const key = e.key;

      if (code === "Space" || key === " ") {
        h.onTogglePlay();
        handled = true;

      } else if (code === "ArrowLeft" || key === "ArrowLeft") {
        h.onPrev();
        handled = true;

      } else if (code === "ArrowRight" || key === "ArrowRight") {
        h.onNext();
        handled = true;

      } else if (code === "ArrowUp" || key === "ArrowUp") {
        h.onVolumeUp();
        handled = true;

      } else if (code === "ArrowDown" || key === "ArrowDown") {
        h.onVolumeDown();
        handled = true;

      } else if (code === "KeyM" || key === "m" || key === "M") {
        h.onMute();
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 同时在多个阶段监听，覆盖 WKWebView 不同版本的行为差异
    window.addEventListener("keydown", handler, { capture: true });
    window.addEventListener("keydown", handler); // bubble 阶段
    document.addEventListener("keydown", handler, { capture: true });
    document.body.addEventListener("keydown", handler, { capture: true });

    return () => {
      window.removeEventListener("keydown", handler, { capture: true });
      window.removeEventListener("keydown", handler);
      document.removeEventListener("keydown", handler, { capture: true });
      document.body.removeEventListener("keydown", handler, { capture: true });
    };
  }, []);
}
