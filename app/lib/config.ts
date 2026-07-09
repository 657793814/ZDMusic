import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * Reads the shared app config file (written by the Settings UI).
 * Tauri 模式：路径由 Rust 通过 ZD_CONFIG_FILE 环境变量注入
 * Web 模式：fallback 到 ~/.zdmusic/config.json
 */
export function readConfig(): Record<string, string> {
  const configFile = process.env.ZD_CONFIG_FILE || join(homedir(), ".zdmusic", "config.json");
  try {
    if (existsSync(configFile)) {
      const raw = readFileSync(configFile, "utf-8");
      const parsed = JSON.parse(raw);
      return parsed.env_vars ?? {};
    }
  } catch (e) {
    console.error("[config] Failed to read config file:", e);
  }
  return {};
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
