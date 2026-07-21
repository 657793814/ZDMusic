import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * Reads the shared app config file (written by the Settings UI).
 * Tauri 模式：路径由 Rust 通过 ZD_CONFIG_FILE 环境变量注入
 * Web 模式：fallback 到 ~/.zdmusic/config.json
 *
 * 合并读取：先读 ZD_CONFIG_FILE 指向的文件，再读 ~/.zdmusic/config.json 作为 fallback，
 * 后者配置优先级更高（保障用户在任一界面保存的密钥都生效）。
 */
export function readConfig(): Record<string, string> {
  const result: Record<string, string> = {};

  const primaryFile = process.env.ZD_CONFIG_FILE || join(homedir(), ".zdmusic", "config.json");
  const fallbackFile = join(homedir(), ".zdmusic", "config.json");

  // 先读主文件
  try {
    if (existsSync(primaryFile)) {
      const raw = readFileSync(primaryFile, "utf-8");
      const parsed = JSON.parse(raw);
      Object.assign(result, parsed.env_vars ?? {});
    }
  } catch (e) {
    console.error("[config] Failed to read primary config:", e);
  }

  // 再读 fallback（如果跟主文件是同一个文件就跳过）
  if (primaryFile !== fallbackFile) {
    try {
      if (existsSync(fallbackFile)) {
        const raw = readFileSync(fallbackFile, "utf-8");
        const parsed = JSON.parse(raw);
        Object.assign(result, parsed.env_vars ?? {});
      }
    } catch (e) {
      console.error("[config] Failed to read fallback config:", e);
    }
  }

  return result;
}

// Cache, cleared via clearConfigCache()
let _cachedConfig: Record<string, string> | null = null;

/** Get a config var, re-reading from file if needed. */
export function getConfigVar(key: string, fallback = ""): string {
  if (_cachedConfig === null) {
    _cachedConfig = readConfig();
  }
  return _cachedConfig[key] || fallback;
}

/** Clear the config cache so next call re-reads from disk. */
export function clearConfigCache(): void {
  _cachedConfig = null;
}
