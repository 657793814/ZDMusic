import { existsSync, readFileSync } from "fs";

/**
 * Reads the shared app config file (written by the Settings UI).
 * The config file path is passed as ZD_CONFIG_FILE env var from Rust.
 */
export function readConfig(): Record<string, string> {
  const configFile = process.env.ZD_CONFIG_FILE;
  if (!configFile) return {};
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
