# 全屏沉浸效果架构

## 概述

全屏沉浸模式（FullScreenVisualizer）支持多套预设效果，用户可以在播放过程中自由切换。该系统采用预设注册表+渲染器工厂模式，新增效果只需添加一个预设文件并在 `registrations.ts` 中注册。

## 架构

```
FullScreenVisualizer/
├── index.tsx              # 容器组件
│   ├── 管理 canvas 引用
│   ├── 根据当前预设 ID 调用对应的 createRenderer
│   ├── 预设切换 UI（浮动选择面板）
│   ├── 顶部提示栏（ESC 退出 + 关闭按钮）
│   └── localStorage 持久化选中状态
│
└── presets/
    ├── index.ts           # 预设注册入口（所有预设在此 import + register）
    ├── types.ts           # 预设接口定义
    ├── registry.ts        # 注册表（Map: id → {definition, createRenderer}）
    ├── WarpStars.ts       # 预设①：曲速星场（原默认效果）
    └── CosmicWarp.ts      # 预设②：穿梭宇宙（新效果）
```

## 预设接口

每个预设导出 `PresetModule` 对象：

```typescript
interface PresetDefinition {
  id: string;        // 唯一标识，如 "warp-stars"
  name: string;      // 展示名称，如 "曲速星场"
  icon: string;      // emoji 图标
  description: string; // 简短描述
}

type PresetRenderer = (
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode | null,
  playing: boolean
) => () => void;     // 返回 cleanup 函数

interface PresetModule {
  definition: PresetDefinition;
  createRenderer: PresetRenderer;
}
```

### 渲染器约定

- 接收 `canvas` 引用和音频分析数据
- 使用 `requestAnimationFrame` 驱动绘制循环
- 返回 cleanup 函数（取消 raf、移除事件监听）
- 不需要管理 UI 覆盖层（ESC 提示、预设切换等属于容器）
- 每次预设切换或 props 变化时，容器会先调用旧渲染器的 cleanup，再创建新渲染器

## 添加新预设

新预设只需两个步骤：

### 1. 创建预设文件

`presets/YourEffect.ts`:

```typescript
import type { PresetModule } from "./types";

export const preset: PresetModule = {
  definition: {
    id: "your-effect",
    name: "你的效果",
    icon: "🌟",
    description: "效果描述",
  },
  createRenderer(canvas, analyser, playing) {
    // ...绘制逻辑...
    return () => { /* cleanup */ };
  },
};
```

### 2. 在 presets/index.ts 中注册

```typescript
import { preset as yourEffect } from "./YourEffect";
registerPreset(yourEffect.definition.id, yourEffect);
```

## 现有预设

| ID | 名称 | 图标 | 描述 |
|----|------|------|------|
| `warp-stars` | 曲速星场 | ✦ | 穿越星海，曲速引擎 |
| `cosmic-warp` | 穿梭宇宙 | 🌌 | 星际穿梭，迎面而来的星系与行星 |

## 切换 UI

- 全屏模式下，将鼠标移到左上方浮现预设切换按钮
- 按钮显示当前预设的图标和名称
- 悬停后点击展开选择面板
- 选择后即时切换，无中断
- 选中状态持久化到 `localStorage`（key: `aura-fullscreen-preset`）
