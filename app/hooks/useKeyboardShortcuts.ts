"use client";
import { useEffect } from "react";

interface ShortcutHandlers {
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
  onMute: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          handlers.onTogglePlay();
          break;
        case "ArrowLeft":
          handlers.onPrev();
          break;
        case "ArrowRight":
          handlers.onNext();
          break;
        case "ArrowUp":
          e.preventDefault();
          handlers.onVolumeUp();
          break;
        case "ArrowDown":
          e.preventDefault();
          handlers.onVolumeDown();
          break;
        case "KeyM":
          handlers.onMute();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlers]);
}
