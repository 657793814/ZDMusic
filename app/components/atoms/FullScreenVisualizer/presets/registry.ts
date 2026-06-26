import type { PresetDefinition, PresetModule, PresetRenderer } from "./types";

// ============================================================
// 注册表：所有预设在此注册
// ============================================================

interface RegistryEntry {
  definition: PresetDefinition;
  createRenderer: PresetRenderer;
}

const registry = new Map<string, RegistryEntry>();

/** 注册一个预设 */
export function registerPreset(id: string, module: PresetModule) {
  registry.set(id, {
    definition: module.definition,
    createRenderer: module.createRenderer,
  });
}

/** 获取预设定义列表（用于 UI 展示） */
export function getPresetDefinitions(): PresetDefinition[] {
  return Array.from(registry.values()).map((e) => e.definition);
}

/** 获取预设定义（按 ID） */
export function getPresetDefinition(id: string): PresetDefinition | undefined {
  return registry.get(id)?.definition;
}

/** 获取预设渲染器工厂 */
export function getPresetRenderer(id: string): PresetRenderer | undefined {
  return registry.get(id)?.createRenderer;
}

/** 获取所有预设 ID 列表 */
export function getPresetIds(): string[] {
  return Array.from(registry.keys());
}

/** 第一个注册的预设 ID（默认） */
export function getDefaultPresetId(): string {
  const ids = getPresetIds();
  return ids[0] ?? "";
}
