# AuraPlayer 现代风格 UI/UX 改造方案

## 背景

当前 AuraPlayer 使用"复古终端"风格（CRT 扫描线、点阵背景、像素艺术、等宽字体、全大写标签）。计划将整体样式改为现代暗色音乐播放器风格（参考 Spotify、Apple Music、YouTube Music），并重新设计 Logo。

**目标风格**：圆角卡片、柔和阴影、平滑动画、专业排版层次、自然语言。

---

## 1. 新配色方案

| 令牌 | 当前值 | 新值 | 说明 |
|---|---|---|---|
| `--color-surface` | `#131314` | `#0a0a0b` | 纯黑背景 |
| `--color-on-surface` | `#e5e2e3` | `#e8e6e7` | 暖白文字 |
| `--color-surface-dim` | — | `#141416` | 卡片/面板背景 |
| `--color-surface-raised` | — | `#1c1c1f` | 抬升卡片 |
| `--color-surface-overlay` | — | `#252529` | 弹出层 |
| `--color-outline` | `#869491` | `#6e6e72` | 中性灰边框 |
| `--color-outline-dim` | `#3c4947` | `#2a2a2e` | 深色边框 |
| `--color-primary` | `#6feee1` 薄荷青 | `#a78bfa` 柔和紫 | 主品牌色 |
| `--color-primary-dim` | `#5adace` | `#8b6cf0` | 渐变起始色 |
| `--color-secondary` | `#bcc7de` | `#2dd4bf` 青绿 | 辅助色 |
| `--color-error` | `#ffb4ab` | `#f87171` | 错误态 |
| `--color-success` | — | `#4ade80` | 新增：播放状态 |

**删除的令牌**：`--color-crt-glow`、`--color-crt-glow-soft`、`--dot-matrix-gap`、`--progress-height`、`--playhead-size`、`--dur-pulse`、`--dur-blink`、`--dur-scanline`、`--tracking-headline`、`--tracking-label`

**新增的令牌**：`--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)`、`--ease-emphasized: cubic-bezier(0.2, 0, 0, 1)`、`--radius-card: 16px`、`--radius-element: 12px`、`--radius-full: 9999px`

---

## 2. 字体方案

**保留**：Inter（body 字体，已加载）

**删除**：
- `Space Grotesk` → 所有 `font-family: var(--font-headline)` 改为 Inter
- `Press Start 2P` → 时钟改用 Inter SemiBold
- `Caveat` → Logo 改用 Inter SemiBold

**排版变化**：
- 删除所有 `text-transform: uppercase` 和 `letter-spacing: 0.08em/0.12em`
- 标题：Inter 600，正常 tracking
- 正文：Inter 400
- 标签：Inter 500，12-13px
- 等宽字体仅保留 CommandInput（保持终端感）

---

## 3. 视觉效果替换

| 当前效果 | 新方案 |
|---|---|
| dot-matrix-bg | 纯深黑背景 `#0a0a0b` |
| CRT scanline-overlay | 删除，ClockPanel 改为渐变背景卡片 |
| GlowDot 脉冲发光 | 简洁实心圆点 + 淡入淡出过渡 |
| SpectrumBars 弹跳 | 圆角条 + 平滑高度过渡（类似 Apple Music） |
| Terminal progress + crab playhead | 平滑圆形滑块 + 20px 圆形播放头 |
| BlockCursor 方块光标 | **删除** |
| 所有 1px 圆角 (rounded-sm) | 卡片 16px / 按钮 12px / 全圆角 9999px |
| box-shadow 发光 | 柔和 box-shadow (0 4px 12px rgba(0,0,0,0.3)) |

---

## 4. 组件改动清单

### Foundation（全局）
| 文件 | 改动 |
|---|---|
| `app/globals.css` | **完全重写** — 替换设计令牌、keyframes、工具类 |
| `app/layout.tsx` | 删除 Space Grotesk / Press Start 2P / Caveat 字体导入；更新 meta |
| `app/page.tsx` | 移除 dot-matrix-bg，容器 rounded-md→rounded-2xl，边框→阴影 |

### Atoms
| 文件 | 改动 |
|---|---|
| `atoms/Logo.tsx` | **完全替换** — 删除 PNG + Caveat 文本，改为 SVG 图标 + Inter 文本 |
| `atoms/Label.tsx` | 移除 uppercase，字体改为 Inter，调整 weight 到 500 |
| `atoms/Badge.tsx` | rounded-full 药丸形，更柔和的背景色 |
| `atoms/ModeSwitch.tsx` | 分段控制器样式，active 用 primary 色白字 |
| `atoms/GlowDot.tsx` | 简单实心圆，删除 glow-pulse 动画 |
| `atoms/SpectrumBars.tsx` | 圆角顶部 + 平滑过渡动画 |
| `atoms/DanmakuToggle.tsx` | 改为 toggle switch 样式 |
| `atoms/BlockCursor.tsx` | **删除** — 从 index.ts 和所有引用中移除 |

### Molecules
| 文件 | 改动 |
|---|---|
| `molecules/ControlBar.tsx` | 按钮 rounded-full，hover 背景色填充（无边框），Material Symbols 图标，现代 tooltip |
| `molecules/SeekBar.tsx` | 圆形播放头（20px），正常大小时间标签（"2:34 / 4:12"），删除像素蟹 |
| `molecules/TrackInfo.tsx` | 标题正常大小写 + text-overflow ellipsis，现代状态标签 |
| `molecules/VolumeControl.tsx` | 4px 轨道，16px 圆角滑块头 |
| `molecules/CommandInput.tsx` | 移除 ▸ 和 block cursor，改为圆角输入框 + 发送按钮 |
| `molecules/ChatMessage.tsx` | 背景填充卡片（无边框），正常大小写标签 |

### Organisms
| 文件 | 改动 |
|---|---|
| `organisms/Player.tsx` | rounded-sm→rounded-2xl，添加卡片阴影 |
| `organisms/Playlist.tsx` | 圆角更新，搜索框圆角，行 hover 背景色替代左边框高亮 |
| `organisms/ClockPanel.tsx` | 删除 scanline-overlay，Press Start 2P→Inter 600，简化为时钟卡片 |
| `organisms/AgentChat.tsx` | 删除 scanline-overlay，现代图标标题 |
| `organisms/StatusBar.tsx` | 简化标签为自然语言，移除大写和版本号 |

### i18n
| 文件 | 改动 |
|---|---|
| `lib/i18n.ts` | ~60 个字符串改为自然语言，移除终端黑话 |

关键字符串变更（en / zh）：
- "NEURAL_AGENT" / "AGENT_01" → "AI Assistant" / "AI 助手"
- "NO SIGNAL" → "No track" / "暂无歌曲"
- "ACTIVE_QUEUE" → "Queue" / "播放列表"
- "SCAN LOCAL" → "Scan locally" / "扫描本地"
- "LIVE FEED" / "STRM_SYNC: ACTIVE" → 简化或删除
- "SYSTEM ONLINE" → "Online" / "已连接"
- "Awaiting operator input…" → "Ask me anything about music…" / "问我任何音乐相关的事…"
- 所有大写标签 → 首字母大写（Title Case）

### 资产
- 删除 `public/aura_logo_1.png`

---

## 5. Logo 新设计

SVG 图标 + Inter SemiBold 文本，双语支持。

**图标概念**：圆内组合音符与声波波纹元素，主色 `#a78bfa`。简洁几何造型，适配桌面应用图标。

**实现**：修改 `atoms/Logo.tsx`，内联 SVG，使用 Inter 字体替代 Caveat。

---

## 6. 实施顺序

| 阶段 | 内容 | 影响 |
|---|---|---|
| **Phase 1** | `globals.css` 设计令牌 + `layout.tsx` 字体清理 | 全局基底变化，组件内联样式尚未同步 |
| **Phase 2** | `page.tsx` 布局容器 → `Player.tsx` / `Playlist.tsx` / `ClockPanel.tsx` / `AgentChat.tsx` | 布局视觉转变 |
| **Phase 3** | 所有 atoms 组件 | 基础控件现代化 |
| **Phase 4** | 所有 molecules 组件 | 交互控件现代化 |
| **Phase 5** | StatusBar + ChatMessage | 细节完善 |
| **Phase 6** | i18n 字符串 + Logo + 删除无用文件 + 最终视觉审查 | 完成 |

---

## 7. 验证

1. `npm run dev` 启动，检查浏览器视觉效果
2. 确认所有组件圆角、颜色、字体正确应用
3. 测试交互状态：hover / focus / active / disabled / loading / empty
4. 播放一首歌曲，验证 SeekBar、ControlBar、TrackInfo 联动
5. 与 AI 对话，验证 ChatMessage 样式
6. 切换语言（中/EN），确认字符串更新
7. 测试弹幕开关
8. 全屏/响应式断点检查（md 768px, lg 1024px）
