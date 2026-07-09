"use client";

import { Label } from "@/app/components/atoms/Label";
import type { Track, Playlist as PlaylistType } from "@/app/lib/types";
import { usePlayer } from "@/app/context/PlayerContext";
import { useI18n } from "@/app/lib/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ViewMode = "all" | "playlists";

export function Playlist() {
  const { state, playTrack, removeTrack } = usePlayer();
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState("");
  const [localTracks, setLocalTracks] = useState<Track[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetching = useRef(false);

  // Playlist/Collection state
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [playlists, setPlaylists] = useState<PlaylistType[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState<string | null>(null); // trackId being added
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Show toast message
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2000);
  }, []);

  // Load playlists from API
  const loadPlaylists = useCallback(() => {
    fetch("/api/playlists", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.playlists) setPlaylists(data.playlists);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  // Load tracks
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

  // All tracks: local + extras from player context
  const allTracks = useMemo(() => {
    if (localTracks === null && state.playlist.length > 0) return state.playlist;
    if (localTracks === null) return [];
    if (!localTracks.length) return state.playlist;
    const ids = new Set(localTracks.map((tk) => tk.id));
    const extras = state.playlist.filter((t) => !ids.has(t.id));
    return extras.length ? [...localTracks, ...extras] : localTracks;
  }, [localTracks, state.playlist]);

  // Build track lookup map
  const trackMap = useMemo(() => {
    const map = new Map<string, Track>();
    for (const t of allTracks) map.set(t.id, t);
    return map;
  }, [allTracks]);

  // Favorites playlist
  const favPlaylist = useMemo(() => {
    return playlists.find((p) => p.id === "__favorites__");
  }, [playlists]);

  // Tracks from selected playlist
  const playlistTracks = useMemo(() => {
    if (!selectedPlaylistId) return [];
    const pl = playlists.find((p) => p.id === selectedPlaylistId);
    if (!pl) return [];
    return pl.trackIds
      .map((id) => trackMap.get(id))
      .filter((t): t is Track => !!t);
  }, [selectedPlaylistId, playlists, trackMap]);

  // Is a track in favorites?
  const isFavorite = useCallback(
    (trackId: string) => favPlaylist?.trackIds.includes(trackId) ?? false,
    [favPlaylist]
  );

  // Is a track in selected playlist?
  const isInPlaylist = useCallback(
    (trackId: string, plId: string) => {
      const pl = playlists.find((p) => p.id === plId);
      return pl?.trackIds.includes(trackId) ?? false;
    },
    [playlists]
  );

  // Toggle favorites
  const toggleFavorite = useCallback(
    async (trackId: string) => {
      // Auto-create favorites playlist if it doesn't exist
      let favId = favPlaylist?.id;
      if (!favId) {
        const res = await fetch("/api/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            name: "我的收藏",
            nameEn: "Favorites",
            id: "__favorites__",
          }),
        });
        const data = await res.json();
        if (data.ok) {
          favId = data.playlist.id;
          loadPlaylists();
        }
      }

      if (!favId) return;

      if (isFavorite(trackId)) {
        // Remove from favorites
        await fetch("/api/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "remove",
            id: favId,
            trackIds: [trackId],
          }),
        });
        showToast(t("removedFromFavorites"));
      } else {
        // Add to favorites
        await fetch("/api/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add",
            id: favId,
            trackIds: [trackId],
          }),
        });
        showToast(t("savedToFavorites"));
      }
      loadPlaylists();
    },
    [favPlaylist, isFavorite, showToast, t, loadPlaylists]
  );

  // Add track to a specific playlist
  const addToPlaylist = useCallback(
    async (trackId: string, playlistId: string) => {
      // Auto-create the playlist if it doesn't exist yet (for favorites)
      let targetId = playlistId;
      let pl = playlists.find((p) => p.id === playlistId);
      if (!pl && playlistId === "__favorites__") {
        const res = await fetch("/api/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            name: "我的收藏",
            nameEn: "Favorites",
          }),
        });
        const data = await res.json();
        if (data.ok) {
          targetId = data.playlist.id;
          pl = data.playlist;
          loadPlaylists();
        }
      }

      if (!pl && !playlistId.startsWith("__")) {
        pl = playlists.find((p) => p.id === playlistId);
      }
      if (!pl) return;

      const alreadyIn = pl.trackIds.includes(trackId);
      if (alreadyIn) {
        showToast(
          `${t("savedToPlaylist")} ${lang === "zh-CN" ? pl.name : pl.nameEn} ✓`
        );
        return;
      }

      await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          id: targetId,
          trackIds: [trackId],
        }),
      });
      showToast(
        `${t("savedToPlaylist")} «${lang === "zh-CN" ? pl.name : pl.nameEn}»`
      );
      loadPlaylists();
      setShowPlaylistModal(null);
    },
    [playlists, showToast, t, loadPlaylists]
  );

  // Create a new playlist
  const createPlaylist = useCallback(
    async (name: string) => {
      if (!name.trim()) return;
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: name.trim(),
          nameEn: name.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        loadPlaylists();
        setNewPlaylistName("");
        setShowNewPlaylist(false);
      }
    },
    [loadPlaylists]
  );

  // Delete a playlist
  const deletePlaylist = useCallback(
    async (id: string) => {
      if (!confirm(t("confirmDeletePlaylist"))) return;
      await fetch(`/api/playlists?id=${id}`, { method: "DELETE" });
      if (selectedPlaylistId === id) setSelectedPlaylistId(null);
      loadPlaylists();
    },
    [selectedPlaylistId, loadPlaylists, t]
  );

  // Filter logic
  const q = filter.trim().toLowerCase();
  const filteredAllTracks = useMemo(
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

  const filteredPlaylistTracks = useMemo(
    () =>
      q
        ? playlistTracks.filter(
            (t) =>
              t.title?.toLowerCase().includes(q) ||
              t.author?.toLowerCase().includes(q)
          )
        : playlistTracks,
    [playlistTracks, q]
  );

  // The tracks currently visible
  const displayedTracks = viewMode === "playlists" && selectedPlaylistId
    ? filteredPlaylistTracks
    : filteredAllTracks;

  const trackCountLabel =
    allTracks.length > 0
      ? `${allTracks.length} ${t("trackCount")}`
      : t("loading");

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
            {viewMode === "playlists" && selectedPlaylistId
              ? (() => {
                  const pl = playlists.find((p) => p.id === selectedPlaylistId);
                  return pl
                    ? `${lang === "zh-CN" ? pl.name : pl.nameEn} · ${playlistTracks.length} ${t("trackCount")}`
                    : trackCountLabel;
                })()
              : trackCountLabel}
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

      {/* View tabs + Filter */}
      <div className="flex shrink-0 items-center gap-2 border-b px-3" style={{ borderColor: "var(--color-outline-dim)" }}>
        <button
          type="button"
          onClick={() => {
            setViewMode("all");
            setSelectedPlaylistId(null);
          }}
          className="shrink-0 px-2 py-2 text-[11px] font-medium transition-colors border-b-2"
          style={{
            fontFamily: "var(--font-body)",
            color: viewMode === "all" ? "var(--color-primary)" : "var(--color-outline)",
            borderBottomColor: viewMode === "all" ? "var(--color-primary)" : "transparent",
          }}
        >
          {t("allTracks")}
        </button>
        <button
          type="button"
          onClick={() => setViewMode("playlists")}
          className="shrink-0 px-2 py-2 text-[11px] font-medium transition-colors border-b-2"
          style={{
            fontFamily: "var(--font-body)",
            color: viewMode === "playlists" ? "var(--color-primary)" : "var(--color-outline)",
            borderBottomColor: viewMode === "playlists" ? "var(--color-primary)" : "transparent",
          }}
        >
          {t("playlists")}
        </button>
        <div className="ml-auto shrink-0" style={{ width: 120 }}>
          <input
            type="search"
            placeholder={t("filter")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-full border px-2.5 py-1 text-[12px] outline-none transition-colors focus:ring-1 focus:ring-[color:var(--color-primary)]"
            style={{
              fontFamily: "var(--font-body)",
              borderColor: "var(--color-outline-dim)",
              backgroundColor: "var(--color-surface-raised)",
              color: "var(--color-on-surface)",
            }}
          />
        </div>
      </div>

      {/* Playlist list view */}
      {viewMode === "playlists" && !selectedPlaylistId && (
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ minHeight: 0 }}>
          {/* Favorites shortcut */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (favPlaylist) setSelectedPlaylistId(favPlaylist.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (favPlaylist) setSelectedPlaylistId(favPlaylist.id);
              }
            }}
            className="flex cursor-pointer items-center gap-3 px-3 py-3 rounded-lg transition-colors"
            style={{
              borderBottom: "1px solid var(--color-outline-dim)",
              fontFamily: "var(--font-body)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-primary) 6%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span className="text-[18px]">❤️</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">{t("favorites")}</div>
              <div className="text-[11px]" style={{ color: "var(--color-outline)" }}>
                {favPlaylist ? `${favPlaylist.trackIds.length} ${t("trackCount")}` : t("empty")}
              </div>
            </div>
          </div>

          {/* Custom playlists */}
          {playlists
            .filter((p) => p.id !== "__favorites__")
            .map((pl) => (
              <div
                key={pl.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPlaylistId(pl.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSelectedPlaylistId(pl.id);
                }}
                className="group flex cursor-pointer items-center gap-3 px-3 py-3 rounded-lg transition-colors"
                style={{
                  borderBottom: "1px solid var(--color-outline-dim)",
                  fontFamily: "var(--font-body)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-primary) 6%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span className="text-[18px]">🎵</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">
                    {lang === "zh-CN" ? pl.name : pl.nameEn}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--color-outline)" }}>
                    {pl.trackIds.length} {t("trackCount")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePlaylist(pl.id);
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-0 transition-all hover:bg-white/10 group-hover:opacity-100"
                  style={{ color: "var(--color-error)" }}
                  title={t("deletePlaylist")}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                </button>
              </div>
            ))}

          {/* Create new playlist */}
          {showNewPlaylist ? (
            <div className="flex items-center gap-2 px-3 py-3">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder={t("playlistName")}
                autoFocus
                className="flex-1 rounded-full border px-3 py-1.5 text-[13px] outline-none transition-colors focus:ring-1 focus:ring-[color:var(--color-primary)]"
                style={{
                  fontFamily: "var(--font-body)",
                  borderColor: "var(--color-primary)",
                  backgroundColor: "var(--color-surface-raised)",
                  color: "var(--color-on-surface)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createPlaylist(newPlaylistName);
                  if (e.key === "Escape") {
                    setShowNewPlaylist(false);
                    setNewPlaylistName("");
                  }
                }}
              />
              <button
                type="button"
                onClick={() => createPlaylist(newPlaylistName)}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {t("ok")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewPlaylist(false);
                  setNewPlaylistName("");
                }}
                className="rounded-full px-3 py-1.5 text-[12px] transition-colors"
                style={{ color: "var(--color-outline)" }}
              >
                {t("cancel")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewPlaylist(true)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/5"
              style={{ color: "var(--color-primary)" }}
            >
              <span className="text-[18px]">➕</span>
              <span className="text-[13px] font-medium">{t("newPlaylist")}</span>
            </button>
          )}
        </div>
      )}

      {/* Back button when viewing a playlist's tracks */}
      {viewMode === "playlists" && selectedPlaylistId && (
        <div className="shrink-0 px-3 pb-1">
          <button
            type="button"
            onClick={() => setSelectedPlaylistId(null)}
            className="flex items-center gap-1 text-[11px] transition-colors hover:text-[color:var(--color-primary)]"
            style={{ color: "var(--color-outline)", fontFamily: "var(--font-body)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            {t("playlists")}
          </button>
        </div>
      )}

      {/* Scrollable track list */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ minHeight: 0 }}>
        {viewMode === "all" && allTracks.length === 0 ? (
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
        ) : viewMode === "playlists" && selectedPlaylistId && playlistTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8">
            <p className="text-center text-[13px] opacity-50" style={{ fontFamily: "var(--font-body)" }}>
              {t("queueEmpty")}
            </p>
          </div>
        ) : (
          (viewMode === "playlists" && selectedPlaylistId ? filteredPlaylistTracks : filteredAllTracks).map(
            (tr, i) => {
              const active = state.current?.id === tr.id;
              const isFav = isFavorite(tr.id);
              return (
                <div
                  key={tr.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => playTrack(tr, viewMode === "playlists" && selectedPlaylistId ? playlistTracks : allTracks)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      playTrack(tr, viewMode === "playlists" && selectedPlaylistId ? playlistTracks : allTracks);
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
                  {/* Add to playlist button — always shows picker modal */}
                  <button
                    type="button"
                    aria-label={t("addToPlaylist")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPlaylistModal(tr.id);
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                    style={{
                      color: isFav ? "var(--color-primary)" : "var(--color-outline)",
                      opacity: active ? 0.8 : 0.4,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = active ? "0.8" : "0.4"; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </button>
                  {/* Remove button */}
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
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = active ? "0.8" : "0.35"; }}
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
            }
          )
        )}
      </div>

      {/* Add to playlist modal */}
      {showPlaylistModal && (() => {
        const track = allTracks.find((t) => t.id === showPlaylistModal);
        if (!track) return null;
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            onClick={() => setShowPlaylistModal(null)}
          >
            <div
              className="mx-4 w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
              style={{
                backgroundColor: "var(--color-surface-overlay)",
                borderColor: "var(--color-outline-dim)",
                fontFamily: "var(--font-body)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-1 text-[11px] font-semibold tracking-[var(--tracking-label)] uppercase opacity-50">
                {t("addToPlaylist")}
              </p>
              <p className="mb-4 text-[14px] leading-snug font-medium" style={{ color: "var(--color-on-surface)" }}>
                {track.title}
              </p>
              <div className="flex flex-col gap-1">
                {/* Favorites — always first */}
                <button
                  type="button"
                  onClick={async () => {
                    await toggleFavorite(track.id);
                    setShowPlaylistModal(null);
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                  style={{ color: "var(--color-on-surface)" }}
                >
                  <span>❤️</span>
                  <span className="flex-1 text-[13px]">{t("favorites")}</span>
                  {isFavorite(track.id) && (
                    <span className="text-[11px]" style={{ color: "var(--color-success)" }}>✓</span>
                  )}
                </button>

                {/* Divider */}
                <div style={{ height: 1, backgroundColor: "var(--color-outline-dim)", margin: "4px 0" }} />

                {/* Custom playlists */}
                {playlists
                  .filter((p) => p.id !== "__favorites__")
                  .map((pl) => {
                    const inPl = isInPlaylist(track.id, pl.id);
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => addToPlaylist(track.id, pl.id)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                        style={{ color: "var(--color-on-surface)" }}
                      >
                        <span>🎵</span>
                        <span className="flex-1 text-[13px]">
                          {lang === "zh-CN" ? pl.name : pl.nameEn}
                        </span>
                        {inPl && (
                          <span className="text-[11px]" style={{ color: "var(--color-success)" }}>✓</span>
                        )}
                      </button>
                    );
                  })}

                {/* New playlist (inline) */}
                <button
                  type="button"
                  onClick={async () => {
                    const name = prompt(lang === "zh-CN" ? "歌单名称：" : "Playlist name:");
                    if (name && name.trim()) {
                      await createPlaylist(name.trim());
                      await new Promise(r => setTimeout(r, 100)); // wait for re-fetch
                      setShowPlaylistModal(track.id);
                    }
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                  style={{ color: "var(--color-primary)" }}
                >
                  <span>➕</span>
                  <span className="flex-1 text-[13px]">{t("newPlaylist")}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowPlaylistModal(null)}
                className="mt-3 w-full rounded-full border px-4 py-2 text-[12px] transition-colors hover:opacity-80"
                style={{
                  borderColor: "var(--color-outline-dim)",
                  color: "var(--color-outline)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Toast notification */}
      {toastMsg && (
        <div
          className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full px-4 py-2 text-[12px] font-medium shadow-lg animate-[fade-in_0.2s_ease]"
          style={{
            backgroundColor: "var(--color-surface-overlay)",
            color: "var(--color-on-surface)",
            border: "1px solid var(--color-outline-dim)",
            fontFamily: "var(--font-body)",
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Delete confirmation dialog */}
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
                {lang === "zh-CN"
                  ? `确认删除 "${track.title}"？`
                  : `Remove "${track.title}"?`}
                <br />
                <span className="text-[12px] opacity-50">
                  {lang === "zh-CN" ? "本地文件也将被永久删除" : "File will be permanently deleted"}
                </span>
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
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmingId(null);
                    await fetch(track.url, { method: "DELETE" });
                    removeTrack(track.id);
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
                  {t("delete")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
