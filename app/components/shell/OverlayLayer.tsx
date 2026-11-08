"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { AssistantDrawer } from "@/app/components/overlays/AssistantDrawer";
import { LibraryOverlay } from "@/app/components/overlays/LibraryOverlay";
import { LyricsOverlay } from "@/app/components/overlays/LyricsOverlay";
import { QueueDrawer } from "@/app/components/overlays/QueueDrawer";
import { RecognizerOverlay } from "@/app/components/overlays/RecognizerOverlay";
import { SearchOverlay } from "@/app/components/overlays/SearchOverlay";
import { SettingsDrawer } from "@/app/components/overlays/SettingsDrawer";
import { useEffect } from "react";

export function OverlayLayer() {
  const { active, close, toggle } = useOverlay();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "j") {
        event.preventDefault();
        event.stopPropagation();
        toggle("assistant");
        return;
      }

      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        toggle("search");
        return;
      }

      if (event.key === "Escape") {
        // Esc 只关闭当前浮层；没有浮层时不退出沉浸舞台
        if (active) {
          event.preventDefault();
          close();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [active, close, toggle]);

  return (
    <div className="zd-overlay-layer">
      {/* 互斥由 OverlayContext 的单一 active 保证：只挂载当前激活的面板 */}
      {active === null || active === "queue" ? <QueueDrawer /> : null}
      {active === "search" ? <SearchOverlay /> : null}
      {active === "assistant" ? <AssistantDrawer /> : null}
      {active === "settings" ? <SettingsDrawer /> : null}
      {active === "library" ? <LibraryOverlay /> : null}
      {active === "lyrics" ? <LyricsOverlay /> : null}
      {active === "recognizer" ? <RecognizerOverlay /> : null}
    </div>
  );
}
