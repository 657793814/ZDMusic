"use client";

import { Label } from "@/app/components/atoms/Label";
import type { Track } from "@/app/lib/types";
import { usePlayer } from "@/app/context/PlayerContext";
import { useI18n } from "@/app/lib/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function Playlist() {
  const { state, playTrack, removeTrack } = usePlayer();
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const [localTracks, setLocalTracks] = useState<Track[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetching = useRef(false);

  const load = useCallback(() => {
    if (fetching.current) return;
    fetching.current = true;
    setRefreshing(true);
    fetch("/api/tracks/scan?t=" + Date.now(), { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ tracks?: Track[] }>;
      })
      .then((d) => {
        if (d.tracks?.length) {
          setLocalTracks(d.tracks);
        } else {
          setLocalTracks([]);
        }
      })
      .catch(() => {
        setLocalTracks([]);
      })
      .finally(() => {
        fetching.current = false;
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!localTracks && state.playlist.length > 0) {
      setLocalTracks(state.playlist);
    }
  }, [localTracks, state.playlist]);

  const allTracks = useMemo(() => {
    if (localTracks === null && state.playlist.length > 0) return state.playlist;
    if (localTracks === null) return [];
    if (!localTracks.length) return state.playlist;
    const ids = new Set(localTracks.map((tk) => tk.id));
    const extras = state.playlist.filter((t) => !ids.has(t.id));
    return extras.length ? [...localTracks, ...extras] : localTracks;
  }, [localTracks, state.playlist]);

  const q = filter.trim().toLowerCase();
  const rows = useMemo(
    () =>
      q
        ? allTracks.filter(
            (t) =>
              t.title?.toLowerCase().includes(q) ||
              t.author?.toLowerCase().includes(q)
          )
        : allTracks,
    [allTracks, q]
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "var(--color-surface-dim)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
      }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2"
        style={{
          borderColor: "var(--color-outline-dim)",
          backgroundColor: "color-mix(in srgb, var(--color-surface-raised) 60%, transparent)",
        }}
      >
        <div className="flex items-baseline gap-2">
          <Label size="md">{t("activeQueue")}</Label>
          <span
            className="max-w-[240px] shrink-0 truncate text-[11px] opacity-55"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {state.current
              ? state.current.title
              : `${allTracks.length} ${t("trackCount")}`}
          </span>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={refreshing}
          className="flex h-6 w-6 items-center justify-center rounded-full border transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] disabled:opacity-40"
          style={{
            borderColor: "var(--color-outline-dim)",
            color: refreshing ? "var(--color-primary)" : "var(--color-outline)",
          }}
          aria-label={t("refresh")}
          title={t("refreshTitle")}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={refreshing ? "animate-spin" : ""}
          >
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* Filter */}
      <div className="shrink-0 px-3 py-2">
        <input
          type="search"
          placeholder={t("filter")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-full border px-3 py-1.5 text-[13px] outline-none transition-colors focus:ring-1 focus:ring-[color:var(--color-primary)]"
          style={{
            fontFamily: "var(--font-body)",
            borderColor: "var(--color-outline-dim)",
            backgroundColor: "var(--color-surface-raised)",
            color: "var(--color-on-surface)",
          }}
        />
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ minHeight: 0 }}>
        {allTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-6">
            <p
              className="text-center text-xs font-medium tracking-[var(--tracking-label)] opacity-50"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {localTracks === null && state.playlist.length === 0
                ? t("loading")
                : t("queueEmpty")}
            </p>
            <button
              type="button"
              onClick={load}
              className="rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[var(--tracking-label)] transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
              style={{
                borderColor: "var(--color-outline-dim)",
                color: "var(--color-outline)",
                fontFamily: "var(--font-body)",
              }}
            >
              {t("scanLocal")}
            </button>
          </div>
        ) : (
          rows.map((tr, i) => {
            const active = state.current?.id === tr.id;
            return (
              <div
                key={tr.id}
                role="button"
                tabIndex={0}
                onClick={() => playTrack(tr)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    playTrack(tr);
                  }
                }}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{
                  borderBottom: "1px solid var(--color-outline-dim)",
                  backgroundColor: active
                    ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                    : "transparent",
                  fontFamily: "var(--font-body)",
                  color: "var(--color-on-surface)",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-primary) 4%, transparent)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  className="w-7 shrink-0 text-center text-[12px] tabular-nums"
                  style={{
                    color: active ? "var(--color-primary)" : "var(--color-outline)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]" style={{ fontWeight: active ? 500 : 400 }}>
                  {tr.title}
                </span>
                <span
                  className="w-12 shrink-0 text-right text-[11px] tabular-nums"
                  style={{ color: "var(--color-outline)" }}
                >
                  {tr.size ? Math.round(tr.size / 16000 / 60) + "m" : "—"}
                </span>
                <button
                  type="button"
                  aria-label={t("remove")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingId(tr.id);
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors hover:border-[color:var(--color-error)] hover:text-[color:var(--color-error)]"
                  style={{
                    borderColor: "var(--color-outline-dim)",
                    color: "var(--color-outline)",
                    opacity: active ? 0.8 : 0.35,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = active ? "0.8" : "0.35";
                  }}
                >
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 删除确认弹窗 */}
      {confirmingId && (() => {
        const track = allTracks.find((t) => t.id === confirmingId);
        if (!track) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            onClick={() => setConfirmingId(null)}
          >
            <div
              className="mx-4 w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
              style={{
                backgroundColor: "var(--color-surface-dim)",
                borderColor: "var(--color-outline-dim)",
                fontFamily: "var(--font-body)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-1 text-[11px] font-semibold tracking-[var(--tracking-label)] uppercase opacity-50">
                {t("remove")}
              </p>
              <p className="mb-5 text-[14px] leading-snug" style={{ color: "var(--color-on-surface)" }}>
                确认删除 <span className="font-semibold">"{track.title}"</span>？
                <br />
                <span className="text-[12px] opacity-50">本地文件也将被永久删除</span>
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  className="rounded-full border px-4 py-1.5 text-[12px] transition-colors hover:opacity-80"
                  style={{
                    borderColor: "var(--color-outline-dim)",
                    color: "var(--color-outline)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmingId(null);
                    await fetch(track.url, { method: "DELETE" });
                    removeTrack(track.id);
                    // 乐观更新 localTracks，立即从 UI 移除，不等 load() 回来
                    setLocalTracks((prev) =>
                      prev ? prev.filter((t) => t.id !== track.id) : prev
                    );
                    load();
                  }}
                  className="rounded-full px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: "var(--color-error, #ef4444)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
