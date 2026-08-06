import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * 读取合并后的有效配置。
 *
 * 优先级：用户保存的配置（保存时写入的本地路径 ~/.zdmusic/config.json）最高；
 * 打包/安装时写入的配置（Tauri 中由 Rust 通过 ZD_CONFIG_FILE 注入的
 * ~/.config/com.zdmusic/config.json）仅作为默认值，只补全用户未设置的键。
 */
export function readEffectiveConfig(): {
  music_dir: string | null;
  env_vars: Record<string, string>;
} {
  const userFile = join(homedir(), ".zdmusic", "config.json");
  const appFile = process.env.ZD_CONFIG_FILE || "";

  const envVars: Record<string, string> = {};
  let musicDir: string | null = null;

  // 1. 用户保存的配置（本地路径）—— 优先级最高
  try {
    if (existsSync(userFile)) {
      const parsed = JSON.parse(readFileSync(userFile, "utf-8")) as {
        music_dir?: string;
        env_vars?: Record<string, string>;
      };
      if (parsed.music_dir) musicDir = parsed.music_dir;
      Object.assign(envVars, parsed.env_vars ?? {});
    }
  } catch (e) {
    console.error("[config] Failed to read user config:", e);
  }

  // 2. 打包/安装时写入的配置 —— 仅补全用户未设置的键（fallback）
  if (appFile && appFile !== userFile) {
    try {
      if (existsSync(appFile)) {
        const parsed = JSON.parse(readFileSync(appFile, "utf-8")) as {
          music_dir?: string;
          env_vars?: Record<string, string>;
        };
        if (parsed.music_dir && !musicDir) musicDir = parsed.music_dir;
        for (const [k, v] of Object.entries(parsed.env_vars ?? {})) {
          if (!(k in envVars)) envVars[k] = v;
        }
      }
    } catch (e) {
      console.error("[config] Failed to read app config:", e);
    }
  }

  return { music_dir: musicDir, env_vars: envVars };
}

/** 仅读取合并后的环境变量（保留原 readConfig 的语义供 getConfigVar 使用）。 */
export function readConfig(): Record<string, string> {
  return readEffectiveConfig().env_vars;
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
