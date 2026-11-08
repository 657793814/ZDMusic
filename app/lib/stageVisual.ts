export type StagePreset = "cover" | "planet" | "eclipse" | "abyss";

/** 视觉模式：粒子云（three.js 主场景）或音域回响（独立 WebGL 模块） */
export type StageVisualMode = "particles" | "sonicEcho";

export type StageVisualSettings = {
  preset: StagePreset;
  visualMode: StageVisualMode;
  // 律动 / 位移
  intensity: number;
  sensitivity: number;
  // 形态
  depth: number;
  coverRes: number;
  point: number;
  speed: number;
  twist: number;
  scatter: number;
  // 镜头
  autoOrbit: number;
  cameraRadius: number;
  cameraEpoch: number;
  cinemaShake: number;
  // 辉光 / 色彩 / 背景
  color: number;
  bloom: number;
  bgFade: number;
  // 预设专属
  planetRadius: number;
  planetSpin: number;
  ringRadius: number;
  ringWidth: number;
  petalCount: number;
  petalDepth: number;
  // 开关
  bloomEnabled: boolean;
  edge: boolean;
  starRiver: boolean;
  audioReact: boolean;
};

export type SliderKey =
  | "intensity"
  | "sensitivity"
  | "depth"
  | "coverRes"
  | "point"
  | "speed"
  | "twist"
  | "scatter"
  | "autoOrbit"
  | "cameraRadius"
  | "cinemaShake"
  | "color"
  | "bloom"
  | "bgFade"
  | "planetRadius"
  | "planetSpin"
  | "ringRadius"
  | "ringWidth"
  | "petalCount"
  | "petalDepth";

export type ToggleKey = "bloomEnabled" | "edge" | "starRiver" | "audioReact";

export type SliderGroup = "rhythm" | "shape" | "camera" | "glow";

export const STAGE_DEFAULTS: StageVisualSettings = {
  preset: "cover",
  visualMode: "particles",
  intensity: 0.85,
  sensitivity: 1,
  depth: 0.9,
  coverRes: 1.55,
  point: 1,
  speed: 1,
  twist: 0,
  scatter: 0,
  autoOrbit: 0.16,
  cameraRadius: 6.6,
  cameraEpoch: 0,
  cinemaShake: 0.5,
  color: 1.1,
  bloom: 0.62,
  bgFade: 0.2,
  planetRadius: 2.35,
  planetSpin: 0.28,
  ringRadius: 2.2,
  ringWidth: 0.48,
  petalCount: 6,
  petalDepth: 0.16,
  bloomEnabled: true,
  edge: true,
  starRiver: true,
  audioReact: true,
};

export const STAGE_PRESETS: { id: StagePreset; label: string; note: string }[] = [
  { id: "cover", label: "封面粒子", note: "封面切成点云，按亮度/边缘挤出" },
  { id: "planet", label: "星球", note: "封面包到球面，深浅由亮度决定" },
  { id: "eclipse", label: "月蚀圣环", note: "圆盘主体 + 外圈发光环" },
  { id: "abyss", label: "深海绽放", note: "径向花瓣 + 呼吸起伏" },
];

export const STAGE_VISUAL_MODES: { id: StageVisualMode; label: string; note: string }[] = [
  { id: "particles", label: "粒子云", note: "three.js 主场景，跟随封面与预设" },
  { id: "sonicEcho", label: "音域回响", note: "独立渲染管线，频谱柱阵地形" },
];

export const STAGE_SLIDERS: {
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  group: SliderGroup | "preset";
  driver: string;
}[] = [
  { key: "intensity", label: "律动幅度", min: 0.2, max: 1.6, step: 0.02, group: "rhythm", driver: "音频位移振幅 + 呼吸" },
  { key: "sensitivity", label: "律动灵敏度", min: 0, max: 1.5, step: 0.01, group: "rhythm", driver: "分频能量包络增益；0 = 纯静态" },
  { key: "depth", label: "立体感", min: 0.2, max: 1.8, step: 0.02, group: "shape", driver: "封面点云 Z 轴挤出深度" },
  { key: "coverRes", label: "封面清晰度", min: 0.75, max: 1.55, step: 0.02, group: "shape", driver: "粒子网格密度（89²–183²）" },
  { key: "point", label: "粒子尺寸", min: 0.5, max: 2.2, step: 0.02, group: "shape", driver: "点精灵像素大小" },
  { key: "speed", label: "流速", min: 0.2, max: 2.5, step: 0.02, group: "shape", driver: "位移波/涟漪时间倍率" },
  { key: "twist", label: "扭曲", min: 0, max: 0.6, step: 0.01, group: "shape", driver: "绕中心的涡旋角度" },
  { key: "scatter", label: "离散感", min: 0, max: 0.5, step: 0.01, group: "shape", driver: "点云 XY 抖动" },
  { key: "autoOrbit", label: "自动环绕", min: 0, max: 1.5, step: 0.01, group: "camera", driver: "相机水平自动旋转速度" },
  { key: "cameraRadius", label: "镜头距离", min: 4, max: 9, step: 0.05, group: "camera", driver: "相机轨道半径（滚轮也可临时缩放）" },
  { key: "cinemaShake", label: "镜头晃动", min: 0, max: 1.8, step: 0.02, group: "camera", driver: "电影漂移 + 节拍四向脉冲" },
  { key: "bloom", label: "溢光强度", min: 0, max: 1.6, step: 0.01, group: "glow", driver: "加法溢光层亮度（中频再叠加）" },
  { key: "color", label: "色彩张力", min: 0.5, max: 2, step: 0.01, group: "glow", driver: "封面颜色增益" },
  { key: "bgFade", label: "背景压暗", min: 0, max: 1.2, step: 0.01, group: "glow", driver: "舞台底色暗度" },
  { key: "planetRadius", label: "星球半径", min: 1.8, max: 3.2, step: 0.02, group: "preset", driver: "球面半径" },
  { key: "planetSpin", label: "星球自转", min: 0, max: 1, step: 0.02, group: "preset", driver: "球面经度旋转速度" },
  { key: "ringRadius", label: "圣环半径", min: 1.9, max: 2.8, step: 0.02, group: "preset", driver: "外圈光环半径" },
  { key: "ringWidth", label: "圣环厚度", min: 0.18, max: 0.7, step: 0.01, group: "preset", driver: "外圈光环带宽" },
  { key: "petalCount", label: "花瓣数", min: 4, max: 10, step: 1, group: "preset", driver: "径向花瓣数量" },
  { key: "petalDepth", label: "花瓣起伏", min: 0.2, max: 1, step: 0.01, group: "preset", driver: "花瓣 Z 轴起伏幅度" },
];

export const STAGE_TOGGLES: { key: ToggleKey; label: string; driver: string; group: "glow" | "rhythm" }[] = [
  { key: "audioReact", label: "节奏律动", driver: "关闭后不读频谱，只保留静态运动", group: "rhythm" },
  { key: "bloomEnabled", label: "粒子溢光", driver: "共享几何的第二遍加法绘制", group: "glow" },
  { key: "edge", label: "轮廓高亮", driver: "边缘检测参与 Z 轴挤出", group: "glow" },
  { key: "starRiver", label: "背景星河", driver: "1400 点、多层深度的背景粒子", group: "glow" },
];

/** 预设专属参数：只在对应预设下出现 */
export const PRESET_SLIDERS: Record<StagePreset, SliderKey[]> = {
  cover: [],
  planet: ["planetRadius", "planetSpin"],
  eclipse: ["ringRadius", "ringWidth"],
  abyss: ["petalCount", "petalDepth"],
};

/** 参考工程里确实存在、但本机不可用或尚未接入的能力：UI 如实列出，不做假开关 */
export const STAGE_UNSUPPORTED: {
  label: string;
  reason: string;
  status: "unavailable" | "pending";
}[] = [
  {
    label: "桌面壁纸 / WE Media Integration",
    reason: "macOS 没有 Wallpaper Engine 宿主，壁纸与媒体联动层无法提供",
    status: "unavailable",
  },
  {
    label: "浮空粒子层",
    reason: "参考工程中 createFloatLayer 已直接返回，属于死代码",
    status: "unavailable",
  },
  {
    label: "手势 / 摄像头驱动",
    reason: "macOS 桌面端没有摄像头权限链路，未移植",
    status: "unavailable",
  },
  {
    label: "AI 深度（高精度模型）",
    reason: "q4f16 模型与 WebGPU 路径待打包环境验证；通过后接入，不通过则保留启发式深度",
    status: "pending",
  },
];

const STORAGE_KEY = "zdmusic.stage_visual.v1";

export function loadStageSettings(): StageVisualSettings {
  if (typeof window === "undefined") return STAGE_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return STAGE_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<StageVisualSettings>;
    return { ...STAGE_DEFAULTS, ...parsed };
  } catch {
    return STAGE_DEFAULTS;
  }
}

export function saveStageSettings(settings: StageVisualSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 本地存储不可用时保持内存态
  }
}

/** 0.75–1.55 → 89²–183²，且强制奇数网格（中心点对齐） */
export function gridForResolution(resolution: number): number {
  const raw = Math.round(118 * resolution);
  return Math.max(61, Math.min(183, raw | 1));
}
