/**
 * 🎨 卓动悦听 — 主题预设定义
 *
 * 每套主题 = 一组 CSS 变量覆盖 + 可选渐变背景光
 * 所有现有组件都通过 var(--color-xxx) 引用这些变量，
 * 切换主题即重新注入 :root，全局组件自动跟随。
 */

export type ThemeId =
  | 'dark-violet'
  | 'aurora'
  | 'warm-sunset'
  | 'ocean'
  | 'neon-pulse'
  | 'moon-light';

export type ThemePreset = {
  id: ThemeId;
  name: string;
  emoji: string;
  description: string;
  tokens: Record<string, string>;
  /** 叠加在 surface 上的氛围光渐变（径向渐变） */
  gradient?: string;
};

export const THEMES: ThemePreset[] = [
  // ── 1. 暗紫 — 现有默认 ──
  {
    id: 'dark-violet',
    name: '暗紫',
    emoji: '💜',
    description: '深色紫罗兰 · 默认主题',
    tokens: {
      '--color-surface': '#0a0a0b',
      '--color-on-surface': '#e8e6e7',
      '--color-surface-dim': '#141416',
      '--color-surface-raised': '#1c1c1f',
      '--color-surface-overlay': '#252529',
      '--color-outline': '#6e6e72',
      '--color-outline-dim': '#2a2a2e',
      '--color-primary': '#a78bfa',
      '--color-primary-dim': '#8b6cf0',
      '--color-secondary': '#2dd4bf',
      '--color-on-primary': '#0a0a0b',
      '--color-error': '#f87171',
      '--color-on-error': '#0a0a0b',
      '--color-success': '#4ade80',
    },
    gradient: 'radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.06) 0%, transparent 60%)',
  },

  // ── 2. 极光 — 深绿色系 ──
  {
    id: 'aurora',
    name: '极光',
    emoji: '🌿',
    description: '幽绿森林 · 自然呼吸感',
    tokens: {
      '--color-surface': '#0a140f',
      '--color-on-surface': '#deedd8',
      '--color-surface-dim': '#0f1e15',
      '--color-surface-raised': '#16291f',
      '--color-surface-overlay': '#1e3528',
      '--color-outline': '#5a7a6a',
      '--color-outline-dim': '#243c30',
      '--color-primary': '#6ee7b7',
      '--color-primary-dim': '#4ade80',
      '--color-secondary': '#67e8f9',
      '--color-on-primary': '#0a140f',
      '--color-error': '#fca5a5',
      '--color-on-error': '#0a140f',
      '--color-success': '#86efac',
    },
    gradient: 'radial-gradient(ellipse at 50% 0%, rgba(110,231,183,0.08) 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(103,232,249,0.04) 0%, transparent 50%)',
  },

  // ── 3. 暖阳 — 琥珀暖调 ──
  {
    id: 'warm-sunset',
    name: '暖阳',
    emoji: '🌅',
    description: '琥珀暖橙 · 温暖沉浸',
    tokens: {
      '--color-surface': '#14100a',
      '--color-on-surface': '#f0e6d8',
      '--color-surface-dim': '#1e1810',
      '--color-surface-raised': '#2c2215',
      '--color-surface-overlay': '#3a2e1d',
      '--color-outline': '#8a7a5a',
      '--color-outline-dim': '#3d3220',
      '--color-primary': '#fbbf24',
      '--color-primary-dim': '#f59e0b',
      '--color-secondary': '#fb923c',
      '--color-on-primary': '#14100a',
      '--color-error': '#f87171',
      '--color-on-error': '#14100a',
      '--color-success': '#86efac',
    },
    gradient: 'radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.07) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, rgba(251,146,60,0.05) 0%, transparent 50%)',
  },

  // ── 4. 海洋 — 蓝色系 ──
  {
    id: 'ocean',
    name: '海洋',
    emoji: '🌊',
    description: '深海幽蓝 · 宁静深邃',
    tokens: {
      '--color-surface': '#0a0f14',
      '--color-on-surface': '#d8e8f0',
      '--color-surface-dim': '#0e1821',
      '--color-surface-raised': '#152530',
      '--color-surface-overlay': '#1e3340',
      '--color-outline': '#5a7a8a',
      '--color-outline-dim': '#203845',
      '--color-primary': '#60a5fa',
      '--color-primary-dim': '#3b82f6',
      '--color-secondary': '#2dd4bf',
      '--color-on-primary': '#0a0f14',
      '--color-error': '#f87171',
      '--color-on-error': '#0a0f14',
      '--color-success': '#4ade80',
    },
    gradient: 'radial-gradient(ellipse at 50% 0%, rgba(96,165,250,0.07) 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(45,212,191,0.04) 0%, transparent 50%)',
  },

  // ── 5. 霓虹 — 赛博朋克荧光 ──
  {
    id: 'neon-pulse',
    name: '霓虹',
    emoji: '💎',
    description: '赛博朋克 · 荧光闪烁感',
    tokens: {
      '--color-surface': '#0a0a14',
      '--color-on-surface': '#e8dff0',
      '--color-surface-dim': '#12101e',
      '--color-surface-raised': '#1c1830',
      '--color-surface-overlay': '#282440',
      '--color-outline': '#6a5a8a',
      '--color-outline-dim': '#2a2440',
      '--color-primary': '#c084fc',
      '--color-primary-dim': '#a855f7',
      '--color-secondary': '#f472b6',
      '--color-on-primary': '#0a0a14',
      '--color-error': '#fb7185',
      '--color-on-error': '#0a0a14',
      '--color-success': '#67e8f9',
    },
    gradient: 'radial-gradient(ellipse at 50% 0%, rgba(192,132,252,0.08) 0%, transparent 60%), radial-gradient(ellipse at 100% 0%, rgba(244,114,182,0.05) 0%, transparent 50%)',
  },

  // ── 6. 月光 — 浅色系 ──
  {
    id: 'moon-light',
    name: '月光',
    emoji: '🌙',
    description: '银灰浅白 · 柔和明亮',
    tokens: {
      '--color-surface': '#f5f5f0',
      '--color-on-surface': '#1c1c1a',
      '--color-surface-dim': '#e8e8e0',
      '--color-surface-raised': '#ffffff',
      '--color-surface-overlay': '#f0f0e8',
      '--color-outline': '#8a8a80',
      '--color-outline-dim': '#d0d0c8',
      '--color-primary': '#7c3aed',
      '--color-primary-dim': '#6d28d9',
      '--color-secondary': '#0d9488',
      '--color-on-primary': '#ffffff',
      '--color-error': '#dc2626',
      '--color-on-error': '#ffffff',
      '--color-success': '#16a34a',
    },
    gradient: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.04) 0%, transparent 60%)',
  },
];

export function getThemeById(id: ThemeId): ThemePreset {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

export const DEFAULT_THEME_ID: ThemeId = 'dark-violet';
