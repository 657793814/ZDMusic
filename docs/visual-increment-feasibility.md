# 视觉增量可行性：音域回响（WE 独立化）与 AI 深度（模型实测）

> 状态：独立准备完成，未改动 `app/components`、`app/context`、`app/styles`、`app/api`、`package.json`、`src-tauri`，未执行 `npm run tauri:build`。
> 所有数据均为本机实测（Chrome 156 / Apple Silicon / Metal-3）。

## 0. 结论摘要

| 项 | 结论 | 关键代价 |
|---|---|---|
| 音域回响 | **可脱离 Wallpaper Engine 独立运行**，无需改造源码 | +1.23 MB 静态资源；iframe 常驻会额外占一个 WebGL 上下文 |
| AI 深度 | **能跑，但必须换后端与分辨率**：WebGPU + 252 输入 ≈ 0.35 s/帧；原始 WASM + 518 输入 ≈ 8 s/帧，不可用 | +18.24 MB 模型 + 5.7 MB 运行时；无 WebGPU 时只能后台一次性算，不能实时 |

---

## 1. 音域回响（Sonic Topography / 音域回响·WE）

### 1.1 Mineradio 中的实现位置与形态

| 文件 | 大小 | 作用 |
|---|---|---|
| `public/vendor/sonic-workshop/assets/index-Z-j1MQ-r.js` | 1.20 MB | Vite 打包产物：React 19 + Three.js + React Three Fiber + Framer Motion + GLSL，160×160 实例化柱状地形 |
| `public/vendor/sonic-workshop/assets/index-Bhwp8mwk.css` | 9.75 KB | 打包样式 |
| `public/vendor/sonic-workshop/mineradio-bridge.html` | 13.9 KB | **WE 宿主替身**：伪造 WE 注入的全局对象，本身已是一层适配器 |
| `public/vendor/sonic-workshop/preview.gif` | 894 KB | Steam 创意工坊预览图，运行时不需要 |
| `public/vendor/sonic-workshop/project.json` | 8.6 KB | WE 工程元数据（属性面板定义），运行时不读 |

宿主侧接入代码在 `public/sonic-workshop-preset.js`：创建 `#sonic-workshop-layer` + `<iframe src="vendor/sonic-workshop/mineradio-bridge.html">`，每帧用 `postMessage` 推音频/媒体/属性。

**形态判定**：纯静态 HTML/JS 包，可直接静态托管；唯一宿主依赖面是 WE 的全局 API，而该 API 已被 `mineradio-bridge.html` 完整伪造。

### 1.2 WE 依赖点逐条

bundle 内实际引用（`grep wallpaper*` 结果）：

| 依赖点 | 谁提供 | 是否必需 | 说明 |
|---|---|---|---|
| `window.wallpaperPropertyListener.applyUserProperties(props)` | **bundle 自己定义**（`window.wallpaperPropertyListener={...}`），由宿主调用 | 是 | 主题/参数下发入口；props 必须是 `{key:{value}}` 包装 |
| `window.wallpaperPropertyListener.applyGeneralProperties` | 同上 | 否 | 只用于 `fps` 限帧 |
| `window.wallpaperRegisterAudioListener(cb)` | 宿主 | 是 | 提供 512 长度频谱数组（0..1） |
| `window.wallpaperReady()` | 宿主 | 是 | 通知壁纸"宿主就绪" |
| `window.__mediaState` + `__mediaState._callbacks` | 宿主 | 是（封面/歌名） | bundle 订阅该对象的回调数组，**不是** WE 的 media API |
| `window.wallpaperRegisterMediaPropertiesListener` 等 5 个 | 宿主 | **否** | 桥接里提供了，但 bundle 没有任何调用；属于备用兼容 |
| `window.wallpaperMediaIntegration.PLAYING/PAUSED` | 宿主 | 否 | 桥接提供常量，bundle 未引用 |

结论：**没有真正的 WE 运行时硬依赖**。`mineradio-bridge.html` 就是官方"去 WE 化"补丁，缺的只是把它搬进本工程。

### 1.3 实测（本工程副本）

- 地址：`http://127.0.0.1:8902/visual/sonic-echo/index.html`
- 结果：**PASS**。1440×645 视口下 canvas 2880×1290，`webgl2` 可用，画面为暗红/紫红 3D 柱状地形，无 error。
- 唯一 warning：`THREE.Clock: This module has been deprecated...`（无影响）。
- 另有一次 `THREE.WebGLRenderer: A WebGL context could not be created...` 出现在自动化探针里，原因是探针先用 `webgl` 探测同一 canvas；页面自身用 `webgl2`，不受影响。

### 1.4 落地位置与体积

```
public/visual/sonic-echo/
├── index.html                 13.9 KB   （原 mineradio-bridge.html，未改一行）
└── assets/
    ├── index-Z-j1MQ-r.js       1.20 MB
    └── index-Bhwp8mwk.css      9.75 KB
```

合计 **1.23 MB**（未带 `preview.gif` / `project.json`；Mineradio 原目录 2.1 MB 主要是那张 894 KB 的预览图）。

### 1.5 接入方式（照着接）

三种消息，同源时可直接调函数（Mineradio 就这么做），跨源/打包环境用 `postMessage` 同 schema：

```ts
// 1) 音频：512 个 0..1 的频域强度（任意长度也行，桥接会线性重采样到 512）
iframe.contentWindow?.__mineradioApplyAudio(samples)
// postMessage: { type:'mineradio-sonic-workshop-audio', samples: number[] }

// 2) 媒体：封面/歌名/播放状态
iframe.contentWindow?.__mineradioApplyMedia({
  title, artist, thumbnail, primaryColor: '#rrggbb', textColor: '#rrggbb',
  isPlaying, position, duration
})
// postMessage: { type:'mineradio-sonic-workshop-media', media }

// 3) 属性：主题与渲染参数（**不要**包 {value}，桥接内部自己包装）
iframe.contentWindow?.__mineradioApplyProperties({
  theme: 'mineradio-custom',
  mineradioCustomTheme: { name, id, __primaryColor, uGlowIntensity,
    uBaseColor1, uBaseColor2, uCoolCore, uCoolEdge, uWarmCore, uWarmEdge, uRippleColor, uPeakColor },
  schemecolor: 'r g b',            // 0..1 三个浮点
  audioIntensity, responseRange, peakColorIntensity, gridSize,
  pulseEnabled, pulseSensitivity, pulseCooldown, meteorEnabled, meteorSensitivity,
  meteorCooldown, meteorClickEnabled, idleWaveEnabled, idleWaveDebounce, idleWaveFadeDuration,
  cameraDistance, autoRotateEnabled, autoRotateSpeed, cameraAngleX, cameraAngleY,
  showPlayerController, showAlbumCover, controllerSize, controllerX, controllerY
})
// postMessage: { type:'mineradio-sonic-workshop-properties', properties }
```

要点：

1. **音频源**：本工程 `useAudioVisualizer` 已有 `AnalyserNode`（`getByteFrequencyData`，fftSize 256 → 128 bin）。直接把 byte 值 `/255` 传 128 长度数组即可，桥接会拉伸到 512；不需要改 analyser 配置。
2. **封面**：`thumbnail` 支持 URL 或 dataURL；跨域封面转 dataURL 会污染 canvas，能直接给同源/允许 CORS 的 URL 最好。
3. **挂载/卸载**：模块自带 rAF 常驻渲染（暂停时走 idle wave 呼吸）。不激活时应把 iframe 整个移除，而不是只设 `opacity:0`，否则会多一个持续占用 GPU 的 WebGL 上下文。
4. **图层**：`position:absolute; inset:0; pointer-events:none; aria-hidden; inert`，放在舞台 canvas 之下/之上按视觉需要；不要叠 `backdrop-filter`。
5. **暂停**：`mineradioApplyMedia({isPlaying:false})` 不会自动降噪，Mineradio 额外把音频样本乘了 `WORKSHOP_AUDIO_PAUSED_GAIN`；本工程可在暂停时把样本整体乘以 0.2 左右。

---

## 2. AI 深度

### 2.1 Mineradio 用的是哪个模型

`public/js/modules/02-visual/15-ripples-cover-depth.js`：

```js
var mod = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
mod.env.backends.onnx.wasm.numThreads = 1;
aiDepthPipeline = await mod.pipeline('depth-estimation', 'Xenova/depth-anything-small-hf');
```

| 项 | 值 |
|---|---|
| 模型 | `Xenova/depth-anything-small-hf`，即 **Depth Anything V2 Small**（DINOv2-S backbone，hidden 384，6 heads，patch 14，24.8M 参数，DPT neck/head） |
| 推理后端 | transformers.js 2.17.2 → onnxruntime-web（WASM，`numThreads=1`），**无 WebGPU**（v2 不支持） |
| 权重 | `onnx/model_quantized.onnx` = **26.25 MB**（int8） |
| 输入 | 先缩到 160×160 再 `toDataURL('image/jpeg',0.82)`；但预处理器会把图 **resize 到 518×518** 才喂网络 |
| 输出 | 深度图回插值到原图尺寸，灰度写入 R 通道，与启发式 G/B/A 合并成 256×256 纹理 |
| 失败策略 | 抛错后熔断 120 s，回退启发式深度 |

### 2.2 三条路径成本表

| 路径 | 包体增量 | 首帧成本 | 稳态 | 评价 |
|---|---|---|---|---|
| A 内置完整 fp32 | 94.58 MB（+运行时） | 大 | 慢 | 不可取 |
| B 内置 int8（Mineradio 原方案） | **26.25 MB** + WASM 运行时 10.42 MB = **36.7 MB** | 本机热缓存 1.3 s | 518: **8.1 s/帧**；252: **1.1 s/帧** | 518 不可用，252 只能后台跑 |
| C 内置 q4f16 + WebGPU（**推荐**） | **18.24 MB** + 运行时 5.74 MB = **24.0 MB** | 本地 3.97 s + 首帧 1.05 s ≈ **5.0 s** | 518: 2.69 s；252: **0.348 s/帧** | 唯一能当"准实时"用的组合 |
| D 首启下载 + 缓存（不内置） | 包体 **0** | 联网 18.24 MB 模型 + 5.29 MB wasm，本机 ~7.5 s；之后同 C | 同 C | 包体最省，但离线首用不可用 |

说明：Mineradio 文案里的"首次需下载 50 MB"并不精确。按文件粒度算是 26.25 MB 权重 + 9.55 MB `ort-wasm-simd.wasm` + 0.86 MB transformers.js ≈ 36.7 MB；若用 fp16 权重则 47.55 MB，接近 50 MB。

### 2.3 实测数据（本机 Chrome 156 / Apple Silicon / Metal-3）

环境：`crossOriginIsolated=false` → 无 `SharedArrayBuffer` → **WASM 只能单线程**（`numThreads=1`，与 Mineradio 一致）；`navigator.gpu` 可用（adapter: apple / metal-3）。

| 用例 | 权重 | 后端 | 输入分辨率 | 加载+建会话 | 5 次推理 (ms) | 中位数 |
|---|---|---|---|---|---|---|
| B-518 | int8 26.25 MB | WASM 1 线程 | 518 | 1304（本地热缓存） | 3891, 3835, 8098, 12642, 16791 | **8098** |
| B-252 | int8 26.25 MB | WASM 1 线程 | 252 | 853 | 924, 733, 1129, 1165, 2981 | **1129** |
| C-518 | q4f16 18.24 MB | **WebGPU** | 518 | 7526（含 CDN 下载 18.24 MB + 5.29 MB wasm） | 4197, 2394, 2689, 5665, 968 | **2689** |
| C-252 | q4f16 18.24 MB | **WebGPU** | 252 | 3965（缓存热） | 1049, 297, 350, 340, 348 | **348** |

冷启动到首帧（本地文件 + 浏览器缓存热）：C-252 ≈ **5.0 s**（3.97 s 加载/建会话 + 1.05 s 首帧，首帧含 shader 编译）。首次联网（CDN）再加 ~7.5 s 传输。

诚实说明：

- 518 的 WASM 数据抖动极大（3.8 s ~ 16.8 s），原因是单线程 CPU 推理 + 同期本机还有开发/构建任务争抢 CPU；中位数 8.1 s，**不能用于实时**。
- WebGPU 518 也有 0.97 s ~ 5.7 s 的抖动，前两次含 pipeline 编译与显存分配；252 稳定在 0.30~0.35 s。
- 分辨率是主因：518→252 输入像素少 4 倍，WASM 8.1 s→1.1 s，WebGPU 2.69 s→0.35 s。

### 2.4 关键坑（会直接卡住的人）

1. **ONNX IR 版本**：`onnx-community/depth-anything-v2-small` 的权重复用 IR 9，`@xenova/transformers@2.17.2`（ORT 1.14）建会话直接报 `IR version 9 exceeds max supported version 8`。所以 **Mineradio 的 v2 管线只能用 `Xenova/depth-anything-small-hf` 的导出**；要用 q4f16 必须升级到 `@huggingface/transformers` v4（ORT 1.31）。
2. **输入类型**：v2 的 depth pipeline 不接受 canvas，只接受 URL 字符串 / RawImage / Blob；必须 `toDataURL()`（Mineradio 也是这么写的）。
3. **v4 浏览器直用需要 import map**：`transformers.web.min.js` 里有 bare import `onnxruntime-web/webgpu` 与 `onnxruntime-common`，纯静态页必须加 import map（本次 bench 页已示范）。
4. **WebGPU 前提**：`navigator.gpu` 可用 + 安全上下文。macOS 上 Chrome/Edge 可以；**Tauri 用的是 WKWebView，是否开放 WebGPU 需在打包环境单独验证**（这是本报告唯一未验证的关键项）。没有 WebGPU 就只剩 B 路径（252 也要 1.1 s/帧）。
5. **线程数**：`numThreads>1` 需要 `Cross-Origin-Opener-Policy/Cross-Origin-Embedder-Policy` 让 `SharedArrayBuffer` 可用；Next 默认不发这两个头，Tauri 里也未必有。本次全程按单线程测。
6. **许可**：Depth Anything V2 代码 Apache-2.0，但 backbone 源自 DINOv2（CC BY-NC 4.0）。商用前需法务确认权重许可，别默认可商用。

### 2.5 落地位置与体积

```
public/visual/ai-depth/
├── bench.html                                    ~4 KB   实测页（非生产，可保留做回归）
├── models/depth-anything-v2-small/
│   ├── config.json                               DepthAnythingForDepthEstimation
│   ├── preprocessor_config.json                  size 已改为 252×252（原 518 见下）
│   └── onnx/model_q4f16.onnx                     18.24 MB
└── vendor/
    ├── transformers-v4.web.min.js                0.45 MB   （WebGPU 路径）
    ├── transformers.min.js                      0.86 MB   （WASM 兜底路径 v2.17.2）
    └── ort-wasm-simd.wasm                        9.55 MB   （仅 v2/WASM 兜底用）
```

合计 **30 MB**。若只走 WebGPU 路径，可删 `transformers.min.js` + `ort-wasm-simd.wasm`，降到 **19.6 MB**；若要再省，模型改成首启下载则包体增量 ≈ 0.45 MB。

`preprocessor_config.json` 当前是 **252×252**（`ensure_multiple_of: 14`）。要回到 518 只需把 `size` 改回 `{height:518,width:518}`。

### 2.6 推荐接入方案（给主会话）

1. 场景：只为"当前封面生成一张深度图"，**不是**每帧推理。
2. `device:'webgpu'`、`dtype:'q4f16'`、252 输入；在 `requestIdleCallback`/切歌后的后台时机跑一次，缓存按 `trackId+封面URL` 做 LRU（深度图 252² 灰度足够）。
3. 冷启动会卡 1 s 左右（首帧 shader 编译），必须在首帧前把 `AI 深度` 状态标为"计算中"，不要让 UI 等它。
4. 失败/无 WebGPU → 直接跳过，不要退回 WASM 518；若坚持兜底，用 252 + WASM（1.1 s）且只做一次性后台增强。
5. 输出：`res.depth` 是 RawImage，可 `await res.depth.toCanvas()`（v4）或自行归一化写入 R 通道，沿用 Mineradio 的"中心/边缘反相判定"逻辑。

```ts
// 伪代码（v4）
const { pipeline, env } = await import('/visual/ai-depth/vendor/transformers-v4.web.min.js');
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/visual/ai-depth/models/';
const pipe = await pipeline('depth-estimation', 'depth-anything-v2-small',
  { device: 'webgpu', dtype: 'q4f16' });
const depth = await pipe(coverDataUrl);   // 约 0.35 s（稳态）
```

> 生产接入建议把 `@huggingface/transformers` 走 npm 依赖 + 打包，而不是像 bench 那样靠 import map 拉 CDN；bench 页的 import map 只是为了让静态页可复现实测。

---

## 3. 已验证 / 未验证

已验证：

- 音域回响在无 WE 宿主下渲染成功（本工程副本，1440×645，webgl2，无 error）。
- 四组深度推理实测数据（含 WebGPU），环境、分辨率、权重、后端全部可复现（`/visual/ai-depth/bench.html`）。
- 模型下载来源：`hf-mirror.com`（huggingface.co 在本机不可达），jsdelivr 可用。

未验证（需要主会话在打包/真实环境确认）：

- Tauri macOS（WKWebView）是否有 WebGPU；没有则只能走 2.2 的 B 路径。
- 生产 Next 构建下 iframe 的 CSP、`inert`、以及 `public/` 资源哈希策略是否影响 `sonic-echo` 的相对路径（目前是同源静态路径，风险低）。
- 模型许可（DINOv2 非商用条款）。

## 4. 未触碰

- 未修改任何既有业务文件；`git status` 仅新增 `public/visual/`（本报告另计）。
- 未运行 `npm run tauri:build`；测试用 8901/8902 两个临时静态端口，未占用 3978。
