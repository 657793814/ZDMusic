"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { useLibrary, usePlayback, useQueue } from "@/app/context/player";
import { Sheet, Slider } from "@/app/components/ui";
import {
  ACCENTS,
  loadUiPrefs,
  saveUiPrefs,
  type AccentId,
  type DensityId,
  type UiPrefs,
} from "@/app/lib/ui-prefs";
import { useEffect, useMemo, useState } from "react";

type Config = {
  music_dir?: string | null;
  env_vars?: Record<string, string> | null;
};

const AI_KEYS = [
  { key: "ANTHROPIC_API_KEY", label: "API Key", type: "password" },
  { key: "ANTHROPIC_BASE_URL", label: "Base URL", type: "text" },
  { key: "ANTHROPIC_MODEL", label: "模型", type: "text" },
] as const;

const INTEGRATION_KEYS = [
  { key: "BILIBILI_COOKIE_SESSDATA", label: "B 站 SESSDATA", type: "password" },
  { key: "BILIBILI_COOKIE_BUVID3", label: "B 站 buvid3", type: "text" },
  { key: "ACRCLOUD_ACCESS_KEY", label: "ACRCloud Access Key", type: "password" },
  { key: "ACRCLOUD_ACCESS_SECRET", label: "ACRCloud Secret", type: "password" },
] as const;

const RATES = [0.75, 1, 1.25, 1.5];

export function SettingsDrawer() {
  const { active, close, open: openOverlay } = useOverlay();
  const { tracks, loading, scan } = useLibrary();
  const { playMode, cyclePlayMode } = useQueue();
  const {
    volume,
    muted,
    fadeIn,
    fadeOut,
    rate,
    setVolume,
    setFadeIn,
    setFadeOut,
    setRate,
    toggleMute,
  } = usePlayback();

  const open = active === "settings";

  const [musicDir, setMusicDir] = useState("");
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<UiPrefs>(loadUiPrefs);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    setError(null);
    setLoaded(false);
    fetch("/api/config", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: Config) => {
        setMusicDir(data.music_dir ?? "");
        setEnvVars(data.env_vars ?? {});
        setLoaded(true);
      })
      .catch(() => setError("读取配置失败"));
  }, [open]);

  const updatePrefs = (patch: Partial<UiPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      saveUiPrefs(next);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries({ ...envVars })) {
        const trimmed = (value ?? "").trim();
        if (trimmed) env[key] = trimmed;
      }

      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          music_dir: musicDir.trim() || null,
          env_vars: Object.keys(env).length ? env : null,
        }),
      });
      if (!res.ok) throw new Error(`保存失败（${res.status}）`);

      await fetch("/api/config/reload", { method: "POST" }).catch(() => null);
      setMessage("已保存。AI / 曲库目录变更需重启应用生效。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const envField = useMemo(
    () =>
      [...AI_KEYS, ...INTEGRATION_KEYS].map((field) => (
        <label key={field.key} className="zd-settings-field">
          <span className="zd-settings-label">{field.label}</span>
          <input
            className="zd-settings-input"
            type={field.type}
            value={envVars[field.key] ?? ""}
            placeholder={field.key}
            onChange={(event) =>
              setEnvVars((current) => ({ ...current, [field.key]: event.target.value }))
            }
            spellCheck={false}
          />
        </label>
      )),
    [envVars]
  );

  return (
    <Sheet open={open} onClose={close} side="right" label="设置">
      <header className="zd-settings-head">
        <div>
          <span className="zd-kicker">SETTINGS</span>
          <div className="zd-settings-title">设置</div>
        </div>
        <button type="button" className="zd-chip" onClick={close}>
          关闭
        </button>
      </header>

      <div className="zd-settings-body">
        <section className="zd-settings-group">
          <h3 className="zd-settings-group-title">外观</h3>
          <div className="zd-settings-row">
            <span className="zd-settings-label">强调色</span>
            <div className="zd-settings-chips">
              {(Object.keys(ACCENTS) as AccentId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="zd-chip"
                  data-active={prefs.accent === id ? "true" : "false"}
                  onClick={() => updatePrefs({ accent: id })}
                >
                  <i
                    className="zd-settings-swatch"
                    style={{ background: ACCENTS[id].value }}
                    aria-hidden
                  />
                  {ACCENTS[id].label}
                </button>
              ))}
            </div>
          </div>
          <div className="zd-settings-row">
            <span className="zd-settings-label">密度</span>
            <div className="zd-settings-chips">
              {(
                [
                  ["default", "默认"],
                  ["compact", "紧凑"],
                ] as [DensityId, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="zd-chip"
                  data-active={prefs.density === id ? "true" : "false"}
                  onClick={() => updatePrefs({ density: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="zd-settings-row">
            <span className="zd-settings-label">歌词字号</span>
            <div className="zd-settings-chips">
              {(
                [
                  [0.85, "小"],
                  [1, "中"],
                  [1.15, "大"],
                ] as [number, string][]
              ).map(([scale, label]) => (
                <button
                  key={scale}
                  type="button"
                  className="zd-chip"
                  data-active={prefs.lyricScale === scale ? "true" : "false"}
                  onClick={() => updatePrefs({ lyricScale: scale })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="zd-settings-group">
          <h3 className="zd-settings-group-title">播放</h3>
          <div className="zd-settings-row">
            <span className="zd-settings-label">音量</span>
            <Slider
              label="音量"
              value={muted ? 0 : volume}
              onChange={(value) => {
                if (muted && value > 0) toggleMute();
                setVolume(value);
              }}
            />
            <span className="zd-settings-value">{Math.round((muted ? 0 : volume) * 100)}%</span>
          </div>
          <div className="zd-settings-row">
            <span className="zd-settings-label">淡入</span>
            <Slider label="淡入时长" value={fadeIn} max={2} step={0.1} onChange={setFadeIn} />
            <span className="zd-settings-value">{fadeIn.toFixed(1)}s</span>
          </div>
          <div className="zd-settings-row">
            <span className="zd-settings-label">淡出</span>
            <Slider label="淡出时长" value={fadeOut} max={2} step={0.1} onChange={setFadeOut} />
            <span className="zd-settings-value">{fadeOut.toFixed(1)}s</span>
          </div>
          <div className="zd-settings-row">
            <span className="zd-settings-label">倍速</span>
            <div className="zd-settings-chips">
              {RATES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="zd-chip"
                  data-active={rate === value ? "true" : "false"}
                  onClick={() => setRate(value)}
                >
                  {value}×
                </button>
              ))}
            </div>
          </div>
          <div className="zd-settings-row">
            <span className="zd-settings-label">播放模式</span>
            <div className="zd-settings-chips">
              <button type="button" className="zd-chip" data-active="true" onClick={cyclePlayMode}>
                {playMode === "repeat-one" ? "单曲循环" : playMode === "shuffle" ? "随机播放" : "顺序播放"}
                <span className="zd-settings-chip-hint">点击切换</span>
              </button>
            </div>
          </div>
        </section>

        <section className="zd-settings-group">
          <h3 className="zd-settings-group-title">曲库</h3>
          <label className="zd-settings-field">
            <span className="zd-settings-label">音乐目录</span>
            <input
              className="zd-settings-input"
              type="text"
              value={musicDir}
              placeholder="/Users/you/Documents/bili"
              onChange={(event) => setMusicDir(event.target.value)}
              spellCheck={false}
            />
          </label>
          <div className="zd-settings-row">
            <span className="zd-settings-label">当前曲目</span>
            <span className="zd-settings-value">
              {loading ? "扫描中…" : `${tracks.length} 首`}
            </span>
            <button
              type="button"
              className="zd-chip"
              onClick={() => openOverlay("library")}
            >
              管理曲库
            </button>
            <button
              type="button"
              className="zd-chip"
              onClick={() => void scan()}
              disabled={loading}
            >
              重新扫描
            </button>
          </div>
        </section>

        <section className="zd-settings-group">
          <h3 className="zd-settings-group-title">AI</h3>
          {envField.filter((_, index) => index < AI_KEYS.length)}
        </section>

        <section className="zd-settings-group">
          <h3 className="zd-settings-group-title">集成</h3>
          {envField.filter((_, index) => index >= AI_KEYS.length)}
        </section>

        <section className="zd-settings-group">
          <h3 className="zd-settings-group-title">关于</h3>
          <div className="zd-settings-about">
            <div>ZDMusic · 卓动悦听 0.1.0</div>
            <div>许可：CC-BY-NC-SA-4.0</div>
            <div className="zd-settings-shortcuts">
              <span>Space 播放/暂停</span>
              <span>← / → 上一首 / 下一首</span>
              <span>↑ / ↓ 音量</span>
              <span>M 静音</span>
              <span>Cmd + K 搜索</span>
              <span>Esc 关闭浮层</span>
            </div>
          </div>
        </section>
      </div>

      <footer className="zd-settings-foot">
        {error ? <span className="zd-settings-error">{error}</span> : null}
        {message ? <span className="zd-settings-message">{message}</span> : null}
        <button
          type="button"
          className="zd-chip"
          data-active="true"
          onClick={() => void handleSave()}
          disabled={saving || !loaded}
        >
          {saving ? "保存中…" : "保存配置"}
        </button>
      </footer>
    </Sheet>
  );
}
