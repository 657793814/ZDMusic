# Mineradio × ZDMusic 功能缺口对照表

> 基线：`/Users/liuzuodong/Documents/workspace/Mineradio-paused`（Electron、Windows 优先，v2.2.0）
> 现状：`/Users/liuzuodong/Documents/workspace/ZDMusic`（Next.js 16 + Tauri v2、macOS 优先）
> 说明：所有 Mineradio 结论均来自源码；不凭功能名推测。工作量按 1 人粗略估：S ≤1d、M 2–3d、L 4–6d、XL >1w。

## 已拍板的第三方平台边界（2026-11-08）

- 网易云、QQ 音乐只做两件事：
  1. 关键词搜索 → 用系统默认浏览器打开对应平台搜索页；
  2. 粘贴分享链接/分享文案 → 解析曲目/歌单并导入本地。
- **不请求需要登录态的接口，不保存 cookie/token/账号信息，不内嵌登录窗口。**
- 因为不落登录态：
  - “平台推荐”改为**基于本地曲库的推荐**，不使用抓取的云歌单；
  - “我的歌单”只保留本地歌单，不做云端同步。文档与 UI 都不保留误导性入口。
- 分享短链允许**跟随一次重定向**获取元信息；拿不到就提示“手动导入本地文件”，不做暴力抓取。
- 打包为 Tauri 应用后，外链必须交给系统浏览器打开，不能在内嵌 webview 跳转。

---

## 0. 两个项目的形态差异（影响后面每一项）

| 维度 | Mineradio | ZDMusic |
|---|---|---|
| 桌面壳 | Electron（`desktop/main.js`），Windows 深度绑定 | Tauri v2（`src-tauri`），macOS 优先 |
| 前端服务 | 自带 Node server（`server.js` + `*-api.js`） | Next standalone 作为 sidecar，Rust 起服后加载 3978 |
| 3D 能力 | 引入 `three.js`（3D 歌单架、部分舞台预设） | 目前无 three；P3 是 Canvas2D 透视粒子 |
| 数据源 | 本地库 + 网易云/QQ/酷狗/汽水/Spotify | 本地库 + B 站搜索/转存 |
| 平台边界 | 大量 Windows Win32 调用（桌面图标层、窗口挂载） | macOS 无对应 Win32 能力，需换实现思路 |

---

## 1. 首页：每日推荐 / 平台推荐 / 继续听 / 听歌画像 / 我的歌单

**Mineradio 实际做法**
- 页面骨架与数据状态：`public/js/modules/05-playback/03a-home-dashboard.js`
  - 每日推荐：`/api/kugou/recommendations`、网易云每日推荐（`homePlatformRecommendationCard('netease-song', …, '网易云每日推荐')`，L957）
  - 平台推荐：`/api/podcast/hot?limit=8`（L1092）、`/api/kugou/recommendations?limit=12`（L877），按来源分 tab
  - 播客入口：`03-home-discover-weather.js` 的 `homeDiscoverState.podcasts`
- 听歌画像：`03-home-discover-weather.js` L121–157，用播放历史聚合 `summary.topArtist / topSong / recent`，展示“常听歌手 · N 次”
- 我的歌单：首页快捷入口 + `openPlaylistPanelTab()`

**ZDMusic 现状：残缺**
- 已有：Hero 时钟、今日统计（分钟/首数/连续天）、继续听、发现条、快捷 chip。
- 已有播放历史 API `/api/play-history?action=summary`，但没有 topArtist/topSong 聚合。
- 没有每日推荐/平台推荐；没有首页歌单入口（歌单只能从队列抽屉 tab 进入）。
- 按已拍板边界：**平台推荐改为本地库推荐**；**我的歌单只做本地歌单**，不接云端。

**实现路径**
1. 扩展 `app/lib/listen-stats.ts` 输出 `topArtist/topSong/recent`，Home 增加“听歌画像”卡。
2. “我的歌单”入口直接打开队列抽屉的 playlists tab（只列 `/api/playlists` 本地数据）。
3. 每日推荐改为本地推荐策略：近 30 天常听 + 未听完 + 随机未播放曲目，明确标注“本地推荐”，不伪装成平台榜单。

**依赖与风险**：无第三方依赖；推荐质量受本地库规模限制，需要空态文案说明。
**工作量**：M。

---

## 2. 完整桌面模式（播放器 / 主页 / 歌单 / 桌面交互）

**Mineradio 实际做法**
- `desktop/full-desktop-mode-runtime.js`：把窗口挂到桌面层（`attachWallpaperWindowToDesktop`、`desktopWindowCoexistAttachScript`），配合 `desktop-icon-shape-runtime.js`、`desktop-native-icon-layer-runtime.js` 处理桌面图标显隐与遮挡。
- 依赖 PowerShell / Win32 API（`$ErrorActionPreference`、native handle），是 Windows-only。
- 另外有 `wallpaper-mode-runtime.js` 管理壁纸窗口生命周期、鼠标穿透（`setIgnoreMouseEvents`）。

**ZDMusic 现状：残缺**
- Tauri 已有主窗口 + 系统托盘（`src-tauri/src/lib.rs` 的 `TrayIconBuilder`，托盘播放/暂停）。
- 没有桌面层挂载、桌面图标层、鼠标穿透、迷你/全屏模式切换；也没有“桌面歌词/悬浮窗”。

**实现路径**
- macOS 无法照搬 Win32 桌面挂载。等价能力建议：
  1. `always-on-bottom` + 无边框透明窗口 + 鼠标穿透，做“桌面播放器层”；
  2. 迷你悬浮播放条（置顶、可拖拽）；
  3. 主窗口/迷你模式/专注模式三态切换，主页与歌单在各态保留。
- 这些全部走 Tauri window API（`set_ignore_cursor_events`、`set_always_on_top`、`set_decorations`），不依赖 dev server。

**依赖与风险**：macOS 辅助功能权限、窗口层级与 Mission Control 行为；Windows 桌面图标层不承诺复刻。
**工作量**：L（macOS 等价形态）；若要求逐像素复刻 Windows 桌面图标层，XL 且不可行。

---

## 3. 本地 MP4 与 Wallpaper Engine 视觉内容

**Mineradio 实际做法**
- 本地 MP4：`03a-home-dashboard.js` L135–209，用 IndexedDB 缓存视频 blob，校验扩展名/MIME 后作为首页 Hero 视频。
- Wallpaper Engine：`desktop/wallpaper-engine-library.js` + `wallpaper-engine-runtime.js`
  - 自定义协议 `mineradio-wallpaper`（`registerSchemesAsPrivileged`，Electron）。
  - `.pkg/.pak` 是自定义 `PKGV` 容器，不是 zip；JS 内解析，找 `scene.json`（`wallpaper-engine-runtime.js` L167–177）。
  - 支持图片/视频类场景；DirectX 二进制场景无法在 WebView 渲染。
  - macOS 上可读文件、可解包、可渲染 video/web 场景；依赖 Wallpaper Engine 的 Windows 专有二进制效果不可用。

**ZDMusic 现状：无**
- 舞台只有封面粒子 + 悬浮封面卡，没有视频层/壁纸层。

**实现路径**
1. 本地 MP4：设置里选文件（Tauri dialog 插件）→ 存路径到 `~/.zdmusic/config.json` → Stage 增加 `<video>` 背景层；浏览器模式用 `<input type=file>` + ObjectURL。
2. Wallpaper Engine：Tauri 注册自定义协议读取 `.pkg`，把 `PKGV` 解析器移植到 Rust 或保留 JS 侧；只支持 video/web 场景，遇到 DirectX 场景给出明确提示。
3. 打包环境不依赖 dev server：路径由 Tauri 注入，资源通过 `asset://`/自定义协议读取。

**依赖与风险**：`.pkg` 解析器移植成本；视频解码与 GPU 抢占；壁纸版权/来源合规。
**工作量**：MP4 S–M；WE `.pkg` M–L（仅 video/web）。

---

## 4. 播放后切换到 Emily / 默认播放态，歌词舞台与粒子舞台同步

**Mineradio 实际做法**
- “Emily”不是角色，是视觉预设/场景名。`grep emily` 命中内置预设 `emily专辑封面`：封面粒子 + 快速入场/入场动画预设。
- 播放态切换：`04-home-empty-wallpaper.js` L106–120 的 `switchPlaybackVisualToEmily()`：停止首页壁纸预览，设置 `playbackVisualPreset` / `fxDefaults.preset`，恢复后台视觉。
- 同步：`12-playback-switch-core.js` L15–24，`reason === 'play' || 'playing'` 时切换预设并恢复歌词舞台；歌词舞台与粒子舞台共用同一播放状态。

**ZDMusic 现状：部分具备**
- P3 已是“封面采样粒子 + 悬浮封面 + 节拍镜头”，观感接近 Emily，但没有显式“预设/场景”概念，也没有歌词舞台与粒子舞台的同步切换。

**实现路径**
- 定义 `VisualPreset = emily | lyric | video | minimal`，由播放状态机驱动；切歌只换数据不换 DOM，避免闪黑。
- 歌词舞台与粒子舞台共享 `currentTime`，二选一或分层叠加，`prefers-reduced-motion` 降级到静态封面。

**依赖与风险**：与第 7 项歌词舞台强耦合；与第 3 项视频层互斥。
**工作量**：S–M（在现有 P3 上增量）。

---

## 5. 基于节奏的电影镜头视觉系统

**Mineradio 实际做法**
- `public/js/modules/01-scene/02-beat-camera-runtime.js`
  - L35–47：播放开始后按 `fx.cinema` / `cinemaShake` 初始化镜头动力学。
  - L71–105：按音频能量、低频、DJ 模式、section 变化实时算 `cinemaDynamics.scale`。
- 镜头不是视频，是场景层的实时变换（缩放/位移/抖动）+ 节拍点。

**ZDMusic 现状：残缺**
- P3 只做了 `scale(1 + bass * 0.025)` 与指针视差，没有 section/镜头切换/节拍关键帧。

**实现路径**
- 复用现有 `analyser` 低频/中频能量，增加“镜头段落”状态机（intro/verse/drop/outro），用缓动驱动 Canvas 相机与封面卡 z 轴。
- 节拍事件来自 analyser 阈值 + 最短间隔，不引入新依赖。

**依赖与风险**：节拍误判会让镜头抖得难受，需要可关闭与强度滑杆。
**工作量**：M。

---

## 6. 面向长播客与 DJ 曲目的专属视觉模式

**Mineradio 实际做法**
- `public/js/modules/03-beat/02-podcast-dj-analysis.js`
  - L45–221：本地音频 buffer 做低通/高通、能量阈值、onset 检测、候选点筛选，生成 `cameraBeats`。
  - L1–43：远程音频走 `/api/podcast/dj-beatmap` 获取节拍映射。
- 播客数据：`/api/podcast/hot`；播客项有 `type === 'podcast'`、`programId`。

**ZDMusic 现状：无**
- 没有时长/来源判定，没有离线 onset 分析，也没有播客数据源。

**实现路径**
1. 判定：时长 > 20min 或标题含 podcast/DJ/live → 切 `longform` 模式。
2. 视觉：降低高频粒子、放大歌词/信息层、镜头节奏放慢；DJ 模式显示节拍网格与 section。
3. 离线 beatmap 可用 Web Audio `OfflineAudioContext` 在 Worker 里算，避免主线程卡顿。

**依赖与风险**：长音频离线分析耗时；播客数据源依赖 10/11。
**工作量**：视觉模式 M；完整离线 beatmap L。

---

## 7. 歌词舞台、自定义歌词、位置与视觉控制

**Mineradio 实际做法**
- 拉取/解析：`06-lyrics/00-lyrics-fetch-parse.js`
  - 按 provider 选择接口：`/api/lyric`（网易云默认）、`/api/qq/lyric`、`/api/kugou/lyric`、`/api/qishui/lyric`、Spotify（L16–37）。
  - 内联歌词合并、原文/翻译缓存、网易云翻译兜底（L195–251）。
- 自定义：`06-lyrics/05-upload-dragdrop.js` 支持字体文件上传（`lyric-font-input`）；`06-lyric-timing-offset.js` 支持每首 ±500ms 时间偏移（localStorage）。
- 位置与视觉：舞台侧有歌词位置/字号/透明度控制（与 `01-scene` 的 lyric stage 同步）。

**ZDMusic 现状：无**
- 舞台只显示曲名/作者，没有 LRC 解析、逐字、翻译、位置/字号控制，也没有无歌词降级。

**实现路径**
1. 解析层：支持本地 `.lrc`（同目录同名）、内嵌元数据、后续接平台接口；处理中文、逐行时间戳、逐字增强标签（可选）。
2. 展示层：歌词舞台组件（当前行放大、上下文行淡出），位置（上/中/下）、字号、行距、对齐可调，存 `~/.zdmusic/config.json`。
3. 降级：无歌词显示“纯音乐/暂无歌词”，回落到曲名+作者，不隐藏舞台。
4. 自定义：导入 `.lrc` 到曲目 override map（IndexedDB 或服务端 JSON）。

**依赖与风险**：编码（GBK/UTF-8 BOM）、双语合并、逐字数据源稀缺。
**工作量**：L。

---

## 8. 自定义专辑封面上传与裁剪

**Mineradio 实际做法**
- 上传与裁剪：`03-beat/05-cover-loading-crop.js` L123–185
  - `makeSquareCoverCanvas` 用 Canvas 居中裁切/缩放；
  - 非正方形图片打开 `cover-crop-modal`，`commitCustomCoverCanvas` 落盘。
- 存储：`05-playback/01-cover-custom-map.js`，`localStorage` 的 `customCoverMap`；按 song 类型生成 `customCoverKey`，读取时优先自定义封面（L48–77）。

**ZDMusic 现状：无**
- 封面来自 `/api/tracks/metadata` 的 sidecar 图；无覆盖机制。

**实现路径**
1. 前端 Canvas 裁剪（拖拽/缩放/1:1 预览），输出 webp/jpeg ≤512px；
2. 存储：浏览器用 IndexedDB；Tauri 用 `~/.zdmusic/covers/<trackId>.webp` + `customCoverMap.json`，通过 API 读写，两环境表现一致；
3. 曲目展示层优先读 override（Home/Discover/Stage/Queue 统一）。

**依赖与风险**：文件大小与格式、trackId 含中文/斜杠需哈希做文件名、缓存失效。
**工作量**：M。

---

## 9. 右键唤起 3D 歌单架与歌单队列浏览

**Mineradio 实际做法**
- 3D 是 **three.js**，不是 CSS 3D：`public/js/modules/04-shelf/*`
  - `00-layout-hover.js` L27–68 定义 side/stage/detail 的 X/Y/Z、缩放、旋转、行列间距；
  - `01-manager-core.js` L67–94 数据源：用户歌单/播客集合，无歌单时回退 `playQueue`，标记 `queueIndex/正在播放`；
  - 右键唤起，卡片有独立 3D 位置与 hover 动效。
- 与主舞台共享渲染调度（同一 RAF/场景循环），避免两套 WebGL 上下文。

**ZDMusic 现状：无**
- 只有 2D 队列抽屉（左边缘 hover/pin），没有 3D 歌单架，也没有右键入口。

**实现路径**
- 方案 A（推荐）：CSS 3D `perspective + preserve-3d` 做卡片架，零包体、与 Canvas 粒子共存成本低；可满足浏览/选中/播放。
- 方案 B：按需动态 `import("three")`，只在打开歌单架时加载；与舞台共享一个 renderer 不可行（舞台是 Canvas2D），需独立上下文，GPU 风险更高。
- 数据：复用现有 `/api/playlists` 与 `queue`；右键 `contextmenu` 打开，Esc/点击空白关闭。

**依赖与风险**：A 的视觉层次不如 three.js；B 增包体（~150KB gzip 起）与 GPU 抢占。
**工作量**：A M–L；B L–XL。

---

## 10. 网易云音乐：搜索跳转 + 链接导入（不落登录态）

**Mineradio 实际做法（仅作对照，不再采用）**
- Electron `BrowserWindow` 登录页 + `persist:mineradio-netease-login` 分区，从 cookie 取 `MUSIC_U`（`desktop/main.js` L127–129、L524–535）。
- 本地 Node server 代理 `/api/lyric`、推荐、搜索、歌单、播客（`server.js`、`03a-home-dashboard.js`）。
- 本质是 cookie 登录态 + 非官方接口代理。

**ZDMusic 现状：无**

**已拍板实现（B 方案，仅此一种）**
1. **搜索跳转**：关键词拼 `https://music.163.com/#/search/m/?s=<encoded>`，调用 Tauri opener 用系统默认浏览器打开；浏览器模式退回 `window.open(url, "_blank", "noopener")`。不在内嵌 webview 内跳转。
2. **链接导入**：从粘贴的分享文案里正则提取 URL，支持单曲 `music.163.com/#/song?id=`、歌单 `music.163.com/#/playlist?id=`、以及短链 `163cn.tv/...`。
3. **短链解析**：只允许跟随一次重定向（不发 cookie、不带登录态）拿到 canonical URL；能从公开页 OG/JSON-LD 取到 `title/artist/cover` 就展示预览，取不到就明确提示“无法解析，请手动导入本地文件”。
4. **批量导入**：整段分享文案可解析出多条，逐条显示成功/失败原因，失败项不静默丢弃；用户确认后写入本地歌单。
5. **不落登录态**：不保存 cookie/token/账号，不请求私人推荐/收藏/播客接口。

**明确失去的能力**：云端每日推荐、私人歌单、收藏、播客、账号态；不能直接获取音源。首页“平台推荐”相应改为本地库推荐。
**依赖与风险**：`tauri-plugin-opener`（外链）、短链一次跳转的网络可达性、平台页面结构变化；全部失败路径必须可解释。
**工作量**：M。

---

## 11. QQ 音乐：搜索跳转 + 链接导入（不落登录态）

**Mineradio 实际做法（仅作对照，不再采用）**
- 登录：`BrowserWindow` + `persist:mineradio-qqmusic-login`，登录页 `y.qq.com`（`desktop/main.js` L129–132）。
- 登录态判定：`qqCookieHasLogin` / `qqCookieHasPlaybackLogin`（L2372–2425），要求 `uin + qm_keyst` 等播放授权字段。
- 音源：`qq-vip-api.js`，依赖登录 cookie 与平台风控。

**ZDMusic 现状：无**

**已拍板实现（B 方案，仅此一种）**
1. **搜索跳转**：`https://y.qq.com/n/ryqq/search?w=<encoded>`，系统默认浏览器打开。
2. **链接导入**：支持 `y.qq.com/n/ryqq/songDetail/<songmid>`、`y.qq.com/n/ryqq/playlist/<id>`、`c6.y.qq.com` 等分享短链；从分享文案批量提取 URL。
3. **短链解析**：同网易云，只跟随一次重定向，不带 cookie；公开页拿不到 `title/artist` 就提示手动导入，不退化成抓取。
4. **批量结果**：逐条显示成功/失败与原因，失败不静默丢弃。
5. **不落登录态**：不保存 cookie/token/账号，不请求登录态接口。

**明确失去的能力**：登录态歌单、VIP 音源补充、QQ 曲库播放；只能拿到公开可解析的元数据并跳转。
**依赖与风险**：QQ 分享链路对未登录用户限制较多，解析失败率会高于网易云；必须把“手动导入本地文件”作为正式兜底。
**工作量**：M。

---

## 实施顺序建议（与用户指定顺序一致）

**第一批（纯前端，可独立）**
1. 首页本地部分（1）：画像聚合 + 歌单入口 + 继续听补强
2. 歌词舞台（7）：LRC 解析 + 展示 + 位置/字号 + 降级
3. 自定义封面（8）：Canvas 裁剪 + override 存储
4. 3D 歌单架（9）：CSS 3D 优先
5. 长播客/DJ（6）：模式判定 + 专用布局；离线 beatmap 视情况
6. 电影镜头（5）：在 P3 上增加段落与节拍镜头

**第二批（架构）**
7. 完整桌面模式（2）：Tauri 迷你/桌面层/穿透
8. 本地 MP4 + Wallpaper Engine（3）：视频层 + `.pkg` 解析
9. Emily/默认态切换 + 歌词/粒子同步（4）：预设状态机

**第三批（平台，先拍板）**
10. 网易云（10）：先 B 后可选 A
11. QQ 音乐（11）：先 B；A 需明确风险授权

**预计总量**：第一批约 12–18 人日；第二批约 10–15 人日；第三批 B 方案约 4–6 人日，A 方案额外 15+ 人日且持续维护。

---

## 关键依赖汇总

- `three.js`：仅 9B / 可选电影镜头需要；若采用 CSS 3D + Canvas2D，则零新增依赖。
- Tauri 插件：`dialog`（选文件）、`fs`/自定义协议（读 MP4 与 `.pkg`）、窗口 API（桌面模式）。
- 存储：`~/.zdmusic/config.json`（设置）、`~/.zdmusic/covers/`（自定义封面）、IndexedDB（浏览器兜底）。
- 第三方：网易云/QQ 全部为非官方接口，账号态与音源均属高风险区，必须用户拍板边界后再动。
