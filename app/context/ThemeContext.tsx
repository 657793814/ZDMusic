"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  THEMES,
  getThemeById,
  DEFAULT_THEME_ID,
  type ThemeId,
  type ThemePreset,
} from "@/app/lib/theme-presets";

type ThemeCtx = {
  /** 当前主题 ID */
  themeId: ThemeId;
  /** 当前完整主题对象 */
  theme: ThemePreset;
  /** 所有主题列表（用于 UI 展示） */
  themes: ThemePreset[];
  /** 切换主题 */
  setTheme: (id: ThemeId) => void;
  /** 是否正在加载初始主题 */
  loading: boolean;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [loading, setLoading] = useState(true);

  // 从配置加载已保存的主题
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error(await res.text());
        const config = await res.json();
        const saved = config?.theme_id as ThemeId | undefined;
        if (saved && THEMES.some(t => t.id === saved)) {
          applyTheme(getThemeById(saved));
          setThemeId(saved);
        } else {
          applyTheme(getThemeById(DEFAULT_THEME_ID));
        }
      } catch {
        // 开发环境没有后端也能用默认主题
        applyTheme(getThemeById(DEFAULT_THEME_ID));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 切换主题
  const setTheme = useCallback((id: ThemeId) => {
    const preset = getThemeById(id);
    setThemeId(id);
    applyTheme(preset);
    persistTheme(id);
  }, []);

  // 注入 CSS 变量到 :root
  function applyTheme(preset: ThemePreset) {
    const root = document.documentElement;

    for (const [key, val] of Object.entries(preset.tokens)) {
      root.style.setProperty(key, val);
    }

    if (preset.gradient) {
      root.style.setProperty('--theme-gradient', preset.gradient);
    } else {
      root.style.setProperty('--theme-gradient', 'none');
    }
  }

  // 持久化到 /api/config（静默失败）
  async function persistTheme(id: ThemeId) {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) return;
      const existing = await res.json();

      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          music_dir: existing.music_dir ?? null,
          env_vars: existing.env_vars ?? null,
          theme_id: id,
        }),
      });
    } catch {
      // 静默
    }
  }

  const value = useMemo<ThemeCtx>(
    () => ({
      themeId,
      theme: getThemeById(themeId),
      themes: THEMES,
      setTheme,
      loading,
    }),
    [themeId, setTheme, loading],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
