/** 单个预设的定义元信息 */
export interface PresetDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
}

/**
 * 预设渲染器工厂函数。
 * 接收 canvas 和音频分析数据，返回 cleanup 函数。
 * Container 会在预设切换或组件卸载时调用 cleanup。
 */
export type PresetRenderer = (
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode | null,
  playing: boolean
) => () => void;

/** 一个完整的预设模块 */
export interface PresetModule {
  definition: PresetDefinition;
  createRenderer: PresetRenderer;
}
