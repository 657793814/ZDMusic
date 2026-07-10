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

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const h = handlersRef.current;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          h.onTogglePlay();
          break;
        case "ArrowLeft":
          h.onPrev();
          break;
        case "ArrowRight":
          h.onNext();
          break;
        case "ArrowUp":
          e.preventDefault();
          h.onVolumeUp();
          break;
        case "ArrowDown":
          e.preventDefault();
          h.onVolumeDown();
          break;
        case "KeyM":
          h.onMute();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
