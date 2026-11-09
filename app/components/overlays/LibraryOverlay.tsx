"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { useLibrary, useQueue } from "@/app/context/player";
import type { Playlist, Track } from "@/app/lib/types";
import {
  CloseIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/app/components/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SortKey = "addedAt" | "title" | "author" | "album" | "duration";
type SortDir = "asc" | "desc";
type BulkAction = "remove" | "trash";

type Meta = { hiddenCount: number; tagPending: number; musicDir: string };

type RescanState = {
  processed: number;
  total: number;
  added: number;
  updated: number;
  missing: number;
  currentId: string | null;
  errors: { id: string; path: string; message: string }[];
  done: boolean;
};

type Notice = {
  kind: "info" | "warn";
  text: string;
  details?: { id: string; message: string }[];
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "addedAt", label: "入库时间" },
  { key: "title", label: "标题" },
  { key: "author", label: "艺术家" },
  { key: "album", label: "专辑" },
  { key: "duration", label: "时长" },
];

function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const mm = Math.floor(total / 60);
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatAdded(ms: number | undefined): string {
  if (!ms) return "—";
  const date = new Date(ms);
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addedAtHint(source: Track["addedAtSource"]): string {
  switch (source) {
    case "path":
      return "来自下载日期目录";
    case "birthtime":
      return "来自文件创建时间";
    case "mtime":
      return "来自文件修改时间";
    default:
      return "首次扫描时间（估算）";
  }
}

export function LibraryOverlay() {
  const { active, close } = useOverlay();
  const { scan: scanLibrary } = useLibrary();
  const { replaceQueue, queue, currentTrack, removeTracksByTrackId } = useQueue();

  const [rows, setRows] = useState<Track[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("addedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ action: BulkAction; ids: string[] } | null>(null);
  const [editing, setEditing] = useState<Track | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editAlbum, setEditAlbum] = useState("");
  const [busy, setBusy] = useState<{ action: BulkAction; done: number; total: number } | null>(null);
  const [rescan, setRescan] = useState<RescanState | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pickPlaylists, setPickPlaylists] = useState<Playlist[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const rescanRunningRef = useRef(false);
  const autoScannedRef = useRef(false);
  const allCheckboxRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch("/api/library/list", { cache: "no-store" });
      if (!res.ok) throw new Error(`读取曲库失败（${res.status}）`);
      const data = (await res.json()) as {
        tracks?: Track[];
        hiddenCount?: number;
        tagPending?: number;
        musicDir?: string;
      };
      setRows(data.tracks ?? []);
      setMeta({
        hiddenCount: data.hiddenCount ?? 0,
        tagPending: data.tagPending ?? 0,
        musicDir: data.musicDir ?? "~/Music",
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取曲库失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const runRescan = useCallback(
    async (mode: "all" | "single", id?: string, silent = false) => {
      if (rescanRunningRef.current) return;
      rescanRunningRef.current = true;
      setRescan({ processed: 0, total: 0, added: 0, updated: 0, missing: 0, currentId: null, errors: [], done: false });
      try {
        const res = await fetch("/api/library/rescan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // silent = 打开面板时后台补标签，不能顺带把用户「从曲库移除」的歌恢复
          body: JSON.stringify({ mode, id, keepHidden: silent }),
        });
        if (!res.ok) throw new Error(`发起重扫失败（${res.status}）`);
        const { jobId } = (await res.json()) as { jobId?: string };
        if (!jobId) throw new Error("没有拿到重扫任务");

        let final: RescanState | null = null;
        for (let attempt = 0; attempt < 400; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 220));
          const statusRes = await fetch(`/api/library/rescan?jobId=${encodeURIComponent(jobId)}`, {
            cache: "no-store",
          });
          if (!statusRes.ok) throw new Error(`读取重扫进度失败（${statusRes.status}）`);
          const status = (await statusRes.json()) as RescanState;
          setRescan(status);
          if (status.done) {
            final = status;
            break;
          }
        }
        if (!final) throw new Error("重扫超时");

        await load(true);
        await scanLibrary();

        if (!silent) {
          setNotice({
            kind: final.errors.length ? "warn" : "info",
            text: `重扫完成：新增 ${final.added} · 更新 ${final.updated} · 缺失 ${final.missing}${
              final.errors.length ? ` · 失败 ${final.errors.length}` : ""
            }`,
            details: final.errors.map((issue) => ({
              id: issue.id || issue.path,
              message: issue.message,
            })),
          });
        }
        setRescan(null);
      } catch (err) {
        setNotice({ kind: "warn", text: err instanceof Error ? err.message : "重扫失败" });
        setRescan(null);
      } finally {
        rescanRunningRef.current = false;
      }
    },
    [load, scanLibrary]
  );

  // 打开时加载；关闭时清空临时状态
  useEffect(() => {
    if (active !== "library") {
      autoScannedRef.current = false;
      setSelected(new Set());
      setNotice(null);
      setPending(null);
      setEditing(null);
      setRescan(null);
      return;
    }
    void load();
  }, [active, load]);

  // 首次打开若还没读过 tag（时长为空），自动补一次元数据，显示进度
  useEffect(() => {
    if (active !== "library" || loading || !meta || rescanRunningRef.current || autoScannedRef.current) return;
    if (meta.tagPending > 0) {
      autoScannedRef.current = true;
      void runRescan("all", undefined, true);
    }
  }, [active, loading, meta, runRescan]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((track) =>
          [track.title, track.author, track.album ?? "", track.filename, track.subDir]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        )
      : rows;
    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "duration") return ((a.durationSec ?? 0) - (b.durationSec ?? 0)) * direction;
      if (sortKey === "addedAt") return ((a.addedAt ?? 0) - (b.addedAt ?? 0)) * direction;
      const left = String(a[sortKey] ?? "");
      const right = String(b[sortKey] ?? "");
      return left.localeCompare(right, "zh-Hans-CN") * direction;
    });
  }, [rows, query, sortKey, sortDir]);

  const allSelected = visible.length > 0 && visible.every((track) => selected.has(track.id));
  const someSelected = visible.some((track) => selected.has(track.id));

  useEffect(() => {
    if (allCheckboxRef.current) {
      allCheckboxRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const track of visible) next.delete(track.id);
        return next;
      }
      const next = new Set(prev);
      for (const track of visible) next.add(track.id);
      return next;
    });
  };

  const playRow = (track: Track) => {
    const list = visible;
    const index = list.findIndex((item) => item.id === track.id);
    replaceQueue(list, { startIndex: index >= 0 ? index : 0, play: true, origin: "library" });
  };

  const openEdit = (track: Track) => {
    setEditing(track);
    setEditTitle(track.title);
    setEditArtist(track.author);
    setEditAlbum(track.album ?? "");
  };

  const saveEdit = async (clear = false) => {
    if (!editing) return;
    try {
      const res = await fetch("/api/library/metadata", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          clear
            ? { id: editing.id, clear: true }
            : {
                id: editing.id,
                title: editTitle,
                artist: editArtist,
                album: editAlbum,
              }
        ),
      });
      if (!res.ok) throw new Error(`保存失败（${res.status}）`);
      setEditing(null);
      await load(true);
      await scanLibrary();
      setNotice({
        kind: "info",
        text: clear ? "已恢复文件名解析" : "已保存本地元数据覆盖（不改动 mp3 标签）",
      });
    } catch (err) {
      setNotice({ kind: "warn", text: err instanceof Error ? err.message : "保存失败" });
    }
  };

  const confirmPending = async () => {
    if (!pending) return;
    const { action, ids } = pending;
    setPending(null);

    // 先让播放内核离开将被删除的曲目，再动文件，避免播放已不存在的路径
    const inQueue = ids.some((id) => queue.some((item) => item.trackId === id));
    if (inQueue) {
      removeTracksByTrackId(ids, { play: true });
    }

    setBusy({ action, done: 0, total: ids.length });
    const failures: { id: string; message: string }[] = [];

    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      try {
        const res = await fetch("/api/library/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ids: [id] }),
        });
        const data = (await res.json()) as {
          results?: { ok: boolean; error?: string }[];
          error?: string;
        };
        if (!res.ok || !data.results?.[0]?.ok) {
          failures.push({ id, message: data.results?.[0]?.error || data.error || "操作失败" });
        }
      } catch (err) {
        failures.push({ id, message: err instanceof Error ? err.message : "网络错误" });
      }
      setBusy({ action, done: i + 1, total: ids.length });
    }

    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });

    await load(true);
    await scanLibrary();
    setBusy(null);

    const succeeded = ids.length - failures.length;
    setNotice({
      kind: failures.length ? "warn" : "info",
      text: `${action === "trash" ? "删除文件" : "从曲库移除"}：成功 ${succeeded} 首${
        failures.length ? ` · 失败 ${failures.length} 首` : ""
      }`,
      details: failures,
    });
  };

  const openPlaylistPicker = useCallback(async () => {
    setPickerOpen((value) => !value);
    if (pickPlaylists !== null) return;
    try {
      const res = await fetch("/api/playlists", { cache: "no-store" });
      const data = res.ok ? ((await res.json()) as { playlists?: Playlist[] }) : { playlists: [] };
      // 「全部歌单」是曲库实时派生出来的系统歌单，不能往里加歌
      setPickPlaylists((data.playlists ?? []).filter((playlist) => !playlist.system));
    } catch {
      setPickPlaylists([]);
    }
  }, [pickPlaylists]);

  const addSelectedToPlaylist = useCallback(
    async (playlist: Playlist) => {
      const ids = Array.from(selected);
      if (!ids.length) return;
      setAdding(true);
      try {
        const res = await fetch("/api/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", id: playlist.id, trackIds: ids }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; added?: number; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "加入失败");
        const added = data.added ?? 0;
        setNotice({
          kind: "info",
          text: added
            ? `已加入 ${added} 首到「${playlist.name}」${added < ids.length ? "（重复曲目已跳过）" : ""}`
            : `所选曲目都已在「${playlist.name}」内`,
        });
        setPickerOpen(false);
        // 歌单数量变化，后续读取时重新拉取
        setPickPlaylists(null);
      } catch (err) {
        setNotice({ kind: "warn", text: err instanceof Error ? err.message : "加入歌单失败" });
      } finally {
        setAdding(false);
      }
    },
    [selected]
  );

  if (active !== "library") return null;

  const pendingTracks = pending ? rows.filter((track) => pending.ids.includes(track.id)) : [];
  const pendingQueued = pendingTracks.filter((track) => queue.some((item) => item.trackId === track.id));
  const pendingHasCurrent = pendingTracks.some((track) => track.id === currentTrack?.id);
  const editingCurrent = editing ? currentTrack?.id === editing.id : false;
  const isRescanning = !!rescan && !rescan.done;
  const progressPercent = rescan && rescan.total > 0
    ? Math.round((rescan.processed / rescan.total) * 100)
    : 0;

  return (
    <>
      <div className="zd-library-backdrop" onClick={close} />
      <section className="zd-library glass-drawer" role="dialog" aria-label="曲库管理">
        <header className="zd-library-head">
          <div>
            <span className="zd-kicker">LOCAL LIBRARY</span>
            <h2 className="zd-library-title">曲库管理</h2>
            <p className="zd-library-sub">
              {loading
                ? "读取中…"
                : `${rows.length} 首 · 已移除 ${meta?.hiddenCount ?? 0} 首${
                    meta?.hiddenCount ? "（重新扫描可恢复）" : ""
                  }`}
            </p>
          </div>
          <button type="button" className="zd-library-close" onClick={close} aria-label="关闭曲库管理">
            <CloseIcon size={16} />
          </button>
        </header>

        {error ? <div className="zd-library-notice" data-kind="warn">{error}</div> : null}

        <div className="zd-library-toolbar">
          <label className="zd-library-search">
            <SearchIcon size={14} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题 / 艺术家 / 专辑 / 文件名"
              aria-label="搜索曲库"
            />
          </label>
          <select
            className="zd-library-select"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            aria-label="排序字段"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="zd-library-sortdir"
            onClick={() => setSortDir((value) => (value === "asc" ? "desc" : "asc"))}
            title={sortDir === "asc" ? "升序，点击切降序" : "降序，点击切升序"}
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
          <button
            type="button"
            className="zd-chip"
            onClick={() => void runRescan("all")}
            disabled={isRescanning}
          >
            {isRescanning ? "扫描中…" : "重新扫描"}
          </button>
        </div>

        {rescan ? (
          <div className="zd-library-progress" data-done={rescan.done ? "true" : "false"}>
            <div className="zd-library-progress-head">
              <span>
                {rescan.total > 0
                  ? `扫描 ${rescan.processed}/${rescan.total}`
                  : "扫描中…"}
                {rescan.done
                  ? ` · 新增 ${rescan.added} · 更新 ${rescan.updated} · 缺失 ${rescan.missing}`
                  : ""}
              </span>
              {rescan.currentId ? <span className="zd-library-progress-file">{rescan.currentId}</span> : null}
            </div>
            <div className="zd-library-progress-track">
              <i style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        ) : null}

        {selected.size ? (
          <div className="zd-library-batch">
            <span>已选 {selected.size} 首</span>
            <button
              type="button"
              className="zd-library-action"
              onClick={() => void openPlaylistPicker()}
              disabled={!!busy || isRescanning || adding}
            >
              <PlusIcon size={13} />
              加入歌单
            </button>
            <button
              type="button"
              className="zd-library-action"
              onClick={() => setPending({ action: "remove", ids: Array.from(selected) })}
              disabled={!!busy || isRescanning}
            >
              从曲库移除
            </button>
            <button
              type="button"
              className="zd-library-action zd-library-action-danger"
              onClick={() => setPending({ action: "trash", ids: Array.from(selected) })}
              disabled={!!busy || isRescanning}
            >
              <TrashIcon size={13} />
              删除文件
            </button>
            <button type="button" className="zd-library-link" onClick={() => setSelected(new Set())}>
              清空选择
            </button>
          </div>
        ) : null}

        {pickerOpen && selected.size ? (
          <div className="zd-library-picker">
            <span className="zd-library-picker-label">加入歌单</span>
            {pickPlaylists === null ? (
              <span className="zd-queue-sub">正在读取歌单…</span>
            ) : pickPlaylists.length === 0 ? (
              <span className="zd-queue-sub">
                还没有歌单。先到播放队列的「歌单」标签新建一个。
              </span>
            ) : (
              pickPlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="zd-chip"
                  disabled={adding}
                  onClick={() => void addSelectedToPlaylist(playlist)}
                >
                  {playlist.name} · {playlist.trackIds.length}
                </button>
              ))
            )}
            <button type="button" className="zd-library-link" onClick={() => setPickerOpen(false)}>
              收起
            </button>
          </div>
        ) : null}

        <div className="zd-library-table" role="table" aria-label="曲目列表">
          <div className="zd-library-row zd-library-row-head" role="row">
            <span className="zd-library-cell zd-library-check">
              <input
                ref={allCheckboxRef}
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="全选当前列表"
              />
            </span>
            <span className="zd-library-cell">标题</span>
            <span className="zd-library-cell">艺术家</span>
            <span className="zd-library-cell">专辑</span>
            <span className="zd-library-cell zd-library-num">时长</span>
            <span className="zd-library-cell zd-library-num">入库</span>
            <span className="zd-library-cell zd-library-actions-head">操作</span>
          </div>

          <div className="zd-library-body">
            {visible.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className="zd-library-row"
                  data-current={isCurrent ? "true" : "false"}
                  data-selected={selected.has(track.id) ? "true" : "false"}
                  role="row"
                >
                  <span className="zd-library-cell zd-library-check">
                    <input
                      type="checkbox"
                      checked={selected.has(track.id)}
                      onChange={() => toggleSelect(track.id)}
                      aria-label={`选择 ${track.title}`}
                    />
                  </span>
                  <span className="zd-library-cell zd-library-title-cell">
                    <button
                      type="button"
                      className="zd-library-title-button"
                      onClick={() => playRow(track)}
                      title="播放（以当前列表顺序入队）"
                    >
                      <PlayIcon size={12} />
                      <span className="zd-library-name">{track.title || track.filename}</span>
                    </button>
                    {track.overridden ? <span className="zd-library-badge">本地覆盖</span> : null}
                    {isCurrent ? <span className="zd-library-badge zd-library-badge-live">播放中</span> : null}
                  </span>
                  <span className="zd-library-cell" title={track.author || "未知艺术家"}>
                    {track.author || "—"}
                  </span>
                  <span className="zd-library-cell" title={track.album || ""}>
                    {track.album || "—"}
                  </span>
                  <span className="zd-library-cell zd-library-num">{formatDuration(track.durationSec)}</span>
                  <span className="zd-library-cell zd-library-num" title={addedAtHint(track.addedAtSource)}>
                    {formatAdded(track.addedAt)}
                    {track.addedAtSource === "scan" ? (
                      <em className="zd-library-est">估算</em>
                    ) : null}
                  </span>
                  <span className="zd-library-cell zd-library-actions">
                    <button type="button" className="zd-library-action" onClick={() => openEdit(track)}>
                      编辑
                    </button>
                    <button
                      type="button"
                      className="zd-library-action"
                      onClick={() => void runRescan("single", track.id)}
                      disabled={isRescanning}
                      title="重新读取这一首的标签与时长"
                    >
                      重扫
                    </button>
                    <button
                      type="button"
                      className="zd-library-action"
                      onClick={() => setPending({ action: "remove", ids: [track.id] })}
                      disabled={!!busy}
                    >
                      移除
                    </button>
                    <button
                      type="button"
                      className="zd-library-action zd-library-action-danger"
                      onClick={() => setPending({ action: "trash", ids: [track.id] })}
                      disabled={!!busy}
                      title="移到 macOS 废纸篓"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </span>
                </div>
              );
            })}
            {!loading && !visible.length ? (
              <div className="zd-library-empty">
                {rows.length ? "没有匹配的曲目" : "本地目录里还没有 mp3"}
              </div>
            ) : null}
          </div>
        </div>

        {notice ? (
          <div className="zd-library-notice" data-kind={notice.kind}>
            <span>{notice.text}</span>
            {notice.details?.length ? (
              <ul className="zd-library-failures">
                {notice.details.slice(0, 6).map((detail, index) => (
                  <li key={`${detail.id}-${index}`} title={detail.id}>
                    {detail.id ? `${detail.id.split("/").pop()} · ` : ""}
                    {detail.message}
                  </li>
                ))}
              </ul>
            ) : null}
            <button type="button" className="zd-library-link" onClick={() => setNotice(null)}>
              知道了
            </button>
          </div>
        ) : null}

        {busy ? (
          <div className="zd-library-progress">
            <div className="zd-library-progress-head">
              <span>
                {busy.action === "trash" ? "正在移到废纸篓" : "正在从曲库移除"} {busy.done}/{busy.total}
              </span>
            </div>
            <div className="zd-library-progress-track">
              <i style={{ width: `${busy.total ? Math.round((busy.done / busy.total) * 100) : 0}%` }} />
            </div>
          </div>
        ) : null}
      </section>

      {pending ? (
        <div className="zd-library-dialog-backdrop" onClick={() => setPending(null)}>
          <div
            className="zd-library-dialog"
            role="alertdialog"
            aria-label={pending.action === "trash" ? "确认删除文件" : "确认从曲库移除"}
            onClick={(event) => event.stopPropagation()}
          >
            <h3>
              {pending.action === "trash"
                ? `移到废纸篓 ${pending.ids.length} 首？`
                : `从曲库移除 ${pending.ids.length} 首？`}
            </h3>
            {pending.action === "trash" ? (
              <>
                <p className="zd-library-dialog-warning">
                  文件会被移到 macOS 废纸篓（~/.Trash），不会硬删除；需要时可从废纸篓恢复。
                </p>
                <ul className="zd-library-paths">
                  {pendingTracks.slice(0, 6).map((track) => (
                    <li key={track.id}>
                      {meta?.musicDir ? `${meta.musicDir}/${track.id}` : track.id}
                    </li>
                  ))}
                  {pendingTracks.length > 6 ? <li>… 等 {pendingTracks.length} 首</li> : null}
                </ul>
              </>
            ) : (
              <>
                <p>
                  只删除曲库索引与本地状态，<strong>不会移动磁盘文件</strong>；之后点「重新扫描」可以把它们加回来。
                </p>
                <ul className="zd-library-paths">
                  {pendingTracks.slice(0, 6).map((track) => (
                    <li key={track.id}>{track.title || track.filename}</li>
                  ))}
                  {pendingTracks.length > 6 ? <li>… 等 {pendingTracks.length} 首</li> : null}
                </ul>
              </>
            )}
            {pendingQueued.length ? (
              <p className="zd-library-dialog-note">
                其中 {pendingQueued.length} 首在播放队列中，确认后会同步从队列移除
                {pendingHasCurrent ? "；当前播放会自动切到下一首" : ""}。
              </p>
            ) : null}
            <div className="zd-library-dialog-actions">
              <button type="button" className="zd-chip" onClick={() => setPending(null)}>
                取消
              </button>
              <button
                type="button"
                className={pending.action === "trash" ? "zd-library-confirm-danger" : "zd-library-confirm"}
                onClick={() => void confirmPending()}
              >
                {pending.action === "trash" ? "移到废纸篓" : "从曲库移除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="zd-library-dialog-backdrop" onClick={() => setEditing(null)}>
          <div
            className="zd-library-dialog"
            role="dialog"
            aria-label="编辑元数据"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>编辑元数据</h3>
            <p className="zd-library-dialog-note">
              只写入本地覆盖表（~/.zdmusic/library.json，打包环境为 Application Support），
              不改动 mp3 标签文件；重新扫描后覆盖仍然生效。
            </p>
            <label className="zd-library-field">
              <span>标题</span>
              <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
            </label>
            <label className="zd-library-field">
              <span>艺术家</span>
              <input value={editArtist} onChange={(event) => setEditArtist(event.target.value)} />
            </label>
            <label className="zd-library-field">
              <span>专辑</span>
              <input value={editAlbum} onChange={(event) => setEditAlbum(event.target.value)} />
            </label>
            {editing.overridden ? (
              <p className="zd-library-dialog-note">这首已有本地覆盖，保存会更新覆盖值。</p>
            ) : null}
            {editingCurrent ? (
              <p className="zd-library-dialog-note">正在播放：保存后播放信息会立即更新。</p>
            ) : null}
            <div className="zd-library-dialog-actions">
              {editing.overridden ? (
                <button type="button" className="zd-library-link" onClick={() => void saveEdit(true)}>
                  恢复文件名解析
                </button>
              ) : null}
              <button type="button" className="zd-chip" onClick={() => setEditing(null)}>
                取消
              </button>
              <button type="button" className="zd-library-confirm" onClick={() => void saveEdit(false)}>
                保存覆盖
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
