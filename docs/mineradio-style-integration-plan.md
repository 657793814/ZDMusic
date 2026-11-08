# ZDMusic × Mineradio 风格整合实施方案

> 版本：v1（方案稿，不含代码改动）
> 主项目：`ZDMusic`（Next.js 16 + React 19 + Tauri v2）
> 参考项目：`Mineradio-paused`（Electron + 原生 JS + Three.js）
> 目标：沿用 ZDMusic 的播放能力与数据，把 Mineradio 的"沉浸式舞台 + 玻璃浮层 + 首屏叙事"变成 ZDMusic 的默认形态。

---

## 0. 结论摘要（先看这 8 条）

1. **不换技术栈**。保留 Next.js 16 + React 19 + Tailwind 4 + Tauri v2；不引入 Electron，不引入 Mineradio 的 vanilla/全局脚本架构。
2. **UI 全部重写，样式只提炼令牌**。Mineradio 的 18,576 行 CSS 绑定在 `#id` 单页 DOM 上，无法直接搬进 React；可以复用的是它的配色/玻璃/字号/动效参数与布局意图。
3. **应用形态从"仪表盘"改成"三层"**：`Home 首屏（空闲）` → `Stage 舞台（播放中）` → `Overlay 浮层（搜索/队列/设置/Agent）`。取消现在"左播放器+右 AI 聊天"的常驻两栏。
4. **播放内核必须先重构**。现有 `PlayerContext` 把"曲库"和"播放队列"合成一个数组，且 `single` 模式语义错误，无法支撑 Mineradio 式的队列快照/继续听/左抽屉。队列模型是 P1，先于一切视觉工作。
5. **AI Agent 降级为可唤出抽屉**，不再占据半屏；语音、识曲、均衡器、睡眠定时改为控制条/设置里的"工具"，不常驻。
6. **不移植第三方音源**（网易云/QQ/酷狗/汽水/Spotify）。账号 Cookie 维护成本与合规风险高于价值。保留 ZDMusic 的本地曲库 + B 站链路。
7. **许可证是硬前置**。Mineradio 是 GPL-3.0，且 README 明确"界面视觉设计归作者所有"；ZDMusic 是 CC-BY-NC-SA-4.0。**只能做"风格借鉴 + 行为重写"，不能复制其 CSS/图片/Logo/预设数据**，否则本项目需整体改为 GPL 并删除 NC 条款。详见 §6.1。
8. **建议分期**：P0 设计基座 → P1 播放内核 → P2 Home / P3 舞台 / P5 浮层（可并行）→ P4 歌词 → P6 曲库与歌单 → P7 Agent 回接 → P8 打磨。P0、P1 必须串行先行。

---

## 1. 现状盘点

### 1.1 ZDMusic 技术栈（实际读到）

| 维度 | 事实 | 依据 |
|---|---|---|
| 框架 | Next.js `^16.2.4`（App Router），React `19.2.4` | `ZDMusic/package.json` |
| 语言 | TypeScript 5 | 同上 |
| 样式 | Tailwind CSS 4（`@import "tailwindcss"` + `@theme inline`）+ CSS 变量 + 少量内联 `style` | `app/globals.css` |
| 状态 | 5 个 React Context：Player / Theme / Agent / Mode / Danmaku，无第三方状态库 | `app/context/*.tsx` |
| 桌面壳 | Tauri v2（Rust），配置 `src-tauri/tauri.conf.json`，能力表 `src-tauri/capabilities/default.json` | `src-tauri/` |
| 服务端 | Next Route Handlers，直接读写本地文件、代理 AI/B站/STT/识曲 | `app/api/**/route.ts` |
| 构建 | `next dev` / `next build` / `tauri dev` / `tauri build`（`scripts/build.sh`） | `package.json`、`start.sh`、`scripts/` |
| 依赖 | `@tauri-apps/api`、`@tauri-apps/plugin-autostart`、`bv2mp3`、`openai` | `package.json` |

### 1.2 ZDMusic 目录结构（实际）

```
app/
  page.tsx                 # 唯一页面：header + 两栏 main + StatusBar（275 行）
  layout.tsx / globals.css / providers.tsx
  context/                 # Player / Theme / Agent / Mode / Danmaku
  components/
    atoms/                 # Logo、Slider、SpectrumBars、AmbientBackground、FullScreenVisualizer/、LyricsDisplay/
    molecules/             # ControlBar、SeekBar、VolumeControl、Equalizer、SettingsDialog、MusicRecognizer、VoiceInput、SleepTimer、DownloadManager、ChatMessage…
    organisms/             # Player、Playlist、AlbumGrid、AgentChat、ClockPanel、StatusBar
  hooks/                   # useAudioPlayer、useAudioVisualizer、useLyrics、useEqualizer、useKeyboardShortcuts、useMediaSession、useSSE、useSleepTimer
  lib/                     # tracks、tags、bili、playlists-store、play-history、theme-presets、i18n、config、fingerprint
  api/                     # chat、lyrics、playlists、tracks、search、bili、stt、music-recognize、system、config、play-history、health
src-tauri/                 # Rust 桌面端
docs/                      # 现有文档
```

关键代码事实：

- 页面骨架在 `app/page.tsx:142-268`：外层居中卡片 `max-w-7xl`，`md:grid-cols-2` 左播放器/均衡器/列表、右时钟/AgentChat。
- 视觉令牌在 `app/globals.css:4-40`：暗紫 `#a78bfa`、`Inter`、`--radius-card: 16px`、`--dur-*` 200/350/500ms。
- 全局 `*` 过渡在 `app/globals.css:307-313`：给**所有元素**加 500ms 的 `background-color/color/border-color/box-shadow` 过渡，是切歌/换主题卡顿的重要来源。

### 1.3 ZDMusic 现有功能清单（含实现位置）

| 功能 | 实现位置 | 备注 |
|---|---|---|
| 本地曲库扫描 | `app/lib/tracks.ts`（`MUSIC_DIR` 默认 `~/Documents/bili`） | **只扫两级目录下的 .mp3**；靠文件名解析「标题-作者-日期-BV」；`id = subDir/filename` |
| 标签/封面/专辑 | `app/api/tracks/metadata/route.ts` + `app/lib/tags.ts` | 按 album 聚合，coverDataUrl |
| 本地文件服务 | `app/api/tracks/[...path]/route.ts` | 支持 Range |
| B站搜索 | `app/lib/bili.ts` + `app/api/bili/search/route.ts` | |
| B站转音频 | `app/api/chat/route.ts` 工具 `convert_bilibili_videos` + `bv2mp3` | |
| 弹幕 | `app/api/bili/danmaku/route.ts` + `DanmakuOverlay` + `DanmakuContext` | 全局浮层 |
| AI Agent | `app/api/chat/route.ts`（工具：`search_tracks` / `search_bilibili` / `convert_bilibili_videos`，711 行）+ `AgentContext` + `AgentChat` | 常驻右栏 |
| 语音控制 | `app/api/stt/route.ts` + `VoiceInput` + `useRecorder` | 阿里云 NLS |
| 听歌识曲 | `app/api/music-recognize/route.ts` + `MusicRecognizer` + `fingerprint.ts` | 本地指纹 / ACRCloud |
| 歌单 | `app/lib/playlists-store.ts` + `app/api/playlists/route.ts` | JSON 存 `ZD_CONFIG_FILE` 同目录，回退 `~/.zdmusic` |
| 播放历史 | `app/lib/play-history.ts` + `app/api/play-history/route.ts` | |
| 播放内核 | `app/hooks/useAudioPlayer.ts` + `app/context/PlayerContext.tsx` | 单 `<audio>` + AudioContext/GainNode |
| 均衡器 | `app/hooks/useEqualizer.ts` + `molecules/Equalizer.tsx` | 10 段，387 行组件，常驻 |
| 歌词 | `app/hooks/useLyrics.ts` + `app/api/lyrics/route.ts` + `atoms/LyricsDisplay` | 2D 逐行高亮 |
| 频谱/可视化 | `app/hooks/useAudioVisualizer.ts`、`SpectrumBars`、`AmbientBackground`（2D canvas）、`FullScreenVisualizer` | 两套独立视觉 |
| 主题 | `app/lib/theme-presets.ts`（6 套）+ `ThemeContext` | 全套色板替换 |
| 多语言 | `app/lib/i18n.ts` | zh-CN / en |
| 睡眠定时 / Media Session / 快捷键 | `useSleepTimer` / `useMediaSession` / `useKeyboardShortcuts` | |
| 系统状态条 | `organisms/StatusBar.tsx` 轮询 `/api/system/stats` | 每 3s |
| 桌面集成 | Tauri 托盘、自启、菜单栏 | `src-tauri/` |

### 1.4 Mineradio 技术栈（实际读到）

| 维度 | 事实 | 依据 |
|---|---|---|
| 运行形态 | Electron（`main: desktop/main.js`，248KB）+ 本地 HTTP（`server.js`，270KB） | `package.json` |
| 前端 | **无框架**，`public/index.html` 1,932 行单文件 | `public/index.html` |
| 脚本组织 | 103 个文件按顺序同步 XHR 读入、拼成单个 `<script>` 注入，全部全局函数 | `public/js/index-loader.js:3-99` |
| 样式 | 单个 `public/css/index.css`，**18,576 行**，大量 `#id` 选择器 | `wc -l` |
| 渲染 | Three.js r128 + GSAP + music-tempo（均为全局 `<script>`） | `public/index.html:12-14` |
| 构建 | `electron-builder`，仅 Windows NSIS | `package.json` |
| 授权 | GPL-3.0；README 声明"MR Logo、Mineradio 名称、界面视觉设计与原创视觉表达归作者所有" | `README.md` |

### 1.5 Mineradio 页面构成与功能

| 区域 | 结构 / 行为 | 依据 |
|---|---|---|
| Home 首屏 | `#empty-home` 固定定位，`1240px`，2 列 grid；hero（日期/时间/每日回顾/自定义 MP4/h1/副标题/快捷 chip）、今日聆听 3 项指标、队列下一首卡、发现条、tile 行 | `public/index.html:162-278`；`css/index.css:2314-2490` |
| 顶部搜索 | 居中浮层 `#search-area`：输入框 + 6 个音源 tab（歌/网易云/QQ/酷狗/汽水/播客）+ 下拉结果 + 导入面板 | `public/index.html:100-160` |
| 左队列抽屉 | `#playlist-panel`：贴左边缘、hover 唤出、可 pin；三 tab（当前队列/我的歌单/我的播客）；随机/清空/切模式 | `public/index.html:1106-1164`；`css/index.css:14347-14390` |
| 底部控制条 | 胶囊 `min(1080px)`，自动隐藏；`#bottom-handle` 236×28 的唤起把手；三簇（action / transport / modes）；进度条 hover 增高 | `css/index.css:5019-5201`；`5298-5330` |
| 左下角封面 | 64px 封面 + 标题/歌手，点击打开详情 | `public/index.html:1200-1209` |
| 舞台歌词 | Three.js 网格歌词；CSS 版 `#stage-lyrics` 有 3D 入场/漂浮/出场关键帧 | `css/index.css:16538-16635`；`js/modules/02-visual/14-stage-lyrics-rendering.js` |
| 封面粒子世界 | 专辑封面采样成点云，鼠标拖拽/滚轮/双击交互 | `js/modules/02-visual/00-pointer-cover-particles.js`（1,188 行） |
| 节拍镜头 | 用 music-tempo 分析节奏，驱动电影镜头/粒子/溢光 | `js/modules/01-scene/02-beat-camera-runtime.js`、`03-beat/01-audio-beat-analysis.js` |
| 视觉控制台 | 预设网格 + 用户存档 + 取色（含从封面取色）+ 粒子/歌词/歌单架 30+ 滑杆 | `public/index.html:340-1102` |
| 3D 歌单架 | 右键唤出，`side`/`stage` 两种模式，动态/静态镜头，PSP 式滚动 + 二级详情 | `js/modules/04-shelf/01-manager-core.js`（925 行） |
| 播放增强 | 队列快照恢复、音源回退、音质/输出设备切换、淡入淡出、歌词时间偏移 ±5s | `js/modules/05-playback/09/11/08`、`06-lyrics/06` |
| 今日聆听统计 | localStorage 累计总时长/每日/连续天数 | `js/modules/05-playback/02-listen-stats.js` |
| 桌面模式 | 自定义标题栏、壁纸模式、桌面歌词、全局热键、托盘 | `desktop/main.js`、`desktop/preload.js` |
| 手势控制 | 摄像头 21 关键点：张掌/捏合/握拳/滑动/V 手势…… | `js/modules/10-shell/00-gesture-control.js` |
| 本地曲库 | Electron 侧导入、封面缓存、元数据并发 3 | `desktop/local-music-library.js` |

> 注意：Mineradio 的"完整桌面模式 / Wallpaper Engine / 手势 / 多音源登录"是它最重、也最不可移植的部分。本方案只取"舞台 + 浮层 + 首屏"三件套。

### 1.6 两栈差异对照

| 项目 | 组件化 | 样式作用域 | 状态管理 | 动画实现 | 可复用性 |
|---|---|---|---|---|---|
| ZDMusic | React 组件 | CSS 变量 + Tailwind | Context | CSS/Canvas | 业务逻辑 ✅，视觉 ❌ |
| Mineradio | 无 | 全局 `#id` | 全局变量 + localStorage | GSAP/CSS/Three | 视觉意图 ✅，代码 ❌ |

结论：**不存在"把 Mineradio 页面搬进来"的可行路径**。可行路径是"以 Mineradio 为设计规范，在 React 中重建"。

---

## 2. 风格与交互提炼

### 2.1 视觉语言：可落地的令牌

从 `public/css/index.css:367-428` 实际提取：

| 类别 | 令牌 | 值 | 用途 |
|---|---|---|---|
| 背景 | `--fc-bg` | `#08090B` | 应用底色（纯黑 `#000` 仅用于全屏舞台） |
| 纸面 | `--fc-paper` | `#0E1014` | 悬停/次级面板 |
| 主墨 | `--fc-ink` | `#E8ECEF` | 主文本（≈ 92% 白） |
| 次墨 | `--fc-ink-2` / `--fc-muted` | `#D2D7DC` / `#8A9099` | 副标题 / 弱文本 |
| 发丝线 | `--fc-hair` / `--fc-hair-2` | `#1A1D22` / `#262A31` | 分割线、输入框边 |
| 强调色 | `--fc-accent` | `#FFFFFF` | 界面高亮（默认白，不抢封面） |
| 青绿 | `--home-accent` | `#00F5D4` | Home 填充/选中态 |
| 香槟 | `--champagne` | `#F4D28A` | 3D 歌单架/图标点缀 |
| 冷蓝 | `--visual-tint` | `#9db8cf` | 视觉主色/歌词辉光 |

**关键判断：它不是"紫色主题"。** 主色是白 + 封面取色，青绿/香槟只是两个固定点缀。ZDMusic 现在"暗紫 + 青绿 secondary"的二元品牌色，应替换为"中性白 + 封面主色 + 两个固定点缀"。

**字体**：Mineradio 用 `Noto Sans SC / PingFang SC / HarmonyOS Sans SC / Inter`，数字用 `JetBrains Mono`。ZDMusic 现在用 `Inter`。建议：
- 正文 `Noto Sans SC`（系统 `PingFang SC` 优先，避免本地打包 10MB 字体）；
- 时间/进度/统计用等宽（`JetBrains Mono` 或 `SF Mono`）；
- **不要引入** `Cinzel Decorative` / `UnifrakturCook`（那是 Mineradio 的品牌字体，属于其视觉识别）。

**字号层级**（实际出现值）：
- 小标：`10px / 780 / letter-spacing .18em / uppercase`（`.home-kicker`）
- 正文：`11-13px`，弱文本 opacity `.45-.62`
- 标题 H1：`clamp(34px, 4.6vw, 58px) / 760 / line-height .98`
- 舞台歌词：`clamp(34px, 5.6vw, 76px) / 700 / letter-spacing 2px`

**材质**：
- 卡片玻璃 `linear-gradient(112deg, rgba(72,74,76,.62), rgba(24,27,30,.70) 48%, rgba(8,12,14,.74))` + `1px rgba(0,245,212,.30)` 边 + `0 22px 64px rgba(0,0,0,.30)` + `inset 0 1px 0 rgba(255,255,255,.16)`
- 底栏玻璃 `rgba(0,0,0,.10)` + `blur(12px) saturate(1.8) brightness(1.16)` + 内圈高光
- 抽屉 `rgba(12,12,18,.42)` + `blur(40px) saturate(1.4)` + `20px` 圆角

**圆角**：28px（hero 大卡）/ 20px（抽屉）/ 18px（popover）/ 14px（次级）/ 12px（封面）/ 50px 或 999px（底栏与 chip）。

**动效**：
- 统一曲线 `cubic-bezier(.16, 1, .3, 1)`（expo-out），对应 ZDMusic 的 `--ease-emphasized`；
- 入场：`opacity 0 → 1` + `translateY(18px) → 0` + `scale(.992) → 1`，720ms；
- 底栏：`translateY(36px) scale(.972) → 0/1`，460ms；
- 歌词：3D 入场 900ms（`translate3d + rotateX/Y + blur(14px) → 0`），出场 700ms；常驻漂浮 5.6s 循环。

### 2.2 布局骨架（核心差异）

现在的 ZDMusic 是"窗口里的一张卡片，卡片里填满面板"：
```
[居中 max-w-7xl 卡片]
  header
  ├─ 左：Player + EQ + Playlist(50%)
  └─ 右：Clock + AgentChat(50%)
  StatusBar
```

Mineradio 是"全窗口舞台 + 悬浮控件"：
```
canvas 背景（封面粒子/纯色/壁纸）
  ├─ 顶部：搜索浮层（居中，可隐藏）
  ├─ 右上：账号/主页/更新（34px icon btn）
  ├─ 左侧：队列抽屉（贴边，hover 唤出，可 pin）
  ├─ 左下：64px 封面 + 曲名
  ├─ 底部：胶囊控制条（自动隐藏 + 唤起把手）
  └─ 舞台：歌词/粒子/镜头（默认无 UI）
```

**这是整套改造的真正价值点**：不是换配色，是把"面板堆叠"换成"沉浸层 + 按需浮层"。ZDMusic 可以保留 Tauri 窗口，但内部不再有"大卡片边界"。

### 2.3 组件形态清单

| 形态 | 规格 | ZDMusic 对应改造 |
|---|---|---|
| 胶囊 chip | h28-32 / radius 999 / 1px `rgba(255,255,255,.11)` / bg `.060` | 替换所有 `rounded-full border` 小按钮 |
| 图标按钮 | 34×34 / radius 15 / 玻璃 / hover 提亮 1px 上浮 | header 的 SVG 按钮统一 |
| 玻璃 popover | 244-276px 宽 / radius 18 / `blur(20-28px)` / 上浮 8px 入场 | VolumeControl、SleepTimer、EQ、音质切换 |
| 浮层抽屉 | 340-430px / radius 20 / 左边缘 / 40px blur | 取代 Playlist 面板 |
| 中心 modal | `0 0 0 100vw` 遮罩 + 玻璃卡 | SettingsDialog、Agent |
| 大卡 hero | 28px 圆角 / 双层渐变 / 内部网格纹 | Home 首屏 |

### 2.4 交互做法（值得搬的 9 条）

| # | 交互 | Mineradio 证据 | 落地方式（React） | 价值 |
|---|---|---|---|---|
| I1 | **控制条自动隐藏 + 把手唤出** | `#bottom-handle`（236×28，opacity .14）+ `body.controls-visible` | `useAutoHideControls`：播放中 3s 无鼠标 → `soft-hidden`；鼠标到底部/快捷键 → 显示 | 高：舞台纯净 |
| I2 | **左侧队列抽屉 hover 唤出 + pin** | `#playlist-panel.show/.peek/.pinned`，280ms 开关 | 鼠标距左边缘 <24px 打开；离开 300ms 关闭；pin 常开 | 高：取代现在的列表面板 |
| I3 | **顶部搜索浮层 + 音源 tab** | `#search-area` + `#search-mode-tabs` | 单一 SearchOverlay，`Cmd+K` 唤起；本地/B站两个 tab（不接第三方） | 高 |
| I4 | **Home 首屏与播放态切换** | `body.empty-home-active`，队列空时显示 | `view = home \| stage`，队列空/主动回 Home 时显示 | 高：首屏叙事 |
| I5 | **今日聆听 + 继续听** | `home-listen-*`、`home-next-card`、listen rollup | 复用 `play-history` + 新队列快照 | 中高：情感连接 |
| I6 | **进度条 hover 增高 + 拖拽** | `#progress-bar:hover` h4→5，`is-dragging` | 现有 SeekBar 重做 | 中 |
| I7 | **音量 popover 含淡入淡出** | `fade-in-slider` / `fade-out-slider` | 音量按钮弹出：音量 + 淡入秒数 + 淡出秒数 | 中高 |
| I8 | **歌词时间偏移 ±5s** | `06-lyric-timing-offset.js`，按歌曲持久化 | 歌词 hover 出现微调；写 `lyric-offsets.json` | 中高：实用 |
| I9 | **全局热键可配置** | `HOTKEY_ACTIONS`：Space/←/→/↑/↓/F/Alt+L | 保留本地键位；全局热键通过 Tauri `global-shortcut` 插件 | 中：桌面端需要 |

不建议搬的交互：摄像头手势（依赖 MediaPipe + 摄像头权限，macOS 权限与性能成本高）、Wallpaper Engine、Electron 专属的桌面图标层、多音源登录流程。

### 2.5 哪些是"纯样式可复用"，哪些必须重写

| 类别 | 可复用程度 | 说明 |
|---|---|---|
| 色板 / 字号 / 圆角 / 阴影 / 动效曲线 | ✅ 纯参数 | 直接写成 CSS 变量，与实现无关 |
| 玻璃材质组合 | ✅ 纯参数 | `backdrop-filter` + 渐变 + 内高光，可写 utility class |
| 布局意图（全屏舞台 + 浮层） | ✅ 结构决策 | 需要在 React 里重新组织 DOM |
| 组件 DOM/CSS 规则 | ❌ | 18,576 行 `#id` 规则，React 无对应 DOM |
| 播放队列/快照逻辑 | ❌ 需重写 | 全局变量 + localStorage，且依赖它的 song schema |
| 封面粒子/3D 歌词 | ⚠️ 只借算法 | 需从全局脚本中剥离成 ES module，且注意 GPL |
| 视觉控制台（30+ 滑杆） | ⚠️ 建议裁剪 | 全量搬会引入巨大的设置复杂度 |
| 第三方音源 API | ❌ 不搬 | 登录态/风控/合规 |

---

## 3. 取舍建议（保留 / 重做 / 删除）

### 3.1 保留（业务与数据不动，UI 重新挂载）

| 功能 | 理由 | 迁移动作 |
|---|---|---|
| 本地曲库扫描 + 文件服务 | 核心资产，`id = subDir/filename` 必须保持 | 只改展示；`tracks.ts` 不动 |
| 标签/封面/专辑元数据 | 舞台视觉依赖封面 | 保留 API；新增客户端 `useCoverPalette` |
| B站搜索 + 转音频 | 差异化能力，成本已沉没 | 收进 SearchOverlay 的第二个 tab |
| 歌词 API + LRU 缓存 | 舞台歌词的数据源 | 保留 `useLyrics`，替换渲染层 |
| 歌单 JSON / 播放历史 | 用户数据 | 保留 store；歌单 UI 重做 |
| AI Agent 工具链 | 特色功能 | 改挂到抽屉 + 命令面板 |
| 语音 / 识曲 | 特色功能 | 收进命令面板/设置，不占主界面 |
| 均衡器 / 睡眠定时 / 倍速 | 实用 | 变成 popover / 抽屉 |
| Media Session / 本地快捷键 | 桌面体验 | 保留并扩展 |
| Tauri 托盘/自启/配置 | 桌面壳 | 不动 |
| i18n | 已支持中英 | 保留，新增文案键 |

### 3.2 重做（保留功能意图，实现替换）

| 功能 | 现状问题 | 重做方向 |
|---|---|---|
| 播放内核 | `PlayerContext` 只有 `playlist + index`；`single` 模式在 `next()` 里被当作顺序播放（`PlayerContext.tsx:255-280`）；`prev()` 到 0 就停（`:282-291`）；`scanLocalTracks()` 直接覆盖队列（`:318-335`） | 拆成 `library / queue / playback` 三层，见 §4.2 |
| 主页面 | 两栏面板堆叠，AI 聊天占 50% | 三层结构（Home/Stage/Overlay） |
| Playlist 组件（915 行） | 列表 + 歌单管理 + 收藏 + toast 全在一个文件 | 拆成 `QueueDrawer` / `PlaylistPanel` / `TrackRow` |
| AlbumGrid（605 行） | 头部 toggle 里的一份"视图" | 变成 `LibraryOverlay` 的一个 tab |
| LyricsDisplay | 2D 逐行，独立整页 | 舞台层内的 3D 歌词 + 可选"专注歌词"模式 |
| AmbientBackground / FullScreenVisualizer | 两套视觉、互不相干 | 合并为 `StageCanvas`（封面粒子 + 节拍镜头） |
| SettingsDialog（540 行） | 单页长表单 | 分组抽屉（外观/声音/曲库/账号/AI/快捷键） |
| 主题系统 | 6 套整色板替换，且全局 `*` 过渡 | 单一暗底 + 强调色/封面取色 + 密度开关 |
| Equalizer（387 行） | 常驻占位 | `SoundPopover` 内折叠 |
| VolumeControl / SeekBar / ControlBar | 独立小控件 | 组成 `PlayerDock`，统一玻璃与尺寸 |

### 3.3 建议删除（或降级为可选）

| 对象 | 理由 | 处置 |
|---|---|---|
| `StatusBar`（CPU/内存轮询） | 与"沉浸音乐"目标冲突；每 3s 请求 `/api/system/stats`，只在调试时有价值 | **删除**，或移到"关于/诊断"抽屉 |
| `ClockPanel` | 与 Home hero 的日期时间重复 | **合并进 Home hero**，删除独立组件 |
| `DanmakuOverlay` 全局弹幕层 | 弹幕是视频产物，覆盖全屏会破坏舞台视觉与歌词可读性 | **默认删除**；需要时作为歌词模式下的开关（Phase 8 可选） |
| 常驻 `AgentChat` 右栏 | 抢走 50% 视觉重心；聊天不应与播放并列 | 降级为 `Cmd+/` 抽屉 + 命令面板 |
| `ModeSwitch`（local/cloud） | 队列模型统一后，"模式"概念可由数据源自动判定 | 删除；搜索浮层里用 tab 表达 |
| 下载管理器常驻入口 | 下载是低频操作 | 收进队列项状态 + 设置 |
| 6 套整色板主题 | 与"封面取色 + 白/青绿/香槟"冲突；维护成本高 | 保留 1 暗 + 1 浅（可选）+ 强调色选择 |
| 全局 `*` 500ms 颜色过渡（`globals.css:307-313`） | 造成切歌/滚动卡顿 | **删除**，改为按组件显式过渡 |
| B站弹幕 API | 若删除弹幕层，API 可保留但不再默认调用 | 保留代码，前端不挂载 |
| 第三方音源（不新增） | 账号 Cookie/风控/合规/维护 | 不移植 |

---

## 4. 目标方案

### 4.1 应用形态与导航

**单窗口、单 Next 路由、三层视图**（不做多 route，桌面端无刷新更稳）：

```
app/page.tsx  →  <AppShell>
                    ├─ <StageBackground />         // 全窗口：封面模糊 / 纯色 / 粒子画布
                    ├─ <HomeView />                // 空闲态：首屏叙事
                    ├─ <StageView />               // 播放态：歌词 + 粒子 + 左下曲目
                    └─ <OverlayLayer />            // 按需浮层（互斥或可叠）
                         ├─ SearchOverlay          // Cmd+K
                         ├─ QueueDrawer            // 左边缘 hover / pin
                         ├─ LibraryOverlay         // 曲库：歌曲/专辑/歌单
                         ├─ SettingsDrawer
                         ├─ AgentDrawer            // Cmd+/
                         └─ CommandPalette         // 语音/识曲/均衡器/睡眠/切换
```

导航规则：
1. 启动 → 若有上次队列且有"继续听" → `StageView` 暂停态；否则 → `HomeView`。
2. 任意播放动作 → `StageView`；`Esc` / 返回 Home → `HomeView`（音乐继续）。
3. 搜索/设置/Agent/曲库都是 Overlay，不切换主视图。
4. 窗口尺寸 < 960px 时，左抽屉改为底部 sheet；控制条退化为两行。

**页面骨架（DOM 层级）**

```
<div id="app" data-view="home|stage">
  <canvas id="stage-canvas"      z-0 />
  <div    id="stage-cover-blur"  z-0 />       // CSS 模糊封面，低配回退
  <main  id="view-home"          z-4 />
  <section id="view-stage"       z-4 />
  <aside  id="queue-drawer"      z-17 />
  <div    id="search-overlay"    z-22 />
  <footer id="player-dock"       z-6 />       // 含 handle
  <div    id="overlay-root"      z-30 />
</div>
```
z-index 分层直接沿用 Mineradio 的经验值（4/6/17/22/30），避免浮层互相压。

### 4.2 播放器核心状态模型（P1 的关键产出）

现状问题：`PlayerState.playlist` 同时是"曲库"和"播放队列"，`index` 是唯一游标。结果是：搜索并播一首歌会把整个曲库替换成单曲（`PlayerContext.tsx:225-253`）、无法恢复上次队列、无法支持"下一首播放"、删除当前项会自动跳播。

目标模型：

```ts
// app/lib/types.ts（重构）
export type TrackSource = "local" | "bilibili";
export type RepeatMode = "off" | "track" | "queue";

export interface Track {
  id: string;            // 不变：`${subDir}/${filename}`
  source: TrackSource;
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string | null;
  duration?: number;
  url: string;           // 不变：/api/tracks/...
  bvid?: string;
}

export interface QueueItem {
  uid: string;           // 运行时唯一（同一首歌可在队列出现两次）
  trackId: string;
  origin: "library" | "playlist" | "search" | "bili" | "agent";
  addedAt: number;
}

export interface PlaybackState {
  queue: QueueItem[];
  currentUid: string | null;
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  rate: number;
  fadeIn: number;        // 秒
  fadeOut: number;       // 秒
}
```

三个独立 store（仍用 Context + reducer，不引第三方库）：
- `LibraryStore`：`tracks`、`albums`、`scan()`、`search(q)` —— 只读视图。
- `QueueStore`：`queue`、`currentUid`、`add/remove/move/clear/replace/shuffleQueue`。
- `PlaybackStore`：音量/播放态/进度/重复/倍速/淡入淡出；对 `<audio>` 与 `AudioContext` 拥有唯一写权限。

播放规则（修正现有 bug）：
| 场景 | 规则 |
|---|---|
| `repeat=off` 播完最后一首 | 停止，`playing=false`，进度停在末尾 |
| `repeat=queue` | 回到队首 |
| `repeat=track` | 单曲重播，不换 `currentUid` |
| `shuffle=true` | `next` 从"未播集合"随机；队列顺序不变 |
| `prev` 在第一首 | 若 `progress > 3s` 回到 0，否则循环到队尾 |
| 删除当前项 | 暂停 → 队列非空时**不自动播放**（交给用户） |
| 播放搜索结果 | `replaceQueue([item])`，不触碰 library |

持久化：
- `~/.zdmusic/player-state.json`（`ZD_CONFIG_FILE` 同目录，生产为 App Support）：`queue`(最多 500 条)、`currentUid`、`progress`、`repeat`、`shuffle`、`volume`。
- `~/.zdmusic/lyric-offsets.json`：`{ [trackId]: seconds }`。
- 关键用户偏好**不要只放 localStorage**（Tauri 的 WebView 数据可能被清），统一走文件配置。

引擎：保留 `useAudioPlayer`（单 `<audio>` + AudioContext/GainNode），补充：
- 淡入/淡出：在 `play/pause` 前后对 GainNode 做 0→volume 的线性/指数 ramp；
- 切歌交叉淡出：旧曲 fadeOut 后 `src` 切换（可选 P8）；
- 封面取色：`useCoverPalette(coverUrl)` 用离屏 canvas 提取主色，注入 CSS `--tint`（同源受 CORS 限制，本地 `/api/tracks/**` 同源可用）。

### 4.3 组件层级与目录（目标）

```
app/
  styles/
    tokens.css            # 新：颜色/字号/圆角/阴影/动效令牌
    glass.css             # 新：.glass-panel / .glass-pill / .glass-popover
    stage.css             # 新：舞台歌词/画布/淡入淡出
  components/
    ui/                   # 设计系统原子：IconButton、Chip、Pill、Popover、Sheet、Slider、Progress
    shell/AppShell.tsx
  features/
    home/HomeView.tsx, HeroPanel.tsx, TodayStats.tsx, ContinueCard.tsx, DiscoveryStrip.tsx
    stage/StageView.tsx, StageCanvas.tsx, StageLyrics.tsx, TrackThumb.tsx
    player/PlayerDock.tsx, ProgressBar.tsx, TransportCluster.tsx, VolumePopover.tsx, SoundPopover.tsx
    queue/QueueDrawer.tsx, QueueList.tsx, TrackRow.tsx
    library/LibraryOverlay.tsx, AlbumGrid.tsx, PlaylistPanel.tsx
    search/SearchOverlay.tsx, SearchResults.tsx
    agent/AgentDrawer.tsx, CommandPalette.tsx
    settings/SettingsDrawer.tsx (+ 分组面板)
  context/                # library / queue / playback / ui
  hooks/                  # useAudioEngine, useAutoHideControls, useCoverPalette, useBeat, useStageCamera
```

迁移策略：`atoms/molecules/organisms` 不作为最终形态保留；能复用的纯控件（Slider、SeekBar、VolumeControl 的内部计算）先挪进 `components/ui`，其余随视图重写。`organisms/Playlist.tsx` 的 API 交互逻辑（歌单 CRUD、添加弹窗、toast）抽成 `features/library/usePlaylists.ts` 再复用。

### 4.4 样式体系

1. **令牌先行**：`app/styles/tokens.css` 定义 §2.1 全部变量，`app/globals.css` 的 `@theme inline` 改为映射这些变量，现有 Tailwind 类名逐步退场。
2. **停止"主题=换整套色板"**：改为
   - `data-theme="dark"`（唯一，默认）；
   - `--tint` 由封面注入（封面无图时用 `#9db8cf`）；
   - `--accent` 固定白；`--accent-home` 青绿；`--accent-shelf` 香槟；用户仅可在设置里换 `--accent`（3 个备选）。
3. **玻璃 utility**：`.glass-panel` / `.glass-pill` / `.glass-popover` 三个类，参数来自 §2.1，禁止组件内再写 `backdrop-filter`。
4. **动效**：`--ease-out-expo: cubic-bezier(.16,1,.3,1)`；时长 `--dur-1: .16s`、`--dur-2: .28s`、`--dur-3: .46s`、`--dur-4: .72s`。只对 `transform/opacity` 做过渡；**移除全局 `*` 颜色过渡**。
5. **可读性兜底**：玻璃层在亮封面上会失读 → 所有浮层加 `--scrim` 背景（`rgba(8,9,11,.55)`）或 `text-shadow`，不依赖单一 `backdrop-filter`。
6. **密度**：`data-density="cozy|compact"` 控制 `--space-*`，适配 13 寸屏与大屏。

### 4.5 技术选型决定

| 决策 | 结论 | 理由 |
|---|---|---|
| 桌面壳 | **继续 Tauri** | 已有托盘/自启/配置/打包；换 Electron 等于重做一半 |
| 前端框架 | **继续 Next/React** | 现有 API、数据、AI 链路都在这 |
| 样式 | **Tailwind 4 + 新令牌 + 3 个玻璃类** | 不引入 CSS-in-JS；不搬 18k 行 CSS |
| 舞台渲染 | **新增 `three`（按需动态 import）** | 封面粒子/3D 歌词必须 WebGL；仅 StageView 加载 |
| 动画 | **CSS/WAAPI 为主**，不引入 GSAP | 当前 UI 动效用 CSS 足够；GSAP 只在 3D 歌单架阶段评估 |
| 状态 | **Context + reducer**，初期不引 Zustand | 减少迁移面；若队列/播放跨组件性能不足，P8 再评估 |
| 字体 | 系统 `PingFang SC` + `Inter` + 系统等宽 | 避免打包大字体；不引入 Mineradio 品牌字体 |
| 音频 | 保留 `<audio>` + WebAudio | 现有 EQ/频谱已依赖 |
| 热键 | 本地键位保留；全局热键用 Tauri `global-shortcut` 插件 | Electron `globalShortcut` 不可用 |
| 多语言 | 保留 i18n | 新文案双写 |

### 4.6 两个项目代码的复用方式（明确结论）

| 对象 | 方式 | 说明 |
|---|---|---|
| UI 组件 / 页面布局 | **照着重写** | Mineradio 是全局 DOM + ID CSS，无法组件化复用 |
| 设计令牌 / 玻璃配方 / 动效曲线 | **拷贝参数** | 数值层面的视觉语言，不构成代码复制 |
| 歌词同步与布局算法 | **重写**（参考其思路） | `02-visual/02-lyrics-state-layout.js` 的"3 行上下文 + 焦点行缩放"思路可用 |
| 封面粒子几何 | **重写**（参考其思路） | 采样网格 + 点精灵；`00-pointer-cover-particles.js` 只读流程 |
| 节拍分析 | **重写** | 可继续用现有 `useAudioVisualizer` 的 AnalyserNode；不引入 music-tempo |
| 3D 歌单架 | **先不做**，P6b 再评估 | 925 行 + 相机/详情/二级列表，成本与收益需单独立项 |
| 视觉控制台 | **裁剪为 6 项** | 只保留：强调色、歌词大小、歌词位置、辉光强度、粒子密度、背景媒体 |
| 图标 / Logo / 预设存档 / `.bin` 资源 | **不使用** | 属于 Mineradio 视觉识别与作者版权 |
| 第三方音源适配 | **不使用** | 合规与维护成本 |

### 4.7 必须保留的数据契约

| 契约 | 位置 | 约束 |
|---|---|---|
| 曲目 id | `app/lib/tracks.ts` | `${subDir}/${filename}`，不得改成 hash |
| 音频 URL | `/api/tracks/{subDir}/{filename}` | 前端持久化队列只存 `trackId`，播放时再解析 |
| 配置目录 | `app/lib/config.ts` / `playlists-store.ts` | `ZD_CONFIG_FILE` 优先，回退 `~/.zdmusic` |
| 配置键名 | `~/.zdmusic/config.json` | 只新增 `ui.*` / `playback.*`，不改旧键 |
| 歌单结构 | `{ playlists: [{id,name,nameEn,trackIds,createdAt,updatedAt}] }` | 新增字段必须可选 |
| 扫描根目录 | `MUSIC_DIR` | 默认 `~/Documents/bili`，可用 env 覆盖 |

---

## 5. 分阶段实施计划

> 每个阶段都以"可运行、可回退"为交付标准。P0/P1 串行；P2/P3/P5 可在 P1 后并行；P4 依赖 P3；P6 依赖 P1；P7 依赖 P5。

### 阶段总表

| 阶段 | 名称 | 依赖 | 可并行 | 主要文件范围 | 完成判据（DoD） |
|---|---|---|---|---|---|
| **P0** | 设计基座与 AppShell | 无 | — | `app/styles/*`、`app/globals.css`、`app/page.tsx`、`components/ui/*`、`components/shell/*` | 空壳可启动；令牌/玻璃类可用；窗口无滚动条；旧页面已移除但功能入口以浮层占位 |
| **P1** | 播放内核重构 | P0 | — | `app/lib/types.ts`、`app/context/{library,queue,playback}*`、`hooks/useAudioPlayer`、`api/play-history`、新 `lib/player-state.ts` | 队列增删改排/快照恢复/重复三态/随机/淡入淡出全部通过；`trackId` 与 URL 不变；重启恢复上次队列 |
| **P2** | Home 首屏 | P1 | ✅ 与 P3/P5 | `features/home/*`、`api/play-history`（只读） | 空队列启动进 Home；今日聆听数据来自历史；继续听可一键续播；发现条可用 |
| **P3** | 舞台层 | P1 | ✅ | `features/stage/*`、`hooks/useStageCamera.ts`、`styles/stage.css`、动态引入 `three` | 播放进入舞台；封面粒子 60fps（13 寸 M 系）；控制条 3s 自动隐藏/把手唤出；封面缺失有纯色回退 |
| **P4** | 歌词舞台 | P3 | ❌ | `features/stage/StageLyrics.tsx`、`hooks/useLyrics.ts`、`api/lyrics`、`lyric-offsets` | 三行上下文 + 焦点行；同步误差 ≤150ms；偏移 ±5s 持久化；无歌词降级为封面态 |
| **P5** | 浮层体系 | P0/P1 | ✅ | `features/search/*`、`features/queue/*`、`features/settings/*`、`components/ui/Popover|Sheet` | Cmd+K 搜索（本地/B站）；左边缘队列抽屉 hover/pin；设置分 6 组；快捷键可用 |
| **P6** | 曲库与歌单 | P1 | ✅ | `features/library/*`、`api/playlists`、`lib/playlists-store` | 歌曲/专辑/歌单三 tab；歌单 CRUD；"下一首播放"入队；旧 `playlists.json` 可读 |
| **P6b** | 3D 歌单架（可选） | P6 | ❌ | `features/shelf/*` | 仅在 P6 完成后评估；不做则记为明确不做 |
| **P7** | Agent 回接 | P5 | ✅ | `features/agent/*`、`api/chat/*`、`api/stt`、`api/music-recognize` | Cmd+/ 打开抽屉；工具调用仍可用；语音/识曲从命令面板可触发 |
| **P8** | 打磨与迁移 | P3-P7 | — | 全局样式、`src-tauri`、打包脚本、i18n | 性能预算达标；打包可运行；旧功能逐项回归；文档更新 |

### P0 设计基座与 AppShell

- 目标：把 §2.1 的视觉语言变成可复用代码，页面只剩三层骨架。
- 交付：
  1. `app/styles/tokens.css`：颜色/字号/圆角/阴影/动效/密度变量；
  2. `glass.css`：`.glass-panel/.glass-pill/.glass-popover`；
  3. `components/ui`：`IconButton`、`Chip`、`Popover`、`Sheet`、`Slider`；
  4. `AppShell` + 空 `HomeView/StageView/OverlayLayer`；
  5. 删除 `page.tsx` 的两栏布局与 `StatusBar` 挂载。
- 判据：`npm run dev` 打开是纯黑舞台 + 一个可唤出的控制条占位；切换 3 个强调色不闪烁；DevTools 无 React key 警告。
- 风险：一次性删旧 UI 会让中间态不可用 → 采取"分支 + 每阶段可运行"，不保留双 UI。

### P1 播放内核重构

- 目标：让队列/曲库/播放态解耦，修掉现有 4 个语义 bug。
- 文件：
  - 改 `app/lib/types.ts`（新增 `QueueItem/PlaybackState`，`Track` 加 `source`）；
  - 新增 `app/lib/player-state.ts`（读写 `player-state.json`）；
  - 拆 `PlayerContext` → `LibraryProvider` / `QueueProvider` / `PlaybackProvider`；
  - 改 `hooks/useAudioPlayer.ts`：淡入淡出、`rate`、`ended` 回调改为由 QueueStore 决策；
  - `app/api/play-history` 仅记录，不参与播放决策。
- 判据（逐条验证）：
  1. 搜索单曲播放不破坏 library；
  2. 队列中同一首歌出现两次，`currentUid` 不错位；
  3. `repeat=track` 单曲循环；`off` 播完停；`queue` 回首；
  4. `prev` 在第一首且进度 >3s 时回 0；
  5. 关闭应用再打开，队列与进度恢复；
  6. 删除当前项不自动跳播。
- 风险：`play-history` 与队列写入并发 → 统一走一个 `persist()` 串行队列。

### P2 Home 首屏

- 目标：启动即"有内容"，替代现在的空列表。
- 内容：Hero（`HH:MM` 等宽大号 + 日期/星期 + 一句状态文案）、今日聆听（分钟/首/最长连续）、继续听（队列快照）、发现条（最近入库 8 首 + 可选 Agent 推荐）、快捷 chip（导入音乐 / 搜索 / 继续听）。
- 数据：`/api/play-history` 聚合；无历史显示"开始播放后生成"。
- 判据：首次启动无数据也完整；点"继续听"直接恢复队列与进度；窗口 960px 下不溢出。

### P3 舞台层

- 目标：播放态成为默认视觉中心。
- 组件：`StageCanvas`（封面采样点云 + 节拍位移 + 鼠标视差）、`StageLyrics` 占位、`TrackThumb`（左下 64px）、`PlayerDock`（底栏 + handle）。
- 技术要点：
  - `three` 动态 `import()`，只在 stage 挂载；
  - `devicePixelRatio` 上限 2；`prefers-reduced-motion` 与低电量（`navigator.getBattery` 可选）降级为 CSS 模糊封面；
  - 无封面时用取色渐变 + 噪点，不空白。
- 判据：粒子首帧 <1s；连续播放 10 分钟无内存增长（Heap 快照对比）；切歌不闪黑；控制条 3s 自动隐藏且任意鼠标移动 80ms 内唤出。

### P4 歌词舞台

- 目标：以"3 行上下文 + 1 焦点行"的 3D 文本替代 2D 列表。
- 数据：沿用 `useLyrics` 的 `LyricLine[]`；新增 `lyric-offsets.json`。
- 交互：hover 显示"− / 重置 / +"（0.1s 步进）；暂停时保持当前行；`Esc` 回舞台。
- 判据：行切换与音频 `timeupdate` 对齐（人工 3 首样本）；偏移重启后保留；无歌词显示"无歌词"而非空屏。

### P5 浮层体系

- 搜索：`Cmd+K` / 点击顶部；默认本地 tab，输入即时过滤（现有 `/api/search`），B站 tab 走 `/api/bili/search`，结果项提供"播放/加入队列/下载"。
- 队列抽屉：左边缘 24px 触发，300ms 关闭；头部"队列/歌单"；每行 hover 出现"下一首播放/移除"；pin 后常开。
- 设置：外观（强调色/密度/歌词大小）、声音（音量/淡入淡出/EQ）、曲库（目录/重扫）、AI（Key/模型）、快捷键、关于。
- 判据：浮层互斥规则明确（搜索与设置不可同时开）；`Esc` 逐层关闭；键盘 Tab 可达。

### P6 曲库与歌单

- 目标：把现有 605 行 AlbumGrid 与 915 行 Playlist 拆成可维护视图。
- 判据：专辑分组与封面正常；歌单 CRUD 成功写回旧 JSON；旧数据可读；"下一首播放"插到 `currentUid` 之后。

### P7 Agent 回接

- 目标：AI 不再常驻，作为"命令面板"能力。
- 判据：`Cmd+/` 打开；流式输出正常；三个工具均可触发；语音/识曲入口可用；关闭抽屉不中断播放。

### P8 打磨

- 性能预算：首屏 JS（不含 three）< 300KB gzip；舞台静态时 GPU < 15%；滚动/切歌无长任务 > 50ms。
- 兼容：macOS 13+（WKWebView）；Tauri 权限（global-shortcut、fs 配置目录）。
- 回归清单：本地扫描/元数据/搜索/B站转换/歌单/历史/歌词/EQ/睡眠/识曲/语音/中英切换/托盘。

---

## 6. 风险与迁移

### 6.1 许可证（P0 前必须先决策）

事实：
- Mineradio：`GPL-3.0-only`；README 明确"MR Logo、Mineradio 名称、界面视觉设计与原创视觉表达归作者所有"，同时声明项目长期停更、欢迎个人 Fork 创作。
- ZDMusic：`CC-BY-NC-SA-4.0`。

后果：
- **复制 Mineradio 的 CSS/JS/图片/预设数据进 ZDMusic 并分发** → 衍生作品需整体 GPL-3.0，与 NC 条款冲突。
- **只借鉴配色、布局意图、交互模式**（思想与功能，不受版权保护）+ 自行重写代码 → 风险最低，本方案按此执行。

必须遵守的红线（写进 P0 验收）：
1. 不复制 `public/css/index.css` 的任何整段规则（可对照参数自行书写）；
2. 不使用 `build/` 图标、`public/assets/*`、`sonic-*-preset.js`、`default-user-fx-archive.json`；
3. 不使用 "Mineradio / MR" 名称与 Logo；
4. 不引入 `Cinzel Decorative` / `UnifrakturCook` 字体；
5. 若未来确实要复用其代码，先单独评估"ZDMusic 改 GPL + 保留 NOTICE"是否可接受。

### 6.2 数据与配置兼容

| 风险 | 影响 | 对策 |
|---|---|---|
| `config.json` 键被重写 | 用户 AI Key / Cookie / 目录丢失 | 只新增 namespaced 键；读写保留未知键；P0 增加一次备份 |
| 歌单 JSON 结构变化 | 旧歌单读不出 | 只加可选字段；读取时做缺省补齐 |
| 曲目 id 变化 | 歌单/历史/队列全部失联 | 冻结 `subDir/filename` 规则 |
| 队列快照首次引入 | 无历史快照 | 缺失时回退到"扫描曲库第一首暂停态" |
| 配置目录差异（dev vs 打包） | 两套数据分家 | 统一 `ZD_CONFIG_FILE` 判定，dev 也模拟该路径做一次迁移测试 |
| 主题 id 废弃 | 旧偏好读不到 | 旧 `themeId` 映射到 `accent`，未知值静默回退 |

### 6.3 功能回退与旧版

- 建议用分支 `feat/mineradio-shell`，开工前打 tag `pre-mineradio-ui`。
- **不做"双 UI 开关"**：维护两套首页成本过高，且会让样式令牌分裂。旧版通过 git tag 回退。
- 逐功能回退顺序：Agent → 识曲/语音 → 弹幕 → 均衡器 → 专辑视图。每项都在 P8 回归清单里，缺失即视为未完成。
- 弹幕若删除前端入口，保留 API 与 Context 代码但不挂载，避免"删了以后想加回来"。

### 6.4 性能风险

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| WebGL 舞台掉帧 | 4K 屏 + dpr 3 + 粒子过密 | dpr 上限 2；粒子数按屏幕面积缩放；静态 5s 后降帧到 30 |
| `backdrop-filter` 叠加 | 多个玻璃浮层同时开 | 浮层互斥；抽屉关闭时 `display:none` 而非仅 opacity |
| 全局过渡卡顿 | 现有 `*` 500ms 过渡 | P0 删除 |
| `three` 体积 | 首屏加载 | 动态 import + 仅在 Stage 挂载 |
| 大字体加载 | 中文 10MB | 不打包，使用系统字体 |
| 元数据扫描阻塞 | 大曲库首次扫描 | 现有 API 已服务端扫描；P6 增加进度与缓存 |

### 6.5 需要用户决策的点（按阻塞程度排序）

1. **许可证策略**：确认"只借鉴风格、全部重写"，还是接受 ZDMusic 改 GPL 以复用 Mineradio 代码？（阻塞 P0）
2. **B站弹幕**：彻底删除，还是保留为歌词模式的可选开关？（影响 P0 删除范围）
3. **AI / 识曲 / 语音**：全部保留（推荐），还是只留 AI？（影响 P7 范围）
4. **3D 歌单架 / 桌面歌词 / 摄像头手势**：是否纳入本期？（建议本期不做，单独立项）
5. **第三方音源**：确认不接入网易云/QQ/酷狗/汽水/Spotify？（建议确认）
6. **主题**：接受"单一暗底 + 强调色"，还是必须保留 6 套整色板？（影响 P0 设置页）
7. **平台**：只保 macOS，还是同步保证 Windows 可用？（影响快捷键、窗口行为、打包）
8. **旧版入口**：是否需要"启动时选择经典界面"？（建议不要）

---

## 7. 开工前检查清单

- [ ] 分支与 tag：`git tag pre-mineradio-ui`
- [ ] 备份 `~/.zdmusic/config.json`、`playlists.json`，记录 `MUSIC_DIR` 实际值
- [ ] 确认许可证策略（§6.5-1）
- [ ] 提供 3 首带封面的样例曲目（用于舞台/歌词走查）
- [ ] 明确本期不做清单（3D 歌单架、手势、第三方音源、Wallpaper Engine）
- [ ] 建立视觉基线截图：Home / Stage / QueueDrawer / Search / Settings 五张

## 8. 附：关键文件索引

**ZDMusic**
- 页面与令牌：`app/page.tsx`、`app/globals.css`
- 播放：`app/context/PlayerContext.tsx`、`app/hooks/useAudioPlayer.ts`、`app/hooks/useAudioVisualizer.ts`
- 数据：`app/lib/tracks.ts`、`app/lib/tags.ts`、`app/lib/playlists-store.ts`、`app/lib/play-history.ts`、`app/lib/types.ts`
- AI/搜索：`app/api/chat/route.ts`、`app/api/bili/search/route.ts`、`app/api/search/route.ts`
- 歌词：`app/hooks/useLyrics.ts`、`app/api/lyrics/route.ts`
- 桌面：`src-tauri/tauri.conf.json`、`src-tauri/capabilities/default.json`

**Mineradio（仅作设计参考）**
- 令牌：`public/css/index.css:367-428`
- 首页：`public/index.html:162-278`、`public/css/index.css:2314-2490`
- 搜索：`public/index.html:100-160`
- 队列抽屉：`public/index.html:1106-1164`、`public/css/index.css:14347-14390`
- 底栏：`public/css/index.css:5019-5201`、`5298-5330`
- 舞台歌词：`public/css/index.css:16538-16635`
- 热键：`public/js/modules/00-state/00-core-stores.js:159-168`
- 队列快照：`public/js/modules/05-playback/09-queue-snapshot-autoplay.js`
- 本地曲库：`desktop/local-music-library.js`
