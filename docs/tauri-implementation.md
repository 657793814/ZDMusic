# 卓动悦听 Tauri 桌面端实施记录

> 最后更新：2026-07-08 23:32
> 基于 `docs/tauri-packaging.md` 方案执行

## 环境

| 项目 | 版本 |
|------|------|
| Rust | 1.96.1 (aarch64) |
| Tauri CLI | 2.11.4 |
| Tauri (Rust) | 2.11.5 |
| Xcode | 26.6 (17F113) |
| Node.js | 22.22.3 (nvm) |
| npm | 10.9.8 |
| ffmpeg | 8.1.1 (Homebrew) |

## 最终架构

```
┌─────────────────────────────────────────────────────┐
│  Tauri v2 桌面端 (.app / .dmg)                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ Rust 层 (ServerState)                         │  │
│  │  → 启动/停止 Next.js 子进程                    │  │
│  │  → 注入 ZD_CONFIG_FILE / MUSIC_DIR / PATH     │  │
│  │  → 健康检查 / 退出清理                          │  │
│  │  ⚠️ 不走自定义 Tauri 命令写入配置              │  │
│  ├───────────────────────────────────────────────┤  │
│  │ WRY WebView (React UI)                        │  │
│  │ → 右侧如果没正常运行，WebView 一直在渲染        │  │
│  │   过渡页 —— 等待服务启动后自动跳转               │  │
│  ├───────────────────────────────────────────────┤  │
│  │ Next.js 子进程 (API)                          │  │
│  │ → 文件扫描 / 音频流                            │  │
│  │ → AI 对话 / 歌词 / 弹幕                       │  │
│  │ → 配置读写 (GET/POST /api/config)              │  │
│  │ → B站视频下载(bv2mp3) / mp3转换(ffmpeg)        │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**关键设计决策：避免 Tauri v2 ACL 系统**
- 配置读写不走 Tauri 命令 → 前端 `fetch('/api/config')` → Next.js `fs.readFileSync/writeFileSync`
- 只有服务器生命周期命令保留（`start_server/stop_server/is_server_alive`，无需前端调用）
- 配置路径由 Rust 通过 `ZD_CONFIG_FILE` 环境变量传入 Next.js 子进程

## 文件结构

```
./src-tauri/
├── tauri.conf.json          # Tauri 配置（窗口、bundle、icon、autostart、命令脚本）
├── Cargo.toml               # Rust 依赖
├── capabilities/
│   └── default.json         # 权限声明（core:default + autostart:default）
├── permissions/             # ⚠️ 不包含自定义命令权限（ACL 在 v2.11.x 有 bug）
├── icons/                   # 应用图标
├── src/
│   ├── main.rs              # 入口
│   ├── lib.rs               # 插件注册、Tauri Builder、托盘、自动启动、退出清理
│   └── commands/
│       ├── mod.rs           # 模块声明
│       ├── config.rs        # 配置结构体 + 文件读写函数（内部用，无 Tauri 命令）
│       └── server.rs        # 子进程管理（start_server/stop_server/is_server_alive）

./app/
├── api/
│   ├── config/route.ts      # GET/POST 读写 config.json（不走 Tauri 命令）
│   ├── config/reload/route.ts  # POST 清除运行时缓存，API Key 立即生效
│   ├── chat/route.ts        # AI 对话（读 config.json 获取 API Key）
│   ├── search/route.ts      # 搜索
│   ├── tracks/scan/route.ts # 扫描音乐目录（读 MUSIC_DIR env var）
│   ├── bili/search/route.ts # B站搜索（读 config.json 获取 cookies）
│   ├── system/stats/route.ts # 系统状态
│   └── health/route.ts      # 健康检查
├── lib/
│   ├── config.ts            # getConfigVar() — 共享配置读取模块
│   ├── tracks.ts            # scanTracks() — 读取 MUSIC_DIR 扫描 MP3 文件
│   └── bili.ts              # B站 API
├── components/
│   ├── molecules/SettingsDialog.tsx  # 设置界面（读写配置、保存并重启缓存）
│   └── organisms/Playlist.tsx       # 播放列表（刷新扫描，带加载动画）
└── context/PlayerContext.tsx  # 播放器上下文（首次加载自动扫描）

./scripts/
└── prepare-standalone.mjs   # 构建后清理 + 安装 bv2mp3 依赖
```

## 生产包依赖说明

最终 `.app` 中包含的 bundle 资源（路径：`standalone/`）：

| 资源 | 说明 | 来源 |
|------|------|------|
| `server.js` | Next.js standalone 产物 | `next build` |
| `.next/` | 编译产物 + 静态资源 | `next build` |
| `node_modules/` | 运行时依赖 | `npm install`（内有 bv2mp3 及其传递依赖） |
| `public/` | 静态文件 | 项目根目录复制 |

### 关键依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| next | ^16.2.4 | Web 框架 |
| react / react-dom | ^19.2.4 | UI 框架 |
| openai | ^6.45.0 | AI API 客户端 |
| bv2mp3 | ^4.0.0 | B站视频下载 + 转 MP3 |
| @anthropic-ai/claude-agent-sdk | 0.2.x | AI Agent SDK |
| @tauri-apps/api | ^2.11.1 | 前端 Tauri 基本 API（仅用于 is_server_alive） |
| @tauri-apps/plugin-autostart | ^2.5.1 | macOS 开机自启 |
| ffmpeg (系统级，Homebrew) | 8.1.1 | 音视频转换（bv2mp3 需要） |

> ⚠️ `tauri-plugin-fs` / `tauri-plugin-dialog` / `@tauri-apps/plugin-fs` 等曾被短暂引入但因 ACL 问题已全部移除。

### 依赖体积控制

- Next.js standalone 默认 `readFileSync`/`path.resolve` 会追踪整个项目根目录
- `prepare-standalone.mjs` 清理 source 文件 → `.app` 从 6.3GB 降至 ~64MB
- bv2mp3 及其传递依赖约占 ~300MB node_modules（压缩后 ~46MB 增量）

### 生产环境 PATH 注入

Rust `build_server_command()` 在 spawn 子进程时注入 PATH：

```rust
let current_path = std::env::var("PATH").unwrap_or_default();
let app_path = format!("/opt/homebrew/bin:/usr/local/bin:{}", current_path);
cmd.env("PATH", &app_path);
```

这样保证即使 `.app` 在 Finder 中启动（无 login shell PATH），也能找到 ffmpeg。

## Phase 1: Tauri 脚手架初始化

### 1.1 环境准备

- **Rust** — 通过 rustup 安装
- **Tauri CLI** — `npm install -D @tauri-apps/cli`
- **Xcode** — 从 App Store 安装，需 `sudo xcode-select --switch` + `sudo xcodebuild -license`

### 1.2 项目配置

| 文件 | 改动内容 |
|------|---------|
| `next.config.ts` | 新增 `output: "standalone"` |
| `package.json` | 新增 `tauri`, `tauri:dev`, `tauri:build` 脚本 |
| `src-tauri/tauri.conf.json` | 窗口 1400x900、CSP、bundle identifier、icon、自动启动 |

```json
{
  "identifier": "com.zdmusic",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "unset npm_config_prefix && ... nvm use 22.22.3 && npm run dev",
    "beforeBuildCommand": "unset npm_config_prefix && ... nvm use 22.22.3 && npm run build && node scripts/prepare-standalone.mjs"
  }
}
```

**关键踩坑：**
1. `frontendDist` 不能指向含 `node_modules` 的目录 → 用 `../dist`（独立 HTML 重定向页）
2. Rust/tauri 需要 cargo 在 PATH → 脚本里用 `zsh -l -c` 加载 login shell
3. nvm 与环境 npm 冲突 → `unset npm_config_prefix`

## Phase 2: 服务器生命周期管理 ✅

### 2.1 子进程管理 (`server.rs`)

| 函数 | 可见性 | 功能 |
|------|--------|------|
| `start_server(app_handle, port?)` | pub (Tauri command) | 启动 Next.js |
| `stop_server(app_handle)` | pub (Tauri command) | 停止 Next.js |
| `is_server_alive(port?)` | pub (Tauri command) | TCP 健康检查 |
| `start_server_sync(app_handle, port)` | pub(crate) | 同步版 setup 自动启动 |
| `stop_server_sync(app_handle)` | pub(crate) | 退出时清理 |

**实现细节：**
- `std::process::Command` spawn，`Mutex<Option<Child>>` 管理状态
- `std::net::TcpStream` 做健康检查（无额外的 HTTP 库）
- `on_window_event(Destroyed)` + `RunEvent::Exit` 双重清理

### 2.2 生产模式自动启动

在 Rust `setup` 闭包中（仅 release 模式）：
1. 1s 延时等窗口初始化
2. `start_server_sync` 启动 `standalone/server.js`
3. 轮询 TCP 3000 端口（500ms 间隔，最多 30s）
4. 成功后 WebView 导航到 `http://localhost:3000`

### 2.3 Standalone 资源打包

`scripts/prepare-standalone.mjs` 执行流程：

1. `npm run build` → `.next/standalone/`
2. 复制 `.next/static/` + `public/`
3. 清理 source 文件（`.git/`, `src-tauri/`, `docs/` 等）
4. **运行 `npm install` 安装 bv2mp3 + 传递依赖**（生产环境无 npx）

## Phase 3: 配置管理（最终方案）

### 3.1 数据流

```
Rust (server.rs)           → 注入 ZD_CONFIG_FILE env var         → Next.js 子进程
前端 (SettingsDialog.tsx)  → fetch('GET /api/config')             → Next.js 读取文件
前端 (SettingsDialog.tsx)  → fetch('POST /api/config', json)     → Next.js 写入文件
前端 (SettingsDialog.tsx)  → fetch('POST /api/config/reload')    → Next.js 清除缓存
Next.js (chat/route.ts)    → getConfigVar("ANTHROPIC_API_KEY")   → 读取同一 config.json
Next.js (bili.ts)          → getConfigVar("BILIBILI_COOKIE_*")   → 读取同一 config.json
```

**完全不经过 Tauri 命令系统，不存在 ACL 拒绝的可能性。**

### 3.2 配置文件位置

- macOS: `~/Library/Application Support/com.zdmusic/config.json`（由 `dirs::config_dir()` 决定）
- 前端通过 `process.env.ZD_CONFIG_FILE`（Rust 注入）获取路径
- 格式：

```json
{
  "music_dir": "/Users/xxx/Music",
  "env_vars": {
    "ANTHROPIC_API_KEY": "sk-xxx",
    "ANTHROPIC_BASE_URL": "https://...",
    "BILIBILI_COOKIE_SESSDATA": "xxx"
  }
}
```

### 3.3 环境变量注入（启动时）

Rust `build_server_command()` 注入：

| 变量 | 来源 | 用途 |
|------|------|------|
| `MUSIC_DIR` | `config.music_dir` | 音乐文件扫描路径 |
| `ZD_CONFIG_FILE` | `config::config_path()` | 配置文件路径（所有 Next.js 路由读取） |
| `PORT` | 固定 | Next.js 监听端口 |
| `NODE_ENV` | 固定 `production` | 生产模式 |
| `PATH` | nvm node bin dir + /opt/homebrew/bin + 父进程 PATH | 保证 `node` 命令（如在 `execSync` 中）使用 Nvm 的 Node.js v22（含有 `node:util.styleText` API） |

> ⚠️ **关键**：`find_node()` 优先使用 nvm 的最高版本，将其 `bin/` 目录（`~/.nvm/versions/node/v22.22.3/bin`）添加到子进程 PATH 首位。同时 `chat/route.ts` 直接使用 `process.execPath` 获取当前 Node.js 绝对路径，在 `execSync` 中显式指定节点路径，双重保障避免 PATH 解析到系统级旧版本（如 v18）。

### 3.4 设置界面前端

`SettingsDialog.tsx` 功能：
- **音乐目录** — 可编辑文本输入框（直接粘贴路径）
- **AI API Key** — 密码输入框
- **AI API Base URL / 模型名** — 可选配置
- **B站 Cookie** — SESSDATA + buvid3
- 「💾 保存配置」 — 写入文件
- 「🔄 保存并刷新」 — 写入 + 清除 Next.js 缓存（API Key 立即生效）

> ⚠️ 音乐目录修改后需重启 App 生效（`MUSIC_DIR` 在启动时注入一次）。

## Phase 4: B站视频下载

### 4.1 依赖

- `bv2mp3@^4.0.0` — B站视频下载 + 转换为 MP3
- `ffmpeg@8.1.1` — 系统级（Homebrew），bv2mp3 内部调用

### 4.2 生产环境适配

| 问题 | 修复 |
|------|------|
| `npx bv2mp3` 在 `.app` 中找不到 | `prepare-standalone.mjs` 在 standalone 中 `npm install bv2mp3`，chat route 用 `node node_modules/bv2mp3/src/index.js` 直接执行 |
| ffmpeg 不在 PATH | `server.rs` 注入 `/opt/homebrew/bin` 到 PATH 环境变量 |
| `@clack/core` 导入报错（`node:util.styleText` 不存在） | **根因**：`execSync("node ...")` 通过 PATH 解析到系统 Node.js v18，v18 无 `styleText`。**修复**：`chat/route.ts` 使用 `process.execPath`（当前进程 Node.js 的绝对路径）代替 `node` 命令；`server.rs` 将 nvm node bin 目录注入子进程 PATH |

### 4.3 下载流程

1. Agent 收到 B站链接 → 提取 BV 号
2. `chat/route.ts` 调用 `execSync("node bv2mp3/src/index.js --url=...")`
3. bv2mp3 下载视频 → ffmpeg 转 MP3 → 输出到 `{MUSIC_DIR}/{yyyy-MM-dd}/`
4. 扫描目录 → 返回 Track 列表 → 前端自动播放

## Phase 5: 包装与发布 ✅

### 5.1 应用图标

- 使用 Sharp 渲染 SVG → 各尺寸 PNG → `iconutil` 生成 `.icns`
- `scripts/generate-icons.mjs`

### 5.2 系统托盘

- `tauri` crate 开启 `tray-icon` feature
- 左键点击托盘恢复窗口
- 关闭窗口隐藏到托盘（`CloseRequested` 拦截）

### 5.3 自动启动

- `tauri-plugin-autostart = "2"`（`MacosLauncher::LaunchAgent`）

## 已知问题

### Tauri v2 ACL 系统 (v2.11.x)

- **所有自定义命令和插件命令**（`set_env_var`, `plugin:fs|write_text_file`, `plugin:path|resolve_directory`）均被 ACL 拒绝
- 权限文件格式已验证正确但仍被拒绝（推测运行时端 bug）
- **当前绕过方案：** 配置读写完全不走 Tauri 命令系统，改用 `fetch()` → Next.js API 路由 → `fs.readFileSync/writeFileSync`

### 文件夹选择器

- `rfd::AsyncFileDialog` 在 macOS 上因 AppKit 需要主线程，在 Tauri async 命令中不可用
- `tauri-plugin-dialog` 同样走 ACL 被拒绝
- **当前方案：** 手动输入路径

## 产物

| 类型 | 路径 | 大小 |
|------|------|------|
| 开发模式 | `npm run tauri:dev` | — |
| 原生二进制 | `src-tauri/target/release/zdmusic` | ~5 MB |
| **.app 包** | `target/release/bundle/macos/卓动悦听.app` | **~100 MB** |
| **.dmg 安装包** | `target/release/bundle/dmg/卓动悦听_0.1.0_aarch64.dmg` | **~64 MB** |

> ⚠️ 体积比之前大是因为 bv2mp3 + 传递依赖 (~300MB node_modules) 被包含在 standalone 中，压缩后增量约 46MB。

## 开发命令

```bash
# 开发模式（需要先启动 Next.js dev server）
cd /Users/liuzuodong/Documents/workspace/ZDMusic
npm run tauri:dev

# 构建发布包 (.app + .dmg)
npm run tauri:build

# 单独清理 + 准备 standalone
node scripts/prepare-standalone.mjs

# 重新生成图标
node scripts/generate-icons.mjs
```

## 全部文件清单

| 文件 | 说明 | Phase |
|------|------|-------|
| `next.config.ts` | `output: "standalone"` | 1 |
| `dist/index.html` | WebView 加载过渡页 | 1 |
| `src-tauri/tauri.conf.json` | Tauri 配置 | 1 |
| `src-tauri/Cargo.toml` | Rust 依赖 | 1 |
| `src-tauri/src/main.rs` | 入口 | 1 |
| `src-tauri/src/lib.rs` | 注册、托盘、自动启动 | 2-5 |
| `src-tauri/src/commands/mod.rs` | 模块声明 | 2 |
| `src-tauri/src/commands/server.rs` | 子进程管理 + PATH/环境注入 | 2 |
| `src-tauri/src/commands/config.rs` | 配置结构体 + 文件读写（无命令） | 3 |
| `src-tauri/capabilities/default.json` | 权限声明（最小） | 3 |
| `scripts/prepare-standalone.mjs` | 构建后清理 + 安装 bv2mp3 | 2 |
| `scripts/generate-icons.mjs` | 图标生成 | 4 |
| `app/api/config/route.ts` | 配置读写 API | 3 |
| `app/api/config/reload/route.ts` | 配置缓存刷新 | 3 |
| `app/api/health/route.ts` | 健康检查 | 1 |
| `app/api/chat/route.ts` | AI 对话 + B站下载 | 5 |
| `app/components/molecules/SettingsDialog.tsx` | 设置界面 | 3 |
| `app/components/organisms/Playlist.tsx` | 播放列表（含刷新） | 3 |
| `app/lib/config.ts` | 共享配置读取模块 | 3 |
