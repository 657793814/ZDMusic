"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/app/lib/i18n";
import { usePlayer } from "@/app/context/PlayerContext";

interface EnrichedTrack {
  id: string;
  title: string;
  author: string;
  album: string;
  albumArtist: string;
  year: number;
  trackNumber: number;
  genre: string;
  coverDataUrl: string | null;
  duration: number;
  url: string;
}

interface AlbumGroup {
  album: string;
  albumArtist: string;
  coverDataUrl: string | null;
  year: number;
  tracks: EnrichedTrack[];
}

type ViewMode = "albums" | "songs";

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",
  "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
];

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function placeholderGradient(album: string): string {
  let hash = 0;
  for (let i = 0; i < album.length; i++) {
    hash = ((hash << 5) - hash) + album.charCodeAt(i);
    hash |= 0;
  }
  return PLACEHOLDER_GRADIENTS[Math.abs(hash) % PLACEHOLDER_GRADIENTS.length];
}

export function AlbumGrid() {
  const { t, lang } = useI18n();
  const { state, playTrack } = usePlayer();
  const [data, setData] = useState<{ albums: AlbumGroup[]; tracks: EnrichedTrack[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("albums");
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const fetching = useRef(false);

  const fetchData = useCallback(() => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    fetch("/api/tracks/metadata?t=" + Date.now(), { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ tracks: EnrichedTrack[]; albums: AlbumGroup[] }>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
        fetching.current = false;
      })
      .catch(() => {
        setLoading(false);
        fetching.current = false;
      });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedAlbumData = useMemo(() => {
    if (!selectedAlbum || !data) return null;
    return data.albums.find((a) => a.album === selectedAlbum) || null;
  }, [selectedAlbum, data]);

  const q = filter.trim().toLowerCase();

  const filteredAllTracks = useMemo(() => {
    if (!data) return [];
    if (!q) return data.tracks;
    return data.tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.author.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    );
  }, [data, q]);

  const filteredAlbums = useMemo(() => {
    if (!data) return [];
    if (!q) return data.albums;
    return data.albums.filter(
      (a) =>
        a.album.toLowerCase().includes(q) ||
        a.albumArtist.toLowerCase().includes(q)
    );
  }, [data, q]);

  const trackCountLabel =
    data?.tracks?.length
      ? `${data.tracks.length} ${t("trackCount")}`
      : t("loading");

  const albumCountLabel =
    data?.albums?.length
      ? `${data.albums.length} 张专辑`
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
          <span
            className="text-[13px] font-semibold tracking-[var(--tracking-label)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {lang === "zh-CN" ? "音乐库" : "Library"}
          </span>
          <span
            className="max-w-[240px] shrink-0 truncate text-[11px] opacity-55"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {viewMode === "albums" && selectedAlbum && selectedAlbumData
              ? `${selectedAlbumData.album} · ${selectedAlbumData.tracks.length} ${t("trackCount")}`
              : viewMode === "albums"
              ? albumCountLabel
              : trackCountLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="flex h-6 w-6 items-center justify-center rounded-full border transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] disabled:opacity-40"
          style={{
            borderColor: "var(--color-outline-dim)",
            color: loading ? "var(--color-primary)" : "var(--color-outline)",
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
            className={loading ? "animate-spin" : ""}
          >
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* View toggle tabs */}
      <div className="flex shrink-0 gap-0 border-b px-3" style={{ borderColor: "var(--color-outline-dim)" }}>
        <button
          type="button"
          onClick={() => {
            setViewMode("albums");
            setSelectedAlbum(null);
          }}
          className="px-3 py-2 text-[11px] font-medium transition-colors border-b-2"
          style={{
            fontFamily: "var(--font-body)",
            color: viewMode === "albums" ? "var(--color-primary)" : "var(--color-outline)",
            borderBottomColor: viewMode === "albums" ? "var(--color-primary)" : "transparent",
          }}
        >
          {lang === "zh-CN" ? "专辑" : "Albums"}
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode("songs");
            setSelectedAlbum(null);
          }}
          className="px-3 py-2 text-[11px] font-medium transition-colors border-b-2"
          style={{
            fontFamily: "var(--font-body)",
            color: viewMode === "songs" ? "var(--color-primary)" : "var(--color-outline)",
            borderBottomColor: viewMode === "songs" ? "var(--color-primary)" : "transparent",
          }}
        >
          {t("allTracks")}
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

      {/* Content area */}
      {loading && !data ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-[12px] opacity-50" style={{ fontFamily: "var(--font-body)" }}>
            {t("loading")}
          </span>
        </div>
      ) : viewMode === "songs" ? (
        /* ── Songs view: flat track list ── */
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ minHeight: 0 }}>
          {filteredAllTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6">
              <p
                className="text-center text-xs font-medium tracking-[var(--tracking-label)] opacity-50"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {q ? (lang === "zh-CN" ? "没有匹配的歌曲" : "No matching tracks") : (lang === "zh-CN" ? "暂无歌曲" : "No tracks")}
              </p>
            </div>
          ) : (
            filteredAllTracks.map((tr) => {
              const active = state.current?.id === tr.id;
              const displayArtist = tr.author || tr.albumArtist || (lang === "zh-CN" ? "未知歌手" : "Unknown Artist");
              return (
                <div
                  key={tr.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    // Construct a minimal Track object for playback
                    const track = {
                      id: tr.id,
                      title: tr.title,
                      author: tr.author,
                      album: tr.album,
                      date: "",
                      filename: tr.id.split("/").pop() || "",
                      subDir: tr.id.split("/")[0] || "",
                      size: 0,
                      url: tr.url,
                    };
                    playTrack(track);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const track = {
                        id: tr.id,
                        title: tr.title,
                        author: tr.author,
                        album: tr.album,
                        date: "",
                        filename: tr.id.split("/").pop() || "",
                        subDir: tr.id.split("/")[0] || "",
                        size: 0,
                        url: tr.url,
                      };
                      playTrack(track);
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
                  {/* Album art thumbnail */}
                  <div
                    className="h-9 w-9 shrink-0 overflow-hidden rounded-lg"
                    style={
                      tr.coverDataUrl
                        ? { backgroundImage: `url(${tr.coverDataUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                        : { backgroundImage: placeholderGradient(tr.album || tr.id) }
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[13px]"
                      style={{ fontWeight: active ? 500 : 400 }}
                    >
                      {tr.title}
                    </div>
                    <div
                      className="truncate text-[11px]"
                      style={{ color: "var(--color-outline)" }}
                    >
                      {displayArtist}
                    </div>
                  </div>
                  <span
                    className="w-14 shrink-0 text-right text-[11px] tabular-nums"
                    style={{ color: "var(--color-outline)" }}
                  >
                    {formatDuration(tr.duration)}
                  </span>
                  {/* Play button */}
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
                    style={{
                      color: active ? "var(--color-primary)" : "var(--color-outline)",
                      opacity: active ? 1 : 0.4,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = active ? "1" : "0.4"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      {state.playing && active ? (
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                      ) : (
                        <polygon points="8,5 19,12 8,19" />
                      )}
                    </svg>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : selectedAlbumData ? (
        /* ── Albums view: viewing a specific album ── */
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Back button */}
          <div className="shrink-0 px-3 pb-1">
            <button
              type="button"
              onClick={() => setSelectedAlbum(null)}
              className="flex items-center gap-1 text-[11px] transition-colors hover:text-[color:var(--color-primary)]"
              style={{ color: "var(--color-outline)", fontFamily: "var(--font-body)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
              {lang === "zh-CN" ? "专辑" : "Albums"}
            </button>
          </div>

          {/* Album header */}
          <div className="flex shrink-0 items-center gap-4 px-3 py-3">
            <div
              className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl shadow-lg"
              style={
                selectedAlbumData.coverDataUrl
                  ? { backgroundImage: `url(${selectedAlbumData.coverDataUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { backgroundImage: placeholderGradient(selectedAlbumData.album) }
              }
            />
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-[16px] font-semibold leading-tight"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {selectedAlbumData.album}
              </div>
              <div
                className="mt-0.5 truncate text-[13px]"
                style={{ color: "var(--color-outline)" }}
              >
                {selectedAlbumData.albumArtist}
              </div>
              <div
                className="mt-1 flex items-center gap-2 text-[11px]"
                style={{ color: "var(--color-outline)" }}
              >
                <span>{selectedAlbumData.year || "—"}</span>
                <span>·</span>
                <span>{selectedAlbumData.tracks.length} {t("trackCount")}</span>
              </div>
            </div>
          </div>

          {/* Track list for album */}
          <div className="flex-1 overflow-y-auto overscroll-contain" style={{ minHeight: 0 }}>
            {selectedAlbumData.tracks.map((tr, i) => {
              const active = state.current?.id === tr.id;
              const displayArtist = tr.author || tr.albumArtist || "";
              return (
                <div
                  key={tr.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const track = {
                      id: tr.id,
                      title: tr.title,
                      author: tr.author,
                      album: tr.album,
                      date: "",
                      filename: tr.id.split("/").pop() || "",
                      subDir: tr.id.split("/")[0] || "",
                      size: 0,
                      url: tr.url,
                    };
                    playTrack(track);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const track = {
                        id: tr.id,
                        title: tr.title,
                        author: tr.author,
                        album: tr.album,
                        date: "",
                        filename: tr.id.split("/").pop() || "",
                        subDir: tr.id.split("/")[0] || "",
                        size: 0,
                        url: tr.url,
                      };
                      playTrack(track);
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
                    className="w-6 shrink-0 text-center text-[12px] tabular-nums"
                    style={{
                      color: active ? "var(--color-primary)" : "var(--color-outline)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {tr.trackNumber > 0 ? tr.trackNumber : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[13px]"
                      style={{ fontWeight: active ? 500 : 400 }}
                    >
                      {tr.title}
                    </div>
                    {displayArtist && (
                      <div
                        className="truncate text-[11px]"
                        style={{ color: "var(--color-outline)" }}
                      >
                        {displayArtist}
                      </div>
                    )}
                  </div>
                  <span
                    className="w-14 shrink-0 text-right text-[11px] tabular-nums"
                    style={{ color: "var(--color-outline)" }}
                  >
                    {formatDuration(tr.duration)}
                  </span>
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
                    style={{
                      color: active ? "var(--color-primary)" : "var(--color-outline)",
                      opacity: active ? 1 : 0.4,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = active ? "1" : "0.4"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      {state.playing && active ? (
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                      ) : (
                        <polygon points="8,5 19,12 8,19" />
                      )}
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Albums view: grid of album cards ── */
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ minHeight: 0 }}>
          {filteredAlbums.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6">
              <p
                className="text-center text-xs font-medium tracking-[var(--tracking-label)] opacity-50"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {q ? (lang === "zh-CN" ? "没有匹配的专辑" : "No matching albums") : (lang === "zh-CN" ? "暂无专辑" : "No albums")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAlbums.map((album) => (
                <div
                  key={album.album}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedAlbum(album.album)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedAlbum(album.album);
                    }
                  }}
                  className="flex cursor-pointer flex-col overflow-hidden rounded-2xl transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    backgroundColor: "var(--color-surface-raised)",
                    border: "1px solid var(--color-outline-dim)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {/* Cover image */}
                  <div
                    className="aspect-square w-full overflow-hidden"
                    style={
                      album.coverDataUrl
                        ? { backgroundImage: `url(${album.coverDataUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                        : { backgroundImage: placeholderGradient(album.album) }
                    }
                  />
                  {/* Info */}
                  <div className="flex flex-col gap-0.5 px-3 py-2.5">
                    <div
                      className="truncate text-[13px] font-medium leading-tight"
                      style={{ color: "var(--color-on-surface)" }}
                    >
                      {album.album}
                    </div>
                    <div
                      className="truncate text-[11px]"
                      style={{ color: "var(--color-outline)" }}
                    >
                      {album.albumArtist}
                    </div>
                    <div
                      className="mt-0.5 text-[10px]"
                      style={{ color: "var(--color-outline)" }}
                    >
                      {album.tracks.length} {t("trackCount")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
