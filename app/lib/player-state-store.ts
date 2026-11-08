import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { getConfigDir } from "./playlists-store";
import type { PlayerSnapshot, QueueItem, RepeatMode } from "./types";

const FILE_NAME = "player-state.json";
const MAX_QUEUE = 500;
const REPEAT_MODES: RepeatMode[] = ["off", "track", "queue"];

function getStatePath(): string {
  return join(getConfigDir(), FILE_NAME);
}

function sanitizeQueue(value: unknown): QueueItem[] {
  if (!Array.isArray(value)) return [];

  const items: QueueItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<QueueItem>;
    if (typeof item.uid !== "string" || typeof item.trackId !== "string") continue;
    items.push({
      uid: item.uid,
      trackId: item.trackId,
      origin: typeof item.origin === "string" ? item.origin : "library",
      addedAt: typeof item.addedAt === "number" ? item.addedAt : 0,
    });
    if (items.length >= MAX_QUEUE) break;
  }
  return items;
}

/** 读取上次会话快照；文件不存在或损坏时返回 null。 */
export function readPlayerState(): PlayerSnapshot | null {
  const path = getStatePath();
  if (!existsSync(path)) return null;

  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as Partial<PlayerSnapshot>;
    const queue = sanitizeQueue(parsed.queue);
    return {
      version: 1,
      queue,
      currentUid:
        typeof parsed.currentUid === "string" &&
        queue.some((item) => item.uid === parsed.currentUid)
          ? parsed.currentUid
          : null,
      progress: typeof parsed.progress === "number" ? Math.max(0, parsed.progress) : 0,
      volume: typeof parsed.volume === "number" ? Math.max(0, Math.min(1, parsed.volume)) : 0.8,
      muted: Boolean(parsed.muted),
      repeat: REPEAT_MODES.includes(parsed.repeat as RepeatMode)
        ? (parsed.repeat as RepeatMode)
        : "queue",
      shuffle: Boolean(parsed.shuffle),
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch (error) {
    console.error("[player-state] Failed to read:", error);
    return null;
  }
}

/** 原子写入（tmp + rename），避免进程退出时留下半截 JSON。 */
export function writePlayerState(input: Partial<PlayerSnapshot>): boolean {
  try {
    const dir = getConfigDir();
    mkdirSync(dir, { recursive: true });

    const snapshot: PlayerSnapshot = {
      version: 1,
      queue: sanitizeQueue(input.queue),
      currentUid: typeof input.currentUid === "string" ? input.currentUid : null,
      progress: typeof input.progress === "number" ? Math.max(0, input.progress) : 0,
      volume: typeof input.volume === "number" ? Math.max(0, Math.min(1, input.volume)) : 0.8,
      muted: Boolean(input.muted),
      repeat: REPEAT_MODES.includes(input.repeat as RepeatMode)
        ? (input.repeat as RepeatMode)
        : "queue",
      shuffle: Boolean(input.shuffle),
      updatedAt: Date.now(),
    };

    const path = getStatePath();
    const tmpPath = `${path}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), "utf-8");
    renameSync(tmpPath, path);
    return true;
  } catch (error) {
    console.error("[player-state] Failed to write:", error);
    return false;
  }
}

/**
 * 删除曲目后清理落盘快照，保证 ~/.zdmusic/player-state.json 不留幽灵条目。
 * 若当前曲目被移除，则顺延到队列中相邻的一首；队列清空则 currentUid = null。
 */
export function prunePlayerState(trackIds: string[]): boolean {
  const removed = new Set(trackIds);
  if (!removed.size) return false;
  const snapshot = readPlayerState();
  if (!snapshot) return false;

  const currentIndex = snapshot.queue.findIndex((item) => item.uid === snapshot.currentUid);
  const nextQueue = snapshot.queue.filter((item) => !removed.has(item.trackId));
  if (nextQueue.length === snapshot.queue.length) return false;

  let currentUid = snapshot.currentUid;
  let progress = snapshot.progress;

  if (!nextQueue.some((item) => item.uid === currentUid)) {
    const fallbackIndex = Math.min(Math.max(currentIndex, 0), Math.max(nextQueue.length - 1, 0));
    currentUid = nextQueue.length ? nextQueue[fallbackIndex].uid : null;
    progress = 0;
  }

  return writePlayerState({ ...snapshot, queue: nextQueue, currentUid, progress });
}
