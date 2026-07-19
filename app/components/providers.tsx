"use client";

import { AgentProvider } from "@/app/context/AgentContext";
import { DanmakuProvider } from "@/app/context/DanmakuContext";
import { ModeProvider } from "@/app/context/ModeContext";
import { PlayerProvider } from "@/app/context/PlayerContext";
import { ThemeProvider } from "@/app/context/ThemeContext";
import { I18nProvider, useI18n } from "@/app/lib/i18n";
import type { ReactNode } from "react";
import { useEffect } from "react";

function LangHydrator() {
  const { lang } = useI18n();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <ModeProvider>
          <PlayerProvider>
            <DanmakuProvider>
              <AgentProvider>
                <LangHydrator />
                {children}
              </AgentProvider>
            </DanmakuProvider>
          </PlayerProvider>
        </ModeProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
