"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import { useLibrary, usePlayback, useQueue } from "@/app/context/player";
import type { Playlist } from "@/app/lib/types";
import { IconButton } from "@/app/components/ui";
import {
  ArrowLeftIcon,
  CloseIcon,
  EditIcon,
  ListIcon,
  LocateIcon,
  MusicIcon,
  PinIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
  ShuffleIcon,
  TrashIcon,
} from "@/app/components/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Tab = "queue" | "playlists";

export function QueueDrawer() {
  const { active, queueTab, close } = useOverlay();
  const queue = useQueue();
  const playback = usePlayback();
  const { getTrack, tracks: libraryTracks } = useLibrary();

  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tab, setTab] = useState<Tab>("queue");
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [viewPlaylistId, setViewPlaylistId] = useState<string | null>(null);
  const [form, setForm] = useState<{ id: string | null; name: string; description: string } | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRowRef = useRef<HTMLDivElement | null>(null);

  const activeOpen = active === "queue";

  useEffect(() => {
    if (activeOpen) {
      setPinned(true);
      setTab(queueTab);
      return;
    }
    // 浮层被关闭（Esc / 外部 close）后同步取消 pinned，否则抽屉会留在屏幕上
    setPinned(false);
  }, [activeOpen, queueTab]);

  // 其它浮层打开时让位
  useEffect(() => {
    if (active !== null && active !== "queue") {
      setPinned(false);
      setHovered(false);
    }
  }, [active]);

  const visible = activeOpen || pinned || (active === null && hovered);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (pinned || activeOpen) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setHovered(false), 300);
  }, [pinned, activeOpen, clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  // 打开歌单 tab 时加载；曲库数量变化（重扫/删除）时同步刷新，
  // 让「全部歌单」的内容和计数跟着扫描结果走
  useEffect(() => {
    if (!visible || tab !== "playlists") return;
    let alive = true;
    fetch("/api/playlists", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { playlists: [] }))
      .then((data: { playlists?: Playlist[] }) => {
        if (alive) setPlaylists(data.playlists ?? []);
      })
      .catch(() => {
        if (alive) setPlaylists([]);
      });
    return () => {
      alive = false;
    };
  }, [visible, tab, libraryTracks.length]);

  const handleClose = useCallback(() => {
    setPinned(false);
    setHovered(false);
    close();
  }, [close]);

  const handleJumpToCurrent = useCallback(() => {
    currentRowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  const handleClear = useCallback(() => {
    queue.clearQueue();
    playback.stop();
  }, [queue, playback]);

  const loadPlaylists = useCallback(async () => {
    const res = await fetch("/api/playlists", { cache: "no-store" });
    if (!res.ok) {
      setNotice("读取歌单失败");
      return;
    }
    const data = (await res.json()) as { playlists?: Playlist[] };
    setPlaylists(data.playlists ?? []);
  }, []);

  const postPlaylist = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      added?: number;
      playlist?: Playlist;
      error?: string;
    };
    if (!res.ok || !data.ok) throw new Error(data.error || "操作失败");
    return data;
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const enqueueAllSongs = useCallback(
    (playlist: Playlist) => {
      const resolved = playlist.trackIds
        .map((id) => getTrack(id))
        .filter((track): track is NonNullable<typeof track> => track !== null);
      if (!resolved.length) {
        setNotice("曲库为空");
        return;
      }
      queue.enqueue(resolved, "playlist");
      setNotice(`已把全部 ${resolved.length} 首加入队列`);
    },
    [getTrack, queue]
  );

  const handlePlayPlaylist = useCallback(
    (playlist: Playlist) => {
      const resolved = playlist.trackIds
        .map((id) => getTrack(id))
        .filter((track): track is NonNullable<typeof track> => track !== null);
      if (!resolved.length) {
        setNotice("歌单里的曲目都不在曲库（可能已被移出或文件已移动）");
        return;
      }
      queue.replaceQueue(resolved, { play: true, origin: "playlist" });
    },
    [getTrack, queue]
  );

  const openCreate = useCallback(() => {
    setConfirmDelete(null);
    setForm({ id: null, name: "", description: "" });
  }, []);

  const openRename = useCallback((playlist: Playlist) => {
    setConfirmDelete(null);
    setForm({ id: playlist.id, name: playlist.name, description: playlist.description ?? "" });
  }, []);

  const submitForm = useCallback(async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      setNotice("歌单名称不能为空");
      return;
    }
    setBusy(true);
    try {
      if (form.id) {
        await postPlaylist({
          action: "rename",
          id: form.id,
          name,
          description: form.description.trim(),
        });
        setNotice("已重命名");
      } else {
        const data = await postPlaylist({
          action: "create",
          name,
          description: form.description.trim(),
        });
        if (data.playlist) setViewPlaylistId(data.playlist.id);
        setNotice("已创建歌单");
      }
      setForm(null);
      await loadPlaylists();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }, [form, postPlaylist, loadPlaylists]);

  const deletePlaylist = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/playlists?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("删除失败");
        setConfirmDelete(null);
        if (viewPlaylistId === id) setViewPlaylistId(null);
        await loadPlaylists();
        setNotice("已删除歌单，本地音乐文件不受影响");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "删除失败");
      } finally {
        setBusy(false);
      }
    },
    [loadPlaylists, viewPlaylistId]
  );

  const addQueueToPlaylist = useCallback(
    async (playlist: Playlist) => {
      const trackIds = queue.queue.map((item) => item.trackId);
      if (!trackIds.length) {
        setNotice("播放队列为空，先播放几首再加入");
        return;
      }
      setBusy(true);
      try {
        const data = await postPlaylist({ action: "add", id: playlist.id, trackIds });
        await loadPlaylists();
        setNotice(
          data.added
            ? `已加入 ${data.added} 首（已在歌单内的自动跳过）`
            : "队列里的曲目都已在歌单内"
        );
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "加入失败");
      } finally {
        setBusy(false);
      }
    },
    [queue.queue, postPlaylist, loadPlaylists]
  );

  const removePlaylistTrack = useCallback(
    async (playlist: Playlist, trackId: string) => {
      setBusy(true);
      try {
        await postPlaylist({ action: "remove", id: playlist.id, trackIds: [trackId] });
        await loadPlaylists();
        setNotice("已从歌单移除");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "移除失败");
      } finally {
        setBusy(false);
      }
    },
    [postPlaylist, loadPlaylists]
  );

  const movePlaylistTrack = useCallback(
    async (playlist: Playlist, index: number, delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= playlist.trackIds.length) return;
      const next = [...playlist.trackIds];
      [next[index], next[target]] = [next[target], next[index]];
      setPlaylists((prev) =>
        prev ? prev.map((item) => (item.id === playlist.id ? { ...item, trackIds: next } : item)) : prev
      );
      try {
        await postPlaylist({ action: "set", id: playlist.id, trackIds: next });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "排序保存失败");
        await loadPlaylists();
      }
    },
    [postPlaylist, loadPlaylists]
  );

  const activePlaylist = useMemo(
    () => (playlists ?? []).find((playlist) => playlist.id === viewPlaylistId) ?? null,
    [playlists, viewPlaylistId]
  );

  const playModeMeta = {
    sequential: { label: "顺序播放（列表循环）", short: "顺序" },
    shuffle: { label: "随机播放", short: "随机" },
    "repeat-one": { label: "单曲循环", short: "单曲" },
  }[queue.playMode];

  const playlistRows = useMemo(() => playlists ?? [], [playlists]);

  return (
    <>
      <div
        className="zd-edge-trigger"
        aria-hidden
        onPointerEnter={() => {
          clearCloseTimer();
          if (active === null) setHovered(true);
        }}
        onPointerLeave={scheduleClose}
        onClick={() => {
          if (active === null) {
            setHovered(true);
            setPinned(true);
          }
        }}
      />

      <aside
        className="zd-queue-drawer glass-drawer"
        data-open={visible ? "true" : "false"}
        data-pinned={pinned || activeOpen ? "true" : "false"}
        aria-hidden={!visible}
        aria-label="队列与歌单"
        onPointerEnter={() => {
          clearCloseTimer();
          setHovered(true);
        }}
        onPointerLeave={scheduleClose}
      >
        <header className="zd-queue-head">
          <div className="zd-queue-head-title">
            <span className="zd-kicker">QUEUE</span>
            <div className="zd-queue-title-row">
              <span className="zd-queue-title">队列与歌单</span>
              <span className="zd-queue-count">{queue.queue.length}</span>
            </div>
          </div>
          <div className="zd-queue-head-actions">
            <IconButton
              label="跳到当前曲"
              size={30}
              onClick={handleJumpToCurrent}
              disabled={!queue.currentUid}
            >
              <LocateIcon size={13} />
            </IconButton>
            <IconButton
              label={`播放模式：${playModeMeta.label}（点击切换）`}
              size={30}
              active={queue.playMode !== "sequential"}
              onClick={queue.cyclePlayMode}
            >
              {queue.playMode === "shuffle" ? (
                <ShuffleIcon size={13} />
              ) : (
                <span className="zd-queue-repeat">
                  <RepeatIcon size={13} />
                  <span>{queue.playMode === "repeat-one" ? "1" : "∞"}</span>
                </span>
              )}
            </IconButton>
            <IconButton
              label={pinned || activeOpen ? "取消固定" : "固定抽屉"}
              size={30}
              active={pinned || activeOpen}
              onClick={() => {
                if (pinned || activeOpen) {
                  setPinned(false);
                  setHovered(true);
                  close();
                } else {
                  setPinned(true);
                }
              }}
            >
              <PinIcon size={13} />
            </IconButton>
            <IconButton label="关闭队列" size={30} onClick={handleClose}>
              <CloseIcon size={13} />
            </IconButton>
          </div>
        </header>

        <div className="zd-queue-tabs">
          <button
            type="button"
            className="zd-chip"
            data-active={tab === "queue" ? "true" : "false"}
            onClick={() => {
              setTab("queue");
              setViewPlaylistId(null);
              setForm(null);
              setConfirmDelete(null);
            }}
          >
            <ListIcon size={12} />
            队列
          </button>
          <button
            type="button"
            className="zd-chip"
            data-active={tab === "playlists" ? "true" : "false"}
            onClick={() => {
              setTab("playlists");
              setViewPlaylistId(null);
              setForm(null);
              setConfirmDelete(null);
              void loadPlaylists();
            }}
          >
            歌单
          </button>
          {tab === "queue" && queue.queue.length > 0 ? (
            <button type="button" className="zd-queue-clear" onClick={handleClear}>
              <TrashIcon size={12} />
              清空
            </button>
          ) : tab === "playlists" ? (
            <button
              type="button"
              className="zd-queue-clear"
              onClick={openCreate}
              disabled={busy}
            >
              <PlusIcon size={12} />
              新建歌单
            </button>
          ) : null}
        </div>

        {tab === "queue" ? (
          <div className="zd-queue-list">
            {queue.queue.length === 0 ? (
              <div className="zd-empty">
                队列为空。从曲库、发现条或搜索里点一首，会自动入队。
              </div>
            ) : (
              queue.queue.map((item, index) => {
                const track = getTrack(item.trackId);
                const isCurrent = item.uid === queue.currentUid;
                return (
                  <div
                    key={item.uid}
                    ref={isCurrent ? currentRowRef : null}
                    className="zd-queue-row"
                    data-current={isCurrent ? "true" : "false"}
                    role="button"
                    tabIndex={0}
                    onClick={() => queue.setCurrentUid(item.uid, { play: true })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        queue.setCurrentUid(item.uid, { play: true });
                      }
                    }}
                  >
                    <span className="zd-queue-index">
                      {isCurrent ? (
                        <span
                          className="zd-queue-bars"
                          data-playing={playback.playing ? "true" : "false"}
                          aria-hidden
                        >
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : (
                        (index + 1).toString().padStart(2, "0")
                      )}
                    </span>
                    <span className="zd-queue-meta">
                      <span className="zd-queue-name">
                        {track?.title ?? item.trackId}
                      </span>
                      <span className="zd-queue-sub">
                        {track?.author || (track ? track.subDir : "文件已移动")}
                      </span>
                    </span>
                    {track ? (
                      <span className="zd-queue-row-actions">
                        <IconButton
                          label="下一首播放"
                          size={28}
                          onClick={(event) => {
                            event.stopPropagation();
                            queue.addNext(track, item.origin);
                          }}
                        >
                          <PlusIcon size={12} />
                        </IconButton>
                        <IconButton
                          label="从队列移除"
                          size={28}
                          onClick={(event) => {
                            event.stopPropagation();
                            queue.removeItem(item.uid);
                          }}
                        >
                          <TrashIcon size={12} />
                        </IconButton>
                      </span>
                    ) : (
                      <IconButton
                        label="从队列移除"
                        size={28}
                        onClick={(event) => {
                          event.stopPropagation();
                          queue.removeItem(item.uid);
                        }}
                      >
                        <TrashIcon size={12} />
                      </IconButton>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="zd-queue-list">
            {notice ? <div className="zd-queue-notice">{notice}</div> : null}

            {form ? (
              <form
                className="zd-playlist-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitForm();
                }}
              >
                <input
                  className="zd-playlist-input"
                  placeholder="歌单名称"
                  value={form.name}
                  autoFocus
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
                <input
                  className="zd-playlist-input"
                  placeholder="描述（可选）"
                  value={form.description}
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
                <div className="zd-playlist-form-actions">
                  <button type="submit" className="zd-chip" data-active="true" disabled={busy}>
                    {form.id ? "保存" : "创建"}
                  </button>
                  <button
                    type="button"
                    className="zd-chip"
                    disabled={busy}
                    onClick={() => setForm(null)}
                  >
                    取消
                  </button>
                </div>
              </form>
            ) : null}

            {activePlaylist ? (
              <>
                <div className="zd-playlist-detail-head">
                  <button
                    type="button"
                    className="zd-playlist-back"
                    onClick={() => {
                      setViewPlaylistId(null);
                      setConfirmDelete(null);
                    }}
                  >
                    <ArrowLeftIcon size={12} />
                    返回歌单列表
                  </button>
                  <span className="zd-playlist-detail-actions">
                    <IconButton
                      label="播放这个歌单"
                      size={28}
                      disabled={busy}
                      onClick={() => handlePlayPlaylist(activePlaylist)}
                    >
                      <PlayIcon size={12} />
                    </IconButton>
                    {activePlaylist.system ? null : (
                      <>
                        <IconButton
                          label="重命名"
                          size={28}
                          disabled={busy}
                          onClick={() => openRename(activePlaylist)}
                        >
                          <EditIcon size={12} />
                        </IconButton>
                        <IconButton
                          label="删除歌单"
                          size={28}
                          disabled={busy}
                          onClick={() => setConfirmDelete(activePlaylist.id)}
                        >
                          <TrashIcon size={12} />
                        </IconButton>
                      </>
                    )}
                  </span>
                </div>

                <div className="zd-playlist-detail-meta">
                  <span className="zd-queue-name">{activePlaylist.name}</span>
                  <span className="zd-queue-sub">
                    {activePlaylist.trackIds.length} 首
                    {activePlaylist.description ? ` · ${activePlaylist.description}` : ""}
                  </span>
                </div>

                {confirmDelete === activePlaylist.id ? (
                  <div className="zd-playlist-confirm">
                    <span>删除「{activePlaylist.name}」？只删歌单，不会删除本地音乐文件。</span>
                    <button
                      type="button"
                      className="zd-chip"
                      data-active="true"
                      disabled={busy}
                      onClick={() => void deletePlaylist(activePlaylist.id)}
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      className="zd-chip"
                      disabled={busy}
                      onClick={() => setConfirmDelete(null)}
                    >
                      取消
                    </button>
                  </div>
                ) : null}

                <div className="zd-playlist-detail-actions">
                  {activePlaylist.system ? (
                    <button
                      type="button"
                      className="zd-chip"
                      disabled={busy || activePlaylist.trackIds.length === 0}
                      onClick={() => enqueueAllSongs(activePlaylist)}
                    >
                      <PlusIcon size={12} />
                      全部加入队列（{activePlaylist.trackIds.length}）
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="zd-chip"
                      disabled={busy || queue.queue.length === 0}
                      onClick={() => void addQueueToPlaylist(activePlaylist)}
                    >
                      <PlusIcon size={12} />
                      加入当前队列（{queue.queue.length}）
                    </button>
                  )}
                </div>

                {activePlaylist.trackIds.length === 0 ? (
                  <div className="zd-empty">
                    {activePlaylist.system
                      ? "曲库还是空的。扫描到本地歌曲后这里会自动出现。"
                      : "这个歌单还是空的。点上方「加入当前队列」，或在曲库里多选后加入。"}
                  </div>
                ) : (
                  activePlaylist.trackIds.map((trackId, index) => {
                    const track = getTrack(trackId);
                    return (
                      <div key={`${trackId}-${index}`} className="zd-queue-row">
                        <span className="zd-queue-index">
                          {(index + 1).toString().padStart(2, "0")}
                        </span>
                        <span className="zd-queue-meta">
                          <span className="zd-queue-name">{track?.title ?? "已不在曲库"}</span>
                          <span className="zd-queue-sub">
                            {track ? track.author || track.subDir : trackId}
                          </span>
                        </span>
                        {activePlaylist.system ? null : (
                          <span className="zd-queue-row-actions">
                            <IconButton
                              label="上移"
                              size={26}
                              disabled={busy || index === 0}
                              onClick={() => void movePlaylistTrack(activePlaylist, index, -1)}
                            >
                              ↑
                            </IconButton>
                            <IconButton
                              label="下移"
                              size={26}
                              disabled={busy || index === activePlaylist.trackIds.length - 1}
                              onClick={() => void movePlaylistTrack(activePlaylist, index, 1)}
                            >
                              ↓
                            </IconButton>
                            <IconButton
                              label="从歌单移除"
                              size={26}
                              disabled={busy}
                              onClick={() => void removePlaylistTrack(activePlaylist, trackId)}
                            >
                              <TrashIcon size={12} />
                            </IconButton>
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            ) : playlists === null ? (
              <div className="zd-empty">正在读取歌单…</div>
            ) : playlistRows.length === 0 ? (
              <div className="zd-empty">
                还没有歌单。点右上角「新建歌单」开始整理。歌单只保存在本地，不会同步到任何平台账号。
              </div>
            ) : (
              playlistRows.map((playlist) => (
                <div
                  key={playlist.id}
                  className="zd-queue-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewPlaylistId(playlist.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setViewPlaylistId(playlist.id);
                    }
                  }}
                >
                  <span className="zd-queue-index">
                    <MusicIcon size={14} />
                  </span>
                  <span className="zd-queue-meta">
                    <span className="zd-queue-name">{playlist.name}</span>
                    <span className="zd-queue-sub">
                      {playlist.system ? "系统 · " : ""}
                      {playlist.trackIds.length} 首
                      {playlist.description ? ` · ${playlist.description}` : ""}
                    </span>
                  </span>
                  <span className="zd-queue-row-actions">
                    <IconButton
                      label="播放这个歌单"
                      size={26}
                      onClick={(event) => {
                        event.stopPropagation();
                        handlePlayPlaylist(playlist);
                      }}
                    >
                      <PlayIcon size={12} />
                    </IconButton>
                    {playlist.system ? null : (
                      <>
                        <IconButton
                          label="重命名"
                          size={26}
                          onClick={(event) => {
                            event.stopPropagation();
                            openRename(playlist);
                          }}
                        >
                          <EditIcon size={12} />
                        </IconButton>
                        <IconButton
                          label="删除歌单"
                          size={26}
                          onClick={(event) => {
                            event.stopPropagation();
                            setViewPlaylistId(playlist.id);
                            setConfirmDelete(playlist.id);
                          }}
                        >
                          <TrashIcon size={12} />
                        </IconButton>
                      </>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </aside>
    </>
  );
}
