"use client";

export type AccentId = "home" | "shelf" | "tint";
export type DensityId = "default" | "compact";
export type LyricPosition = "center" | "bottom";
export type LyricAlign = "left" | "center" | "right";

export type UiPrefs = {
  accent: AccentId;
  density: DensityId;
  /** 歌词字号倍率：0.85 / 1 / 1.15 */
  lyricScale: number;
  /** 歌词舞台的纵向位置 */
  lyricPosition: LyricPosition;
  /** 歌词对齐方式 */
  lyricAlign: LyricAlign;
  /** 歌词背景不透明度 0–0.8 */
  lyricBackdrop: number;
};

const STORAGE_KEY = "zdmusic.ui-prefs.v1";

export const ACCENTS: Record<AccentId, { label: string; value: string }> = {
  home: { label: "青绿", value: "#00f5d4" },
  shelf: { label: "香槟", value: "#f4d28a" },
  tint: { label: "冷蓝", value: "#9db8cf" },
};

export const DEFAULT_PREFS: UiPrefs = {
  accent: "home",
  density: "default",
  lyricScale: 1,
  lyricPosition: "center",
  lyricAlign: "center",
  lyricBackdrop: 0.45,
};

export function loadUiPrefs(): UiPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return {
      accent:
        parsed.accent && parsed.accent in ACCENTS ? parsed.accent : DEFAULT_PREFS.accent,
      density: parsed.density === "compact" ? "compact" : "default",
      lyricScale:
        typeof parsed.lyricScale === "number" &&
        [0.85, 1, 1.15].includes(parsed.lyricScale)
          ? parsed.lyricScale
          : DEFAULT_PREFS.lyricScale,
      lyricPosition: parsed.lyricPosition === "bottom" ? "bottom" : "center",
      lyricAlign:
        parsed.lyricAlign === "left" || parsed.lyricAlign === "right"
          ? parsed.lyricAlign
          : "center",
      lyricBackdrop:
        typeof parsed.lyricBackdrop === "number" &&
        parsed.lyricBackdrop >= 0 &&
        parsed.lyricBackdrop <= 0.8
          ? parsed.lyricBackdrop
          : DEFAULT_PREFS.lyricBackdrop,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** 把偏好写进 CSS 变量，所有组件通过 var(--zd-*) 跟随，不需要逐组件传参。 */
export function applyUiPrefs(prefs: UiPrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--zd-accent-home", ACCENTS[prefs.accent].value);
  if (prefs.density === "compact") root.dataset.density = "compact";
  else delete root.dataset.density;

  const scale = prefs.lyricScale;
  root.style.setProperty(
    "--zd-text-lyric",
    `clamp(${Math.round(34 * scale)}px, ${(5.6 * scale).toFixed(2)}vw, ${Math.round(
      76 * scale
    )}px)`
  );

  root.style.setProperty("--zd-lyric-backdrop", prefs.lyricBackdrop.toFixed(2));
  root.dataset.lyricPosition = prefs.lyricPosition;
  root.dataset.lyricAlign = prefs.lyricAlign;
}

export function saveUiPrefs(prefs: UiPrefs): void {
  applyUiPrefs(prefs);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* 隐私模式下忽略 */
  }
}
