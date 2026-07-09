# 卓动悦听 — 构建与运行脚本

> 文档最后更新: 2026-07-09

---

## 一键打包 `scripts/build.sh`

一键完成 Next.js 构建 → 精简 Standalone → Tauri 打包的全部流程。

### 用法

```bash
# 1) 仅生成 .app（默认）
./scripts/build.sh

# 2) 生成 .app + .dmg 安装包
./scripts/build.sh --dmg

# 3) 查看帮助
./scripts/build.sh --help
```

### 产物路径

| 产物 | 路径 |
|------|------|
| `.app` | `src-tauri/target/release/bundle/macos/卓动悦听.app` |
| `.dmg` | `src-tauri/target/release/bundle/dmg/卓动悦听.dmg` |

### 脚本做了什么

| 步骤 | 说明 |
|------|------|
| 1. 环境初始化 | 加载 nvm（切换到 Node 22.22.3）和 cargo |
| 2. Next.js 构建 | `npm run build` — Turbopack 生产构建 |
| 3. 精简 Standalone | 执行 `scripts/prepare-standalone.mjs`，清理 devDependencies、安装 bv2mp3 |
| 4. Tauri 打包 `.app` | `npx tauri build --bundles app` |
| 5. (可选) 生成 DMG | `hdiutil` 将 `.app` 压缩为 UDZO 格式 `.dmg`，大小上限 300MB |

---

## 开发运行

### 命令行启动（开发模式）

```bash
cd <项目根目录>

# 方式 1：分别启动
nvm use 22.22.3
npm run dev             # 终端1：Next.js 开发服务器 (http://localhost:3000)
npm run tauri dev       # 终端2：Tauri 桌面窗口

# 方式 2：Tauri 自动启动 Next.js dev server
npm run tauri dev       # 单命令，Tauri 会按 beforeDevCommand 启动 Next.js
```

### 分步打包（手动流程）

如果不想用一键脚本，可以分步执行：

```bash
# 1. 构建 Next.js
npm run build

# 2. 精简 Standalone
node scripts/prepare-standalone.mjs

# 3. 打包 .app
npx tauri build --bundles app

# 4. (可选) 生成 DMG
hdiutil create \
  -volname "卓动悦听" \
  -srcfolder "src-tauri/target/release/bundle/macos/卓动悦听.app" \
  -ov -format UDZO \
  -size 300m \
  "src-tauri/target/release/bundle/dmg/卓动悦听.dmg"
```

---

## 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | 22.22.3 | nvm 管理，见 `项目根目录/.nvmrc` |
| Rust / Cargo | 最新 stable | 通过 rustup 安装，`$HOME/.cargo/bin` 必须在 PATH 中 |
| macOS | — | 需安装 Xcode Command Line Tools，`hdiutil` 为系统自带 |

> **提示**：`prepare-standalone.mjs` 需要 `npm install` 权限（在 standalone 目录中安装 bv2mp3 及其依赖），若遇到权限问题可用 `sudo` 或检查目录所有权。

---

## 常见问题

### `cargo: command not found`

```bash
# 确保 cargo 在 PATH 中
export PATH="$HOME/.cargo/bin:$PATH"
```

### `nvm: command not found`

一键脚本已内置 nvm 初始化逻辑。如果手动执行，先加载 nvm：

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

### 打包提示 "`beforeBuildCommand` failed"

通常是构建过程中 npm 安装失败或脚本报错。可以分步执行逐一排查。

### DMG 生成跳过

默认 `./scripts/build.sh` 不生成 DMG，需加 `--dmg` 参数。DMG 体积上限可在脚本中修改 `-size` 参数。
---

## `.gitignore` 补充说明

除了 Next.js 默认的 gitignore 规则外，额外需要忽略的目录和文件：

| 路径 | 说明 |
|------|------|
| `/dist/` | Tauri `frontendDist` 指向的加载页，每次构建生成 |
| `/.next/` | Next.js 构建缓存，可重新生成 |
| `/src-tauri/target/` | Rust 编译产物，体积巨大（包含 `.app`/`.dmg`） |
| `*.dmg` | DMG 安装包，提交到远端会被拒绝（文件太大） |
| `/logs/` | 运行时日志输出目录 |
| `start.sh` / `stop.sh` | 本地开发用启动/停止脚本 |
| `.vscode/` / `.idea/` | IDE 配置 |
| `*.swp` / `*.swo` / `*~` | 编辑器临时文件 |

> **注意**：`src-tauri/target/` 可能数 GB，强烈建议 gitignore。如果团队需要保留编译缓存，可以考虑只忽略其中的 `bundle/` 目录（存放 `.app`/`.dmg`）而保留 `debug/` 和 `release/`。
