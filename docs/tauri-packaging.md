# Aura Player Tauri v2 桌面打包方案

> **Phase 1-4 全部完成 ✅** 实施记录见 `docs/tauri-implementation.md`

## 背景

当前项目是一个纯 Web 的 Next.js 音乐播放器，依赖 Node.js API Route 处理文件扫描、音频流、AI 对话等功能。要打包成桌面免安装程序，需要将这些 Node.js 后端逻辑与前端分离。

**架构选择：Tauri v2 + Next.js 子进程**
- WebView 渲染前端 React UI
- Next.js 服务器作为子进程运行，继续提供所有 API Route
- 前端用相对路径 `/api/...` 调用后端，无需改动

## Phase 1: 初始化 Tauri 脚手架 ✅

### 1.1 安装依赖

```bash
npm install -D @tauri-apps/cli        # Tauri CLI
```

### 1.2 修改 `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(".") },
  output: "standalone",                // ← 新增：standalone 输出
};
```

### 1.3 创建健康检查端点

`app/api/health/route.ts`:
```typescript
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ ok: true });
}
```

### 1.4 创建加载页

`dist/index.html` — 开发模式 WebView 启动时的过渡页，自动跳转到 `http://localhost:3000`

### 1.5 CSP 策略

`tauri.conf.json` 中配置 CSP，允许 B站 API, LRCLIB, localhost, Google Fonts。

### 1.6 验证

```bash
npm run tauri:dev    # 启动 WebView + Next.js dev server
```

## Phase 2: 服务器生命周期管理 ✅

### 2.1 Rust 子进程管理

`src-tauri/src/commands/server.rs`:

| Tauri 命令 | 功能 |
|-----------|------|
| `start_server` | 从 bundle 资源启动 `node server.js` |
| `stop_server` | 终止子进程 |
| `is_server_alive` | TCP 健康检查 |

### 2.2 自动启动流程（生产模式）

Rust `setup` 闭包中：
1. 等待 1s 窗口初始化
2. `start_server_sync` 从资源目录启动 `standalone/server.js`
3. 每 500ms 轮询 TCP 3000（最多 30s）
4. WebView 导航到 `http://localhost:3000`

退出时 `on_window_event(Destroyed)` + `RunEvent::Exit` 双重清理子进程。

### 2.3 资源打包

`scripts/prepare-standalone.mjs` — `tauri build` 前执行：
1. 复制 `.next/static/` → `standalone/.next/static/`
2. 复制 `public/` → `standalone/public/`
3. 清理 source 文件（AGENTS.md, src-tauri/, docs/, 等）

**重要：** standalone 因 API 路由的文件系统操作会追踪整个项目目录，
不清理则 `.app` 体积达 6.3GB，清理后仅 51MB。

## Phase 3: 音乐目录配置 ✅

- `set_music_dir` / `get_music_dir` Tauri 命令
- 持久化到 `~/Library/Application Support/com.zdmusic/config.json`
- 启动 Next.js 子进程时作为 `MUSIC_DIR` 环境变量传入
- 路径变更时自动重启子进程
- 前端设置对话框 + 原生文件夹选择器

## Phase 4: 包装与发布 ✅

- 自定义 Aurora 主题图标（SVG 源 → Sharp 渲染 → 各尺寸 PNG + .icns）
- 系统托盘（显示窗口/播放暂停/退出 + 左键点击恢复）
- macOS 自动启动（tauri-plugin-autostart, LaunchAgent）
- 窗口关闭时隐藏到托盘（`CloseRequested` 拦截）

## 最终产物

| 产物 | 大小 |
|------|------|
| `卓动悦听.app` | **52 MB** |
| `卓动悦听_0.1.0_aarch64.dmg` | **15 MB** |

独立运行，含 Next.js 服务器 + 系统托盘 + 自动启动 + 自定义图标。

## 开发命令

```bash
# 开发模式（WebView + hot reload）
npm run tauri:dev

# 构建发布包 (.app + .dmg)
npm run tauri:build

# 重新生成图标（修改 source.svg 后）
node scripts/generate-icons.mjs
```
