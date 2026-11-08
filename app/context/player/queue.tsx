"use client";

import type {
  PlayerSnapshot,
  QueueItem,
  QueueOrigin,
  RepeatMode,
  Track,
} from "@/app/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLibrary } from "./library";

let uidCounter = 0;

function makeUid(): string {
  uidCounter = (uidCounter + 1) % 1_000_000;
  return `q_${Date.now().toString(36)}_${uidCounter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function toQueueItem(track: Track, origin: QueueOrigin): QueueItem {
  return {
    uid: makeUid(),
    trackId: track.id,
    origin,
    addedAt: Date.now(),
  };
}

type ReplaceOptions = {
  startIndex?: number;
  /** 默认 true；false 时只换队列不自动播放 */
  play?: boolean;
  origin?: QueueOrigin;
};

export type PlayMode = "sequential" | "shuffle" | "repeat-one";

type QueueCtx = {
  queue: QueueItem[];
  currentUid: string | null;
  currentItem: QueueItem | null;
  currentTrack: Track | null;
  currentIndex: number;
  repeat: RepeatMode;
  shuffle: boolean;
  /** 合并后的三态播放模式（顺序 / 随机 / 单曲循环） */
  playMode: PlayMode;
  /** 用户主动播放时递增；播放内核据此判断是否 autoplay */
  playEpoch: number;
  /** 快照恢复是否完成 */
  hydrated: boolean;

  replaceQueue: (tracks: Track[], opts?: ReplaceOptions) => void;
  enqueue: (tracks: Track[], origin?: QueueOrigin) => void;
  addNext: (track: Track, origin?: QueueOrigin) => void;
  removeItem: (uid: string) => void;
  /** 按 trackId 批量移除队列项；当前曲目被移除时顺延到相邻曲目（默认继续播放） */
  removeTracksByTrackId: (trackIds: string[], opts?: { play?: boolean }) => void;
  moveItem: (from: number, to: number) => void;
  clearQueue: () => void;
  setCurrentUid: (uid: string | null, opts?: { play?: boolean }) => void;

  setRepeat: (mode: RepeatMode) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  cyclePlayMode: () => void;

  /** 手动下一首（到队尾时循环） */
  next: () => void;
  /** 上一首；返回目标 uid，null 表示需要回 0 */
  prev: () => string | null;
  /** 自然播完后的决策 */
  onEnded: () => "replay" | "advanced" | "stop";
};

const QueueContext = createContext<QueueCtx | null>(null);

export function QueueProvider({
  snapshot,
  children,
}: {
  snapshot: PlayerSnapshot | null | undefined;
  children: ReactNode;
}) {
  const { getTrack, loading } = useLibrary();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentUid, setCurrentUidState] = useState<string | null>(null);
  const [playEpoch, setPlayEpoch] = useState(0);
  const [repeat, setRepeatState] = useState<RepeatMode>("queue");
  const [shuffle, setShuffleState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const queueRef = useRef<QueueItem[]>([]);
  const currentUidRef = useRef<string | null>(null);
  const repeatRef = useRef<RepeatMode>("queue");
  const shuffleRef = useRef(false);
  const shufflePlayedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // ── 快照恢复：等曲库扫描完成后，把 trackId 解析回 Track ──
  useEffect(() => {
    if (hydrated || snapshot === undefined || loading) return;

    if (snapshot) {
      const resolvable = snapshot.queue.filter((item) => getTrack(item.trackId));
      const nextCurrent =
        resolvable.find((item) => item.uid === snapshot.currentUid)?.uid ??
        resolvable[0]?.uid ??
        null;

      queueRef.current = resolvable;
      currentUidRef.current = nextCurrent;
      repeatRef.current = snapshot.repeat;
      shuffleRef.current = snapshot.shuffle;
      shufflePlayedRef.current = new Set(nextCurrent ? [nextCurrent] : []);

      setQueue(resolvable);
      setCurrentUidState(nextCurrent);
      setRepeatState(snapshot.repeat);
      setShuffleState(snapshot.shuffle);
    }

    setHydrated(true);
  }, [hydrated, snapshot, loading, getTrack]);

  const setCurrentUid = useCallback(
    (uid: string | null, opts?: { play?: boolean }) => {
      currentUidRef.current = uid;
      setCurrentUidState(uid);
      if (uid && opts?.play !== false) {
        setPlayEpoch((v) => v + 1);
      }
    },
    []
  );

  const replaceQueue = useCallback((tracks: Track[], opts?: ReplaceOptions) => {
    const origin = opts?.origin ?? "library";
    const items = tracks.map((track) => toQueueItem(track, origin));
    const start = Math.max(0, Math.min(opts?.startIndex ?? 0, Math.max(0, items.length - 1)));
    const uid = items[start]?.uid ?? null;

    queueRef.current = items;
    currentUidRef.current = uid;
    shufflePlayedRef.current = new Set(uid ? [uid] : []);

    setQueue(items);
    setCurrentUidState(uid);
    if (uid && opts?.play !== false) {
      setPlayEpoch((v) => v + 1);
    }
  }, []);

  const enqueue = useCallback((tracks: Track[], origin: QueueOrigin = "library") => {
    if (!tracks.length) return;
    const items = tracks.map((track) => toQueueItem(track, origin));
    const next = [...queueRef.current, ...items];

    queueRef.current = next;
    setQueue(next);

    // 空队列第一次入队：选中但不自动播放（由播放内核按 playEpoch 决定）
    if (!currentUidRef.current && next[0]) {
      currentUidRef.current = next[0].uid;
      setCurrentUidState(next[0].uid);
    }
  }, []);

  const addNext = useCallback((track: Track, origin: QueueOrigin = "library") => {
    const item = toQueueItem(track, origin);
    const current = queueRef.current;
    const index = current.findIndex((entry) => entry.uid === currentUidRef.current);
    const next = [...current];
    next.splice(index >= 0 ? index + 1 : next.length, 0, item);

    queueRef.current = next;
    setQueue(next);

    if (!currentUidRef.current) {
      currentUidRef.current = item.uid;
      setCurrentUidState(item.uid);
    }
  }, []);

  const removeItem = useCallback((uid: string) => {
    const current = queueRef.current;
    const index = current.findIndex((entry) => entry.uid === uid);
    if (index < 0) return;

    const next = [...current];
    next.splice(index, 1);

    queueRef.current = next;
    setQueue(next);
    shufflePlayedRef.current.delete(uid);

    if (currentUidRef.current === uid) {
      // 删除当前项：暂停并指向下一项，但不自动播放（不 bump playEpoch）
      const fallback = next[Math.min(index, next.length - 1)]?.uid ?? null;
      currentUidRef.current = fallback;
      setCurrentUidState(fallback);
    }
  }, []);

  const removeTracksByTrackId = useCallback((trackIds: string[], opts?: { play?: boolean }) => {
    const removed = new Set(trackIds);
    if (!removed.size) return;

    const current = queueRef.current;
    const next = current.filter((entry) => !removed.has(entry.trackId));
    if (next.length === current.length) return;

    const currentIndexInOld = current.findIndex((entry) => entry.uid === currentUidRef.current);
    const currentRemoved =
      currentIndexInOld >= 0 && removed.has(current[currentIndexInOld]?.trackId ?? "");

    queueRef.current = next;
    setQueue(next);

    // 同步随机播放已播集合，避免留下已删除的 uid
    for (const uid of Array.from(shufflePlayedRef.current)) {
      if (!next.some((entry) => entry.uid === uid)) shufflePlayedRef.current.delete(uid);
    }

    if (currentRemoved) {
      const fallback =
        next[Math.min(Math.max(currentIndexInOld, 0), Math.max(next.length - 1, 0))]?.uid ?? null;
      currentUidRef.current = fallback;
      setCurrentUidState(fallback);
      if (fallback && opts?.play !== false) setPlayEpoch((value) => value + 1);
    }
  }, []);

  const moveItem = useCallback((from: number, to: number) => {
    const current = queueRef.current;
    if (from < 0 || from >= current.length || to < 0 || to >= current.length) return;
    if (from === to) return;

    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    queueRef.current = next;
    setQueue(next);
  }, []);

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    currentUidRef.current = null;
    shufflePlayedRef.current = new Set();
    setQueue([]);
    setCurrentUidState(null);
  }, []);

  const setRepeat = useCallback((mode: RepeatMode) => {
    repeatRef.current = mode;
    setRepeatState(mode);
  }, []);

  const cycleRepeat = useCallback(() => {
    const order: RepeatMode[] = ["queue", "track", "off"];
    const index = order.indexOf(repeatRef.current);
    const next = order[(index + 1) % order.length];
    repeatRef.current = next;
    setRepeatState(next);
  }, []);

  const toggleShuffle = useCallback(() => {
    const next = !shuffleRef.current;
    shuffleRef.current = next;
    shufflePlayedRef.current = new Set(
      currentUidRef.current ? [currentUidRef.current] : []
    );
    setShuffleState(next);
  }, []);

  /** 三态循环：顺序 → 随机 → 单曲循环 → 顺序 */
  const cyclePlayMode = useCallback(() => {
    const current: PlayMode =
      repeatRef.current === "track" ? "repeat-one" : shuffleRef.current ? "shuffle" : "sequential";
    const next: PlayMode =
      current === "sequential" ? "shuffle" : current === "shuffle" ? "repeat-one" : "sequential";

    if (next === "repeat-one") {
      shuffleRef.current = false;
      setShuffleState(false);
      repeatRef.current = "track";
      setRepeatState("track");
      return;
    }
    if (next === "shuffle") {
      repeatRef.current = "queue";
      setRepeatState("queue");
      shuffleRef.current = true;
      shufflePlayedRef.current = new Set(
        currentUidRef.current ? [currentUidRef.current] : []
      );
      setShuffleState(true);
      return;
    }
    repeatRef.current = "queue";
    setRepeatState("queue");
    shuffleRef.current = false;
    setShuffleState(false);
  }, []);

  /** 计算下一个 uid。auto=true 表示自然播完（repeat=off 到末尾返回 null）。 */
  const nextUid = useCallback((auto: boolean): string | null => {
    const current = queueRef.current;
    if (!current.length) return null;

    const index = current.findIndex((entry) => entry.uid === currentUidRef.current);

    if (shuffleRef.current) {
      const played = shufflePlayedRef.current;
      // repeat=off 且已随机播完：自然播完时停止；手动切歌则重置重来
      if (played.size >= current.length) {
        if (auto && repeatRef.current === "off") return null;
        played.clear();
      }

      const pool = current.filter((entry) => !played.has(entry.uid));
      const usable = pool.length ? pool : current;
      const noRepeat =
        usable.length > 1 && usable.some((entry) => entry.uid === currentUidRef.current)
          ? usable.filter((entry) => entry.uid !== currentUidRef.current)
          : usable;
      const pick = noRepeat[Math.floor(Math.random() * noRepeat.length)];
      if (!pick) return null;
      played.add(pick.uid);
      return pick.uid;
    }

    if (auto && repeatRef.current === "off") {
      return index >= 0 && index + 1 < current.length
        ? current[index + 1]?.uid ?? null
        : null;
    }

    const nextIndex = (index + 1) % current.length;
    return current[nextIndex]?.uid ?? null;
  }, []);

  const next = useCallback(() => {
    const uid = nextUid(false);
    if (uid) setCurrentUid(uid, { play: true });
  }, [nextUid, setCurrentUid]);

  const prev = useCallback((): string | null => {
    const current = queueRef.current;
    if (!current.length) return null;

    const index = current.findIndex((entry) => entry.uid === currentUidRef.current);
    const target = index > 0 ? index - 1 : current.length - 1;
    const uid = current[target]?.uid ?? null;
    if (uid) setCurrentUid(uid, { play: true });
    return uid;
  }, [setCurrentUid]);

  const onEnded = useCallback((): "replay" | "advanced" | "stop" => {
    if (repeatRef.current === "track") return "replay";

    const uid = nextUid(true);
    if (!uid) return "stop";

    setCurrentUid(uid, { play: true });
    return "advanced";
  }, [nextUid, setCurrentUid]);

  const currentIndex = currentUid
    ? queue.findIndex((entry) => entry.uid === currentUid)
    : -1;
  const currentItem = currentIndex >= 0 ? queue[currentIndex] ?? null : null;
  const currentTrack = currentItem ? getTrack(currentItem.trackId) : null;
  const playMode: PlayMode =
    repeat === "track" ? "repeat-one" : shuffle ? "shuffle" : "sequential";

  const value = useMemo<QueueCtx>(
    () => ({
      queue,
      currentUid,
      currentItem,
      currentTrack,
      currentIndex,
      repeat,
      shuffle,
      playMode,
      playEpoch,
      hydrated,
      replaceQueue,
      enqueue,
      addNext,
      removeItem,
      removeTracksByTrackId,
      moveItem,
      clearQueue,
      setCurrentUid,
      setRepeat,
      cycleRepeat,
      toggleShuffle,
      cyclePlayMode,
      next,
      prev,
      onEnded,
    }),
    [
      queue,
      currentUid,
      currentItem,
      currentTrack,
      currentIndex,
      repeat,
      shuffle,
      playMode,
      playEpoch,
      hydrated,
      replaceQueue,
      enqueue,
      addNext,
      removeItem,
      removeTracksByTrackId,
      moveItem,
      clearQueue,
      setCurrentUid,
      setRepeat,
      cycleRepeat,
      toggleShuffle,
      cyclePlayMode,
      next,
      prev,
      onEnded,
    ]
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue(): QueueCtx {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error("useQueue must be used within QueueProvider");
  return ctx;
}
