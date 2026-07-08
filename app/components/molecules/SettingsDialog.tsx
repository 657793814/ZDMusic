"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

type EnvField = {
  key: string;
  label: string;
  placeholder: string;
  hint: string;
  password?: boolean;
};

const ENV_FIELDS: EnvField[] = [
  {
    key: "ANTHROPIC_API_KEY",
    label: "AI API Key",
    placeholder: "***",
    hint: "用于 AI 搜索对话和处理功能",
    password: true,
  },
  {
    key: "ANTHROPIC_BASE_URL",
    label: "AI API Base URL",
    placeholder: "https://apihub.agnes-ai.com/v1",
    hint: "留空则使用默认地址",
  },
  {
    key: "ANTHROPIC_MODEL",
    label: "AI 模型",
    placeholder: "agnes-2.0-flash",
    hint: "留空则使用默认模型",
  },
  {
    key: "BILIBILI_COOKIE_SESSDATA",
    label: "B站 Cookie SESSDATA",
    placeholder: "xxxxxxxx",
    hint: "可选，登录后从 Cookie 中获取，可提升 API 稳定性",
    password: true,
  },
  {
    key: "BILIBILI_COOKIE_BUVID3",
    label: "B站 Cookie buvid3",
    placeholder: "xxxxxxxx",
    hint: "可选，不填则自动获取",
    password: true,
  },
];

export function SettingsDialog({ open, onClose }: Props) {
  const [musicDir, setMusicDir] = useState<string>("");
  const [envVals, setEnvVals] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);

  // Load config via Next.js API (no Tauri ACL involved)
  const loadConfig = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error(await res.text());
      const config = await res.json();
      setMusicDir(config.music_dir ?? "");
      setEnvVals(config.env_vars ?? {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`读取配置失败: ${msg}`);
    }
  }, []);

  // Save config via Next.js API
  const saveConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const env_vars: Record<string, string> = {};
      for (const [k, v] of Object.entries(envVals)) {
        if (v) env_vars[k] = v;
      }
      const config = {
        music_dir: musicDir || null,
        env_vars: Object.keys(env_vars).length > 0 ? env_vars : null,
      };
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`保存配置失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [musicDir, envVals]);

  // Save config and reload runtime caches (API key takes effect without restart)
  const saveAndReload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Save config
      const env_vars: Record<string, string> = {};
      for (const [k, v] of Object.entries(envVals)) {
        if (v) env_vars[k] = v;
      }
      const config = {
        music_dir: musicDir || null,
        env_vars: Object.keys(env_vars).length > 0 ? env_vars : null,
      };
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(await res.text());

      // Reload config caches on the Next.js server (chat route picks up new API key)
      setReloading(true);
      const reloadRes = await fetch("/api/config/reload", { method: "POST" });
      if (!reloadRes.ok) throw new Error("reload failed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`保存配置失败: ${msg}`);
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, [musicDir, envVals]);

  // Load on open
  useEffect(() => {
    if (!open) return;
    setError(null);
    loadConfig();
  }, [open, loadConfig]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pt-12 pb-12"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          backgroundColor: "var(--color-surface-raised)",
          border: "1px solid var(--color-outline-dim)",
        }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2
            className="text-lg font-semibold tracking-wide"
            style={{ fontFamily: "var(--font-display)" }}
          >
            ⚙ 设置
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="space-y-6">
          {/* === 音乐目录 === */}
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--color-outline)", fontFamily: "var(--font-body)" }}
            >
              📂 音乐目录
            </label>
            <input
              type="text"
              placeholder="/Users/xxx/Music"
              value={musicDir}
              onChange={(e) => setMusicDir(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--color-surface-dim)",
                color: "var(--color-on-surface)",
                border: "1px solid var(--color-outline-dim)",
                fontFamily: "var(--font-mono)",
              }}
            />
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--color-outline)" }}>
              输入音乐文件夹的完整路径。
            </p>
          </div>

          {/* === 环境变量配置 === */}
          <div>
            <h3
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--color-outline)", fontFamily: "var(--font-body)" }}
            >
              🔑 环境变量配置
            </h3>
            <p
              className="mb-3 text-[11px]"
              style={{ color: "var(--color-outline)", fontFamily: "var(--font-body)" }}
            >
              所有配置仅保存在本地。保存后会自动刷新运行时缓存，API Key 立即生效。
            </p>
            <div className="space-y-4">
              {ENV_FIELDS.map((field) => (
                <div key={field.key}>
                  <label
                    className="mb-1 block text-[13px] font-medium"
                    style={{ color: "var(--color-on-surface)", fontFamily: "var(--font-body)" }}
                  >
                    {field.label}
                  </label>
                  <input
                    type={field.password ? "password" : "***"}
                    placeholder={field.placeholder}
                    value={envVals[field.key] ?? ""}
                    onChange={(e) =>
                      setEnvVals((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{
                      backgroundColor: "var(--color-surface-dim)",
                      color: "var(--color-on-surface)",
                      border: "1px solid var(--color-outline-dim)",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                  <p className="mt-1 text-[11px]" style={{ color: "var(--color-outline)" }}>
                    {field.hint}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={saveConfig}
              disabled={loading}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "#fff",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "保存中..." : "💾 保存配置"}
            </button>
            <button
              type="button"
              onClick={saveAndReload}
              disabled={loading || reloading}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-primary) 70%, black)",
                color: "#fff",
                opacity: loading || reloading ? 0.6 : 1,
              }}
            >
              {reloading ? "刷新中..." : "🔄 保存并刷新"}
            </button>
          </div>

          {error && (
            <p
              className="rounded-xl px-3 py-2 text-[12px]"
              style={{
                color: "var(--color-error, #f87171)",
                backgroundColor: "color-mix(in srgb, var(--color-error, #f87171) 10%, transparent)",
              }}
            >
              ⚠️ {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
