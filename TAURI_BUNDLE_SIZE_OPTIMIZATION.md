# ZDMusic Tauri 安装包体积分析与优化方案

> 分析与 P0 实施日期：2026-11-16  
> 分析对象：macOS arm64 的 `.app` / `.dmg`  
> 本次实施范围：P0-1、P0-2、P0-3；未进入 P1/P2，未修改业务代码或 Tauri 配置。

## 1. 结论摘要

优化前 `卓动悦听.dmg` 为 **281,022,870 字节（268.0 MiB）**，挂载后其中的 `.app` 为 **581 MiB**。体积过大的首要原因不是 Tauri，而是应用内打包了一个被后续脚本重新撑大的 Next.js standalone：

- `.app/Contents/Resources/standalone`：**572 MiB**，约占整个应用的 **98.4%**。
- 其中 `standalone/node_modules`：**533 MiB**，约占整个应用的 **91.7%**。
- Tauri 可执行文件：仅 **8.6 MiB**。
- 前端 `.next/static`：仅 **1.5 MiB**。
- AI 深度相关静态资源：约 **29.8 MiB**，但当前 UI 仍标记为“待打包环境验证”，主应用没有接入引用。

最核心的问题在 `scripts/prepare-standalone.mjs`：

1. 脚本先执行 `npm prune --production`，随后又执行普通的 `npm install bv2mp3@4.0.0`，把 standalone `package.json` 中的全部开发依赖重新安装回来。
2. 脚本整包复制 `next`、`@next/swc-darwin-arm64`、`three` 等依赖，覆盖了 Next.js 按需文件追踪的结果。
3. 构建追踪文件显示，真实 Node 运行依赖约 **30.09 MiB**，与当前打入的 **533 MiB** 相差约 **503 MiB**。

因此，应当先修打包脚本，而不是优先压缩图标、删除 three.js 前端代码或调整 DMG 格式。

**体积预期需要区分两种架构：**

- **保留内嵌 Next.js 服务**：合理目标是几十 MiB 的 DMG，不应承诺“几 MiB”。
- **静态前端 + Rust/Tauri 原生 API + AI 模型按需下载**：才有机会做到几 MiB 至十几 MiB，但需要迁移现有 25 个 API 路由，属于架构改造。

## 2. 实测体积构成

以下数据来自现有 DMG、只读挂载后的 `.app`，以及项目构建目录。

| 项目 | 实测体积 | 说明 |
|---|---:|---|
| `卓动悦听.dmg` | **268.0 MiB** | 281,022,870 字节，UDZO 压缩镜像 |
| `.app` | **581 MiB** | DMG 内实际应用 |
| `Contents/Resources/standalone` | **572 MiB** | 最大来源 |
| `standalone/node_modules` | **533 MiB** | standalone 内的主要膨胀源 |
| `standalone/public` | **31 MiB** | 主要是 AI 深度模型和 WASM |
| `standalone/.next` | **8.4 MiB** | Next 服务端和客户端构建产物 |
| `Contents/MacOS` | **8.6 MiB** | Tauri/Rust 可执行文件 |
| `.next/static` | **1.5 MiB** | 真正的浏览器静态资源不大 |
| `src-tauri/target/release` | **1.7 GiB** | 编译缓存，不是安装包内容，不要混为一谈 |

### 2.1 standalone 中最大的依赖

下表存在父子目录包含关系，用于定位来源，不能直接相加作为总体积。

| 依赖或资源 | 未压缩体积 | 判断 |
|---|---:|---|
| `node_modules/next` | **169 MiB** | 被脚本整包复制；追踪到的实际 Next 文件约 12.82 MiB |
| `node_modules/@next` | **116 MiB** | 基本是 `@next/swc-darwin-arm64`，生产追踪未引用 |
| `node_modules/three` | **32 MiB** | 浏览器代码已打包进前端，无需把 Node 包整个塞进服务端 |
| `node_modules/typescript` | **23 MiB** | 开发依赖 |
| `node_modules/openai` | **19 MiB** | 当前路由构建追踪未要求保留完整 Node 包 |
| `node_modules/@tauri-apps` | **16 MiB** | 含约 14.7 MiB 的 Tauri CLI，本机构建工具不应进入应用 |
| `node_modules/@img` | **16 MiB** | 主要是 sharp/libvips；可二次评估是否确需图像优化服务 |
| `node_modules/es-abstract` | **10 MiB** | 依赖链膨胀 |
| `node_modules/@babel` | **9.9 MiB** | 主要为开发/构建链依赖 |
| `node_modules/@tailwindcss` | **9.7 MiB** | 开发依赖 |
| `node_modules/@typescript-eslint` | **7.8 MiB** | 开发依赖 |
| `node_modules/@types` | **7.2 MiB** | 类型声明，运行时无用 |
| `public/visual/ai-depth` | **29.8 MiB** | 当前主应用尚未接入 |

其他明确可见的开发依赖还包括 ESLint 及其插件、`lightningcss-darwin-arm64`、Tailwind 等。对现有 standalone 执行 `npm prune --omit=dev --dry-run`，npm 报告可移除 **335 个开发包**。

### 2.2 最大单文件

| 文件 | 体积 | 备注 |
|---|---:|---|
| `@next/swc-darwin-arm64/next-swc.darwin-arm64.node` | **115.9 MiB** | 构建期原生二进制，未被生产追踪引用 |
| `model_q4f16.onnx` | **18.2 MiB** | AI 深度模型 |
| `libvips-cpp.8.17.3.dylib` | **15.3 MiB** | sharp 图像处理动态库 |
| `cli.darwin-arm64.node` | **14.3 MiB** | Tauri CLI，不应进入运行时 |
| `ort-wasm-simd.wasm` | **9.6 MiB** | AI 推理 WASM |

作为压缩量级参考，`gzip -9` 后 SWC 约 37.6 MiB，ONNX 约 16.7 MiB，WASM 约 2.65 MiB。因此它们也会显著影响 DMG，而不只是影响解压后的 `.app`。

## 3. 根因定位

### 3.1 精简后又把开发依赖装回来

[prepare-standalone.mjs](scripts/prepare-standalone.mjs) 当前顺序为：

1. 第 40–57 行：执行 `npm prune --production`。
2. 第 59–97 行：从根目录整包复制一批所谓运行依赖。
3. 第 99–118 行：在 standalone 根目录执行普通的 `npm install bv2mp3@4.0.0`。

standalone 的 `package.json` 仍包含完整的 `devDependencies`。第 3 步没有 `--omit=dev`，所以 npm 会根据这个 manifest 安装完整依赖树，等于撤销第 1 步的精简。

实测 standalone 顶层仍包含：

- `typescript`
- `tailwindcss`
- `eslint` / `eslint-config-next`
- `@tauri-apps/cli`
- `@types/*`

这一步还使构建产生版本漂移：当前 standalone 中部分包版本已高于根项目声明的初始版本。打包时不应在主 standalone 目录做无锁、联网的完整依赖安装。

### 3.2 整包复制破坏了 Next.js 文件追踪

Next.js standalone 的价值是只保留运行所需文件。当前脚本却复制完整包，导致：

| 项目 | Next 生产追踪结果 | 当前实际打入 |
|---|---:|---:|
| 全部 Node 运行依赖 | **约 30.09 MiB** | **533 MiB** |
| `next` | **约 12.82 MiB** | **169 MiB** |
| `@next/swc` | **未引用** | **约 116 MiB** |
| `three` | **未要求作为 Node 运行包保留** | **32 MiB** |
| `openai` | **未要求作为完整 Node 运行包保留** | **19 MiB** |

所以脚本第 41–43 行“standalone 会把整个 node_modules 原样复制”的注释并不符合本次追踪证据。真正的大头发生在后续手动复制和重新安装阶段。

### 3.3 尚未接入的 AI 资源被默认打包

[stageVisual.ts](app/lib/stageVisual.ts) 第 177–180 行将“AI 深度（高精度模型）”标为 `pending`，主应用搜索不到对 `public/visual/ai-depth` 的接入引用，但 [prepare-standalone.mjs](scripts/prepare-standalone.mjs) 第 27–28 行会复制整个 `public`。

这使约 29.8 MiB 的模型、WASM、两套 Transformers 运行库和 benchmark 页面全部进入安装包。

### 3.4 当前不是“纯 Tauri 静态壳”架构

[tauri.conf.json](src-tauri/tauri.conf.json) 同时配置了：

- `frontendDist: ../dist`：这里的 `dist/index.html` 只是启动/等待页面。
- `bundle.resources: ../.next/standalone -> standalone`：完整 Next 服务被放入 Resources。

[lib.rs](src-tauri/src/lib.rs) 第 89–107 行会在生产环境启动 Next 服务，再把 WebView 跳转到 `localhost:3978`；[server.rs](src-tauri/src/commands/server.rs) 第 186–224 行则依赖系统 Node.js 执行 `server.js`。

项目当前有 **25 个 API 路由**，负责配置、媒体库、播放列表、AI、B 站、识别等功能。因此，保留这套架构就必然携带一定的 Next 服务端运行时代价；“几 MiB”不能仅靠压缩实现。

### 3.5 Rust 只占小头

[Cargo.toml](src-tauri/Cargo.toml) 没有定制 `[profile.release]`，并启用了 `devtools`。它们有优化空间，但可执行文件只有 8.6 MiB，即使减少数 MiB，也无法解释 268 MiB 的安装包。

图标、DMG 的 `targets: all`、`src-tauri/target` 编译缓存也都不是本次主因。

## 4. 推荐优化顺序

## P0：保留现有功能与架构，先修打包脚本

### P0-1：让 Next standalone 保持构建追踪结果

调整 [prepare-standalone.mjs](scripts/prepare-standalone.mjs)：

1. 保留 `.next/static` 和必要 `public` 资源的复制。
2. 删除第 1 步对主 standalone 的 npm prune。
3. 删除第 2 步的 `RUNTIME_PKGS` / `RUNTIME_SCOPED` 整包复制。
4. 禁止在 standalone 根目录执行普通 `npm install`。
5. 构建后检查禁止出现的目录，如 `typescript`、`@types`、`eslint`、`@tauri-apps/cli`、`@next/swc-*`；出现即让构建失败，而不是继续产出一个超包。

原则：**缺什么通过追踪配置或精确复制补齐，不再整包复制，也不再用完整项目 manifest 重新安装。**

### P0-2：单独处理动态执行的 bv2mp3

不能简单删除 `bv2mp3`。[chat/route.ts](app/api/chat/route.ts) 第 136–150 行通过 `process.execPath` 动态执行 `node_modules/bv2mp3/src/index.js`，这种运行方式无法完全依赖 Next 自动追踪。

推荐做法：

- 在临时目录建立只包含 `bv2mp3@4.0.0` 的最小运行 manifest 和锁文件。
- 在该隔离目录运行 `npm ci --omit=dev`。
- 只把这份最小运行依赖合并到 standalone，或作为独立 resource 保存并显式修改执行路径。
- 不让这个隔离安装过程读取根项目的完整 `dependencies` / `devDependencies`。
- 验证 B 站云搜索和下载，确认没有依赖开发机上根目录 `node_modules` 的偶然解析。

不建议把 Node.js 再作为 sidecar 打进应用，那会额外增加几十 MiB，与瘦身目标相反。

### P0-3：默认安装包排除未接入的 AI 深度资源

在 AI 深度功能正式接入前：

- release 资源复制时排除 `public/visual/ai-depth`。
- 保留源目录供开发验证，不要求删除源码资产。
- 后续启用时改为按需下载到 Tauri app data 或 `~/.zdmusic/models`，带版本、校验和、失败重试与启发式深度降级。
- benchmark 页面和两套不同时使用的 Transformers 运行库不应全部进入正式包。

预计减少约 **29.8 MiB 未压缩体积**，DMG 也可明显减少。

### P0 首轮验收预算

以下是实施前的工程预算，实际构建结果见下一节：

| 指标 | 当前 | 首轮目标 |
|---|---:|---:|
| DMG | 268 MiB | **≤ 60 MiB** |
| `.app` | 581 MiB | **≤ 100 MiB** |
| standalone `node_modules` | 533 MiB | **≤ 60 MiB** |
| standalone `public` | 31 MiB | **≤ 2 MiB**（AI 不内置） |

达到预算后，再根据真实包体逐项收紧，不建议先写一个无法验证的“几 MiB”结论。

### P0 实测结果（2026-11-16）

P0 已实施完成，正式构建的全部指标均优于首轮预算：

| 指标 | 优化前 | P0 实测 |
|---|---:|---:|
| DMG | 268.0 MiB | **27,025,986 字节（25.8 MiB，`du` 为 26 MiB）** |
| `.app` | 581 MiB | **56 MiB** |
| standalone | 572 MiB | **47 MiB** |
| standalone `node_modules` | 533 MiB | **38 MiB** |
| standalone `public` | 31 MiB | **1.5 MiB** |
| standalone `.next` | 8.4 MiB | **8.2 MiB** |

DMG 减少约 **90.4%**。Tauri 可执行文件仍为 **9,018,272 字节**，本轮未进行 Rust 压缩。

实际修改：

- 保留 Next.js standalone 的按需文件追踪结果，移除 prune、整包复制和主 standalone 内的完整依赖安装。
- 在临时目录以 `--omit=dev` 隔离安装 `bv2mp3@4.0.0`，只合并其生产依赖，并清除运行时用不到的 `.bin`。
- release 复制后移除 `public/visual/ai-depth`，源目录仍保留；对 TypeScript、ESLint、Tauri CLI、SWC 和 AI 深度资源加入构建期防回退检查。

验证结果：

- `npx tsc --noEmit`、Next.js 生产构建和完整 `npm run tauri:build` 均通过。
- 将新 `.app` 复制到 `/private/tmp` 后从源码树外启动，持续运行超过 4 分钟；主页和健康检查返回 200，配置读取及 `/api/config/reload` 均通过。
- 浏览器实际验证本地搜索“稻香”、设置面板和 Three.js 沉浸舞台，未发现模块加载或控制台错误。
- 直接执行包内 bv2mp3，成功将公开 B 站视频转换为 **212.39 秒、7,108,870 字节**的 MP3，证明其运行时不依赖仓库根 `node_modules`。
- 防回退检查通过，包内没有 TypeScript、`@types`、ESLint、Tauri CLI、SWC、AI 深度资源或遗留符号链接。

未通过及未覆盖项：B 站云搜索返回空结果，服务日志确认上游接口响应 **HTTP 412**；真实视频下载成功，因此该问题不是 bv2mp3 依赖缺失，但搜索风控/Cookie 适配仍需单独处理。本轮未执行完整本地扫描、实际音频播放、播放列表写入及设置保存的全功能回归。

## P1：在功能回归通过后继续压缩

### P1-1：评估移除 sharp/libvips

当前没有搜索到 `next/image` 或 `/_next/image` 使用，但生产追踪仍包含约 15.3 MiB 的 libvips。可结合 Next 图片优化配置评估是否完全不需要 sharp。

这是第二优先级：删除后必须验证首页封面、B 站封面、本地封面和沉浸式舞台，避免图片处理路径运行时报错。

### P1-2：给 Rust release 增加体积优化配置

在 P0 完成后再评估：

```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
```

`panic = "abort"` 可单独实验，但必须完整验证启动、托盘、文件选择、配置和服务进程管理，不与首轮脚本修复混在一起。

同时可评估生产构建不启用 `devtools`。这些改动通常只减少数 MiB，不能替代 P0。

### P1-3：DMG 压缩只做收尾

当前已经使用 UDZO 压缩。可评估 `hdiutil -imagekey zlib-level=9`，但收益远小于删除错误打入的依赖。

`targets: all` 改为只构建所需格式可以减少构建产物数量和时间，但不会直接缩小同一个 DMG。

## P2：如果最终必须做到“几 MiB”

需要调整为真正的静态桌面应用：

1. 前端改为静态导出，由 Tauri 直接加载，不再内嵌 Next standalone。
2. 将 25 个 Next API 路由按职责迁移为 Rust/Tauri commands 或其他本地原生实现。
3. AI 深度模型、WASM 等按需下载，不进入基础安装包。
4. 保留 three.js 前端按需构建；three 的浏览器构建产物本身不是当前大头。
5. 不额外内嵌 Node 运行时。

只有这条路径才可能接近“几 MiB 至十几 MiB”。它需要逐路由做功能等价和离线验证，不能直接把 `output` 改成 `export`，否则现有 API 会全部失效。

## 5. 不建议优先做的事情

- **不要先压图标**：`icon.icns` 约 292 KiB，收益可忽略。
- **不要先删除 three.js 功能**：前端 `.next/static` 总共约 1.5 MiB；当前 32 MiB 是错误打入服务端的完整 npm 包。
- **不要只清理 `src-tauri/target`**：这能释放开发机磁盘，但不会解决 DMG 内的 533 MiB Node 依赖。
- **不要只把 prune 再执行一遍**：只要后面仍运行普通 npm install 或整包复制，问题还会复发。
- **不要在 standalone 根目录补一个 `--omit=dev` 就结束**：这只能移除开发依赖，无法解决完整 `next`、SWC、three 等被再次复制/安装的问题。
- **不要以内嵌 Node sidecar 为优化方案**：会增加而不是减少安装包体积。

## 6. 实施后的验证清单

### 6.1 构建与体积

```bash
npx tsc --noEmit
npm run tauri:build

du -sh "src-tauri/target/release/bundle/macos/卓动悦听.app"
du -sh "src-tauri/target/release/bundle/dmg/卓动悦听.dmg"
du -sh ".next/standalone/node_modules"
du -sh ".next/standalone/public"
```

同时检查：

```bash
test ! -d ".next/standalone/node_modules/typescript"
test ! -d ".next/standalone/node_modules/@types"
test ! -d ".next/standalone/node_modules/eslint"
test ! -d ".next/standalone/node_modules/@tauri-apps/cli"
test ! -d ".next/standalone/node_modules/@next/swc-darwin-arm64"
test ! -d ".next/standalone/public/visual/ai-depth"
```

### 6.2 一条主路径与两个关键边界

主路径：从打包后的 `.app` 启动，完成首页加载、本地音乐扫描与播放、播放列表读写、B 站云搜索和 AI 下载。

关键边界：

1. 从 `/Applications` 启动，工作目录离开源码仓库，确认没有意外使用开发机的根 `node_modules`。
2. 检查 AI 深度未启用时仍能使用启发式深度；检查配置文件加载、设置保存及 `/api/config/reload` 仍正常。

最终报告必须同时给出新 DMG、`.app`、standalone、Node 依赖和 public 的实测值，不能只报告压缩后的单一数字。

## 7. 最终建议

**P0-1、P0-2、P0-3 已完成**，DMG 已从 268 MiB 降至约 26 MiB，第一阶段无需牺牲现有 3D 功能，也无需重写应用。

下一步先补齐全功能回归并单独处理 B 站搜索的上游 412；确认稳定后，再按需选择 P1 的 sharp/Rust 压缩。只有仍必须追求“几 MiB”时，才值得投入 P2 架构迁移。
