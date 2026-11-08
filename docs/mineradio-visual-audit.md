# Mineradio 视觉控制台清单（移植范围确认稿）

来源：`/Users/liuzuodong/Documents/workspace/Mineradio-paused`
入口：`public/index.html` 的 `#fx-panel`（36 个分区，约 130 个控制项）
相关脚本：`public/js/modules/00-state/04-fx-defaults.js`（默认值）、`07-fx/05-fx-panel-performance.js`（面板绑定）、`07-fx/04-preset-grid-uniforms.js`（每帧把 fx 写进 shader uniforms）、`02-visual/00-pointer-cover-particles.js`（主视觉）、`01-scene/*`（相机）、`public/sonic-topography-preset.js`（音域地形）、`public/vendor/sonic-workshop/*`（WE）

## 0. 先给结论：它的"立体感"从哪来

1. **不是平面叠层**。封面是一块 4.8×4.8 的 3D 平面，被切成 183×183 ≈ **33,489 个粒子点**，每个点按封面亮度/边缘深度图做 Z 轴起伏，整个点云跟着相机转。
2. **真透视相机在动**。透视 FOV 45、轨道半径 6.6（可 2.4–14），指针拖拽 orbit、滚轮推拉、电影镜头缓慢漂移 + 节拍脉冲（theta/phi/radius/roll 四个方向），景深由"点的大小/透明度随 z 变化"和前后层不同视差速度共同给出。
3. **空间里不止一个物体**。封面点云之外还有：背景星河（1400 点、多层深度）、溢光层（第二遍绘制的大点 additive 层）、可选音域地形（168 单位的地面网格，最高 224×224 顶点，随音频起伏 + 流星 + 浮空方块）。
4. **默认参数其实很保守**：立体感滑块 `depth` 默认只有 **0.2**（范围 0.2–1.8），粒子溢光默认 **关**，浮空粒子层代码里被直接 `return` 掉了。也就是说它默认状态并不是最立体的一档——这是可以立刻拉开差距的地方。

> 参考"拿到手"这一步：抖音短链那条线按新指令已停止，没有再解析/抽帧。

---

## 1. 表 A｜主视觉 / 粒子（立体感核心）

| 控制项 | 范围 / 默认 | 实际驱动的效果 | 实现技术 | 依赖 | 移植结论 |
|---|---|---|---|---|---|
| 视觉预设 `fx-preset` | 0–12，默认 0 | 13 套主视觉：0 封面粒子 / 1 滚筒隧道 / 2 星球 / 3 虚空 / 4 唱片 / 5 星河 / 6 骷髅(YUI7W) / 7 音域地形 / 8 WE / 9 月蚀圣环 / 10 雨幕霓虹 / 11 折光蝶群 / 12 深海绽放 | three.js r128；同一个 `THREE.Points` + 自定义 `ShaderMaterial`，靠 `uPreset` 分支改顶点位置 | 全局 `scene/camera/uniforms`、音频频段、封面贴图、深度图 | **需重写**（shader 公式可整段搬，全局耦合要拆） |
| 律动强度 `fx-intensity` | 0.2–1.6，默认 0.85 | 音频位移振幅、相机冲动、粒子爆散幅度 | shader uniform + analyser | bass/mid/treble 全局 | **可搬**（换我们的 analyser） |
| 立体感 `fx-depth` | 0.2–1.8，默认 0.2 | 封面粒子 Z 轴挤出深度（0.2 近乎平面，1.8 强浮雕） | `uDepth` 顶点位移 | 深度图（启发式或 AI） | **可搬**（核心开关） |
| 封面清晰度 `fx-coverres` | 0.75–1.55，默认 1.55 | 粒子网格 88²–183²（默认 183²=33,489 点）；贴图 256/384/512 | geometry 重建 + CanvasTexture | 封面图 | **可搬** |
| 粒子尺寸 `fx-point` | 0.5–2.2，默认 1.0 | `gl_PointSize` 缩放 | shader | — | **可搬** |
| 流速 `fx-speed` | 0.2–2.5，默认 1.0 | 粒子流动/波浪时间倍率 | shader uniform | — | **可搬** |
| 扭曲 `fx-twist` | 0–0.6，默认 0 | 绕 Z 轴涡旋 | shader | — | **可搬** |
| 色彩张力 `fx-color` | 0.5–2.0，默认 1.10 | 颜色增益、饱和度放大 | shader | 封面取色 | **可搬** |
| 溢光强度 `fx-bloom` | 0–1.6，默认 0.62 | 第二层大点 additive 点云的亮度 | 第二个 `THREE.Points`，共享几何、`depthTest:false` | 同一套顶点数据 | **可搬**（不是后处理 bloom） |
| 离散感 `fx-scatter` | 0–0.5，默认 0 | XY 抖动；切歌时先冲高再回落，做"爆散合拢"转场 | shader | — | **可搬** |
| 背景压缩 `fx-bgfade` | 0–1.2，默认 0.2 | 舞台背景层压暗程度 | CSS/材质透明度 | — | **可搬** |
| 粒子溢光 `t-bloom` | 默认关 | 是否绘制溢光层 | 见上 | — | **可搬** |
| 轮廓高亮 `t-edge` | 默认关 | 封面边缘描边增强 | Sobel 边缘纹理（canvas 2D）+ shader | 封面像素 | **可搬** |
| 浮空粒子层 `t-float` | 默认关 | 第二层浮空粒子 | `createFloatLayer()` 里直接 `return`，源码已禁用 | — | **不可搬（死代码）** |
| AI 深度 `t-aidepth` | 默认关 | 用 AI 深度图代替启发式深度 | Transformers.js v3 + Depth-Anything-Small（CDN，首次约 50MB） | 网络/模型缓存 | **不可搬**（Tauri 离线场景需换本地模型或放弃） |
| 背景星河 `t-backgroundStarRiver` | 默认开 | 1400 点、多层深度的背景粒子 | three.js Points，additive | 背景 shader | **可搬** |

---

## 2. 表 B｜镜头 / 空间运动（立体感第二大来源）

| 控制项 | 范围 / 默认 | 实际效果 | 实现技术 | 依赖 | 移植结论 |
|---|---|---|---|---|---|
| 电影镜头 `t-cinema` | 默认开 | 缓慢正弦漂移 + 焦点分区（悬停歌单架/队列时镜头推向焦点，离开回中） | 纯数学（camera 位置/四元数）+ 指针命中检测 | 全局 camera、DOM 命中 | **需重写**（数学可整段搬） |
| 镜头晃动 `fx-cineshake` | 0–1.8，默认 0.5 | 节拍触发 theta/phi/radius/roll 四向脉冲，带阻尼 | 节拍 map + 音频 | beatMap、analyser | **可搬** |
| 指针 orbit（无滑块） | 半径 2.4–14，默认 6.6；FOV 45 | 拖拽绕主体旋转，滚轮推拉，双击复位 | 指针锁定 + 四元数 | — | **可搬** |
| 预设基线机位 | 每个预设一套 theta/phi/radius | 切预设时镜头换位（不闪黑，靠贴图预载） | 纯数据 | — | **可搬** |
| 切歌转场 | — | `scatter` 冲高 + `pointScale` 波动 + 贴图淡入，无黑场 | uniforms 时序 | — | **需重写**（逻辑简单） |
| 手势 / 摄像头交互 `t-gestureHandOverlay`、`t-gesturePlayerActions`、`#cam-seg` | 三态 | 手势控制机位/播放动作 | 摄像头手势识别 | 第三方手势库 | **不可搬**（与立体感无关） |

---

## 3. 表 C｜音域地形 Sonic-Topography（真正的地面/纵深）

文件：`public/sonic-topography-preset.js`（自包含 IIFE，暴露 `MineradioSonicTopography`）

| 控制项 | 范围 / 默认 | 实际效果 | 实现技术 | 依赖 | 移植结论 |
|---|---|---|---|---|---|
| 地面起伏 `fx-sonicamp` | 0–100，默认 50 | 地形振幅 | three.js PlaneGeometry + 顶点 shader | THREE、fx | **可整段搬** |
| 起伏速度 `fx-sonicspeed` | 0–100，默认 50 | 波浪速度 | shader time | — | 可整段搬 |
| 地形密度 `fx-sonicdensity` | 0–100，默认 46 | 网格 96²–224²（画质档位再封顶） | geometry 重建 | — | 可整段搬 |
| 地面范围 `fx-sonicrange` | 0–100，默认 82 | 地形尺寸（基础 168 单位） | uniform | — | 可整段搬 |
| 歌词避让 `fx-soniclower` | 0–100，默认 68 | 地面下沉/让出歌词区 | uniform | — | 可整段搬 |
| 地面远近 `fx-sonicdepth` | 0–100，默认 62 | 地面 Z 位移 | uniform | — | 可整段搬 |
| 地形自转 `fx-sonicautorotate` | 0–100，默认 50 | 缓慢自转 | 相机/网格旋转 | — | 可整段搬 |
| 音域光强 `fx-sonicglow` | 0–100，默认 20 | 地表发光 | fragment shader | — | 可整段搬 |
| 8 段频谱权重：`fx-sonicsubbass/bass/lowmid/mid/highmid/presence/brilliance/air` | 0–100；默认 90/92/50/50/50/25/50/48 | 各频段驱动地形不同区域/尖峰/闪光 | analyser 分频 | 音频频段 | 可整段搬 |
| 4 色：`sonic-ground-base/cool/warm/accent-picker` + `sonicGroundColorMode` | 默认 cover / #05070c / #0066ff / #ff3c19 / #33e6ff | 地面配色 | uniform | 封面取色 | 可整段搬 |
| Kick 监测：`t-sonicAudioMonitorEnabled`、`t-sonicAudioAutoTrack`、`fx-sonicaudiosensitivity 0–100/100`、`bandstart 0–510/1`、`bandend 2–512/4`、`threshold 0–100/32`、`pulse 0–100/62` | — | 低频触发地脉冲/波纹 | FFT + 阈值 | — | 可整段搬 |
| 浮空方块：`t-sonicGroundFloatingEnabled`、`count 0–100/80`、`intensity 0–100/36`、`min 0–100/9`、`max 0–100/12`、`speed 0–100/59` | — | 空间中漂浮的方块群（额外景深） | InstancedMesh / 独立 Mesh | — | 可整段搬 |
| 流星/波纹 | 无 UI，跟音频触发 | 高频流星坠落 + 地面涟漪 | shader + 粒子 | — | 可整段搬 |

---

## 4. 表 D｜音域回响·WE（Wallpaper Engine 项目）

| 控制项 | 范围 / 默认 | 效果 | 技术 | 依赖 | 移植结论 |
|---|---|---|---|---|---|
| 主题 `sonicWorkshopTheme` | 10 套，默认 minimal-monochrome | 柱阵配色 | 独立 WebGL 构建 | vendor 资源 | **不可搬**（整包 iframe 才能用） |
| 5 组颜色（cover/base/warm/cool/ripple/peak） | 默认 cover | 柱阵/地面/涟漪/高光配色 | iframe + postMessage | 桥协议 | 不可搬 |
| 输入压制 `fx-sonicwegain` | 40–100，默认 82 | 音频增益 | 桥消息 | — | 不可搬 |
| 音频响应 `fx-sonicweaudio` | 0.3–2.5，默认 1.15 | 柱阵起伏幅度 | 同上 | — | 不可搬 |
| 响应范围 `fx-sonicwerange` | 0.3–2，默认 1.30 | 参与频段宽度 | 同上 | — | 不可搬 |
| 中心高光 `fx-sonicwepeak` | 0–1.4，默认 0.62 | 中心峰值高光 | 同上 | — | 不可搬 |

> 项目本体：`vendor/sonic-workshop`（2.1MB，React 19 + R3F + GLSL，160×160 柱阵、FFT、涟漪、流星、WE Media Integration）。要用只能整体 iframe 嵌入 + 桥接，不建议第一版做。

---

## 5. 表 E｜歌词 3D（与"立体感"相关的部分）

| 组 | 控制项（全部） | 范围 / 默认 | 技术 / 依赖 | 移植结论 |
|---|---|---|---|---|
| 布局（3D 定位） | `fx-lyricscale` 0.35–1.65/1.0、`fx-lyricx` -4~4/0、`fx-lyricy` -2.4~2.7/0、`fx-lyricz` -3.2~3.2/0、`fx-lyrictiltx` -84~84/0、`fx-lyrictilty` -84~84/0 | 歌词平面在 3D 空间中的位置/景深/俯仰 | `THREE.PlaneGeometry` + ShaderMaterial | **需重写**（几何/位置逻辑可搬） |
| 故障效果 | `intensity 0–1.5/1.0`、`slice 0–1.4/0.72`、`chroma 0–1.6/0.86`、`rate 0.45–2.2/1.0`、`jitter 0–1.8/0.72`、`t-lyricGlitchCameraBind` 默认开 | RGB 色散切片抖动，绑定相机 | fragment shader | 需重写 |
| 溢光 | `fx-lyricglow 0–0.85/0.28`、`t-lyricGlow` 开、`t-lyricGlowBeat` 开、`t-lyricGlowParticles` 关、`lyric-glow-color` | 发光平面 + 节拍溢光 + 粒子 | 额外 glow plane（CanvasTexture + additive） | 可搬（贴图生成是 2D canvas） |
| 排版 | `fx-lyricspacing -0.04~0.18/0`、`fx-lyriclineheight 0.72–1.80/1.0`、`fx-lyricweight 500–900/750`、`fx-lyriccustomlines 1–10/10`、`fx-lyriccontextopacity 0.25–1/0.54`、`fx-lyriccontextspread`、`fx-lyrictranslationgap/scale/opacity`、`fx-lyricedgefade 0–1/0.32`、`fx-lyricmotionsoftness 0.15–1.2/0.72` | 行距/字距/字重/上下句/译文 | 文字 → CanvasTexture（高清晰度开关） | 需重写 |
| 颜色 | `lyric-color-picker`、`lyric-highlight-picker`、`lyric-glow-picker` + 3 个模式下拉 | 逐字高亮/溢光色 | uniform | 可搬 |
| 开关 | `t-lyricCameraLock`、`t-lyricPauseHold`、`t-lyricVerticalFloat`、`t-lyricBackdropAdapt`、`t-coverBackdropAdapt`、`t-lyricLiveViewportFit`、`t-lyricContextHighQuality` | 镜头绑定/暂停保持/浮动/背景适配 | 逻辑 | 需重写 |

---

## 6. 表 F｜3D 歌单架

| 组 | 控制项 | 范围 / 默认 | 技术 / 依赖 | 移植结论 |
|---|---|---|---|---|
| 架体 | `fx-shelfsize 0.65–1.45/0.92`、`fx-shelfx ±1.2/0`、`fx-shelfy ±0.9/0`、`fx-shelfz ±0.9/0`、`fx-shelfangle ±30/-11`、`fx-shelfopacity 0.25–1/1`、`fx-shelfbgalpha 0.25–0.98` | 歌单架整体在 3D 里的位姿/透明度 | `PlaneGeometry` 卡片 + `CanvasTexture` | 需重写（数据换成 ZDMusic 歌单） |
| 详情页 | `fx-shelfdetailx ±4.8`、`y ±3.6`、`z ±3.6`、`scale 0.72–1.35/1.35`、`anglex ±24`、`angley ±28/-13`、`rowgap 0.72–1.32/1` | 详情面板位姿 | 同上 | 需重写 |
| 动画 | 展开/关闭/行入场秒数、展开位移、悬浮视差、唤出秒数/收起秒数/位移/错层/缩放/视差、镜头进出速度 0.2–1.5/0.24 | 展开与镜头进出 | 缓动 + camera | 可搬（数学） |
| 显示/内容 | `t-shelfShowPodcasts`、`t-shelfMergeCollections`、`shelf-seg` 三态（镜头模式） | 播客卡片/合集合并/镜头模式 | 数据层 | 需重写 |

---

## 7. 表 G｜背景 / 界面 / 桌面

| 项 | 范围 / 默认 | 技术 | 移植结论 |
|---|---|---|---|
| 背景媒体（上传/裁切/缩放/透明度/专辑封面作背景）`fx-bgopacity`、`fx-bgcropx/y`、`fx-bgzoom`、`backgroundAlbumCover` | 默认无媒体 | DOM + canvas 裁切 | 可搬 |
| 窗口背景/玻璃 `fx-windowbgopacity`、`fx-bgglassopacity`、`fx-glassaberration`、`playlistblur 14`、`playlistdensity 0.55`、`playlistopen 0.72`、`playlistclose 0.48` | — | CSS backdrop-filter | 可搬 |
| UI/图标/首页强调色 `ui-accent-picker`、`home-accent-picker`、`home-icon-picker`、`visual-icon-picker`、`visual-tint-picker` | 默认 #ffffff / #9db8cf | CSS 变量 | 可搬 |
| 桌面歌词（独立窗口）`fx-desktoplyricssize/opacity/y` + 5 开关 | 默认关 | Tauri/Windows 独立窗口 | **不可搬**（平台相关） |
| 壁纸模式 `fx-wallpaperopacity`、`wallpaperMode`、`wallpaperFps 60` | 默认关 | Windows 桌面层 | **不可搬** |

---

## 8. 表 H｜预设 / 性能 / 缓存

| 项 | 内容 | 移植结论 |
|---|---|---|
| 视觉预设 | 13 套 + 每日/精选排序（`presetDisplayOrder`） | 可搬（数据） |
| 用户存档 | localStorage `mineradio-user-fx-archives-v1`，支持导入/导出/分享码（gzip "MR2" 协议） | 可搬（我们改存 `~/.zdmusic`） |
| 画质档位 | eco / balanced / high / ultra → 地形网格封顶 112/160/192/224；DPR 上限 1.35；像素预算 5.2M | 可搬 |
| 前台帧率上限 | vsync / 45 / 60 / 75 / 90 / 120 + 自适应降档 | 可搬 |
| 后台/直播 | 后台暂停、保持背景、直播输出接口 | 部分可搬（Tauri 场景简化） |
| 内存压缩 | 定时 trim、阈值、后台 trim、系统级提权 | 可搬（只留定时 trim） |
| 本地缓存 | 封面/深度图缓存 | 可搬 |

---

## 9. 移植结论汇总

**可整段搬（纯计算/独立模块）**
- `sonic-topography-preset.js`（音域地形，自包含 IIFE）
- 封面取色 / 启发式深度 / Sobel 边缘（canvas 2D）
- 相机数学（orbit、节拍脉冲、焦点、缓动）
- 粒子 shader 里的 13 套预设位移公式
- 性能档位、缓存、预设数据

**需重写（依赖全局脚本与 `#id` DOM）**
- 主视觉模块 `00-pointer-cover-particles.js`（全局 `particles/scene/camera/uniforms`、DOM 命中判断）
- 歌词 3D 渲染管线（数据结构要对 ZDMusic 歌词）
- 3D 歌单架（数据源换成我们的歌单/队列）
- 面板 UI 与 fx 状态（React 化，接我们的设置抽屉）

**不可搬**
- 音域回响 WE（iframe + WE Media Integration + 2.1MB 独立构建）
- AI 深度（CDN 模型，Tauri 离线不可用）
- 浮空粒子层（源码已禁用）
- 桌面歌词 / 壁纸模式（平台层）
- 手势摄像头交互

---

## 10. 下一步实现方案（等确认后执行）

**第一批（立体空间感优先，预计一个组件内完成）**
1. 引入 `three`（r1xx）替换当前 CSS 场景：透视相机 FOV 45、轨道半径 6.6、封面平面 4.8 单位。
2. 封面 → 183² 点云 + 顶点 shader（亮度深度 + 边缘 + 波纹 ×3 + 音频位移），`depth` 默认调到 0.9（不是 0.2），并保留滑块。
3. 背景星河 + 溢光层（共享几何的第二遍绘制），相机 orbit + 电影漂移 + 节拍脉冲。
4. 移植 4 套最"立体"的预设：源码 0（封面粒子）、2（星球）、9（月蚀圣环）、12（深海绽放）。
5. 控制台：主控 11 项 + 3 个开关做成我们的设置面板一组（实时生效、有默认值、接真实曲目/封面/analyser）。
6. 保障：暂停冻结（渲染循环停 + 时间冻结）、`prefers-reduced-motion` 回落静态渐变、切歌贴图预载不闪黑、30fps 低频变量节流、WebGL 创建失败/低端机回退到上一轮 A/B/C 的 CSS 基座。

**第二批（空间纵深）**
- 音域地形整段移植（含 8 段频谱、浮空方块、流星）+ 对应控制台。

**第三批（可选）**
- 3D 歌单架、歌词 3D、WE 整包（按确认结果）。
