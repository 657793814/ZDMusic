# AuraPlayer Tauri v2 桌面打包方案

## 背景

当前项目是一个纯 Web 的 Next.js 音乐播放器，依赖 Node.js API Route 处理文件扫描、音频流、AI 对话等功能。要打包成桌面免安装程序，需要将这些 Node.js 后端逻辑与前端分离。

**架构选择：Tauri v2 + Next.js 子进程**
- WebView 渲染前端 React UI
- Next.js 服务器作为子进程运行，继续提供所有 API Route
- 前端用相对路径 `/api/...` 调用后端，无需改动

## Phase 1: 初始化 Tauri 脚手架

### 1.1 安装 Tauri CLI

```bash
npm install -D @tauri-apps/cli
```

### 1.2 修改 `next.config.ts`

添加 `output: "standalone"`：

```typescript
const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(".") },
  output: "standalone",
};
```

### 1.3 创建健康检查端点

新建 `app/api/health/route.ts`：

```typescript
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ ok: true });
}
```

### 1.4 Tauri 配置 (`tauri/tauri.conf.json`)

- `devUrl`: `http://localhost:3000`
- `beforeBuildCommand`: `next build`
- 窗口: 1400x900, 可调整, Overlay titleBar
- CSP: 允许 Google Fonts + inline styles

### 1.5 验证

```bash
npm run dev          # 终端1
npm run tauri:dev    # 终端2: 自动打开 WebView
```

前端零改动 — 所有 API 调用都是相对路径。

## Phase 2: 服务器生命周期管理

### `tauri/src/commands/server.rs` — 三个 Tauri 命令

| 命令 | 功能 |
|------|------|
| `start_server` | 启动 Next.js 子进程（dev: `npx next dev`，prod: `node server.js`），传入 `MUSIC_DIR` 等环境变量 |
| `stop_server` | 应用退出时终止子进程 |
| `is_server_alive` | 轮询 `localhost:3000/api/health` |

改造 `tauri dev`：不再需要手动开两个终端，Tauri 自动启动 Next.js 子进程并轮询健康检查。

生产模式：`tauri build` 将 `.next/standalone/` 打包进 `.app`，启动时从 bundled 目录运行。

## Phase 3: 音乐目录配置

- `set_music_dir` Tauri 命令，持久化到 `~/Library/Application Support/com.auramusic.app/config.json`
- 启动 Next.js 子进程时作为 `MUSIC_DIR` 环境变量传入
- 路径变更时重启子进程

## Phase 4: 包装与发布

- 各尺寸图标
- 系统托盘（Play/Pause、Show/Quit）
- macOS 自动启动（LaunchAgent）
- `.dmg` 安装包

## 关键风险

1. `npx bv2mp3` 需要 `npx` 可用，打包后 PATH 可能受限，需用绝对路径
2. 端口 3000 冲突 — Rust 侧检测并尝试其他端口
3. Standalone 模式需确保 `node_modules` 随 bundle 包含

## 验证步骤

1. `npm run tauri:dev` — UI 完整渲染
2. 刷新加载本地歌单（`/api/tracks/scan`）
3. 点击歌曲播放（`/api/tracks/[...path]` 音频流）
4. 与智能体对话搜索（`/api/chat` SSE 流）
5. `npm run tauri:build` — 构建 DMG，安装后验证
