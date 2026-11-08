import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { homedir } from "os";
import { basename, dirname, extname, join } from "path";
import { getConfigDir } from "./playlists-store";

/**
 * 本地曲库状态（与磁盘文件分离的一层索引）。
 * 存储位置：getConfigDir()/library.json
 *   - dev: ~/.zdmusic/library.json
 *   - 打包: ~/Library/Application Support/com.zdmusic/library.json
 *
 * 设计约定：
 * - 「从曲库移除」只写 hidden，不动磁盘文件；重新扫描会清空 hidden，可恢复。
 * - 元数据编辑写 overrides（本地覆盖表），不写回 mp3 tag；避免重编码风险。
 * - entries 记录首次入库时间、文件 mtime/size、时长与 tag 缓存。
 */
export type LibraryOverride = {
  title?: string;
  artist?: string;
  album?: string;
};

export type AddedAtSource = "path" | "birthtime" | "mtime" | "scan";

export type LibraryEntry = {
  size: number;
  mtimeMs: number;
  /** 首次认定入库的时间（用于「入库时间」排序） */
  addedAt: number;
  /** addedAt 的来源：路径日期目录 / 文件创建时间 / 修改时间 / 首次扫描兜底 */
  addedAtSource?: AddedAtSource;
  duration?: number;
  tagTitle?: string;
  tagArtist?: string;
  tagAlbum?: string;
  /** 读取 tag 的时间；缺省表示还没读过 */
  tagScannedAt?: number;
  /** 文件已从磁盘消失的时间；重新出现时清除 */
  missingAt?: number;
};

export type LibraryState = {
  version: 1;
  entries: Record<string, LibraryEntry>;
  hidden: string[];
  overrides: Record<string, LibraryOverride>;
};

const FILE_NAME = "library.json";

const ADDED_AT_SOURCES: AddedAtSource[] = ["path", "birthtime", "mtime", "scan"];

function isAddedAtSource(value: unknown): value is AddedAtSource {
  return typeof value === "string" && (ADDED_AT_SOURCES as string[]).includes(value);
}

const EMPTY_STATE: LibraryState = {
  version: 1,
  entries: {},
  hidden: [],
  overrides: {},
};

export function getLibraryPath(): string {
  return join(getConfigDir(), FILE_NAME);
}

function normalize(raw: unknown): LibraryState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STATE, entries: {}, hidden: [], overrides: {} };
  const input = raw as Partial<LibraryState>;
  const entries: Record<string, LibraryEntry> = {};
  if (input.entries && typeof input.entries === "object") {
    for (const [key, value] of Object.entries(input.entries)) {
      if (!key || !value || typeof value !== "object") continue;
      const entry = value as Partial<LibraryEntry>;
      entries[key] = {
        size: typeof entry.size === "number" ? entry.size : 0,
        mtimeMs: typeof entry.mtimeMs === "number" ? entry.mtimeMs : 0,
        addedAt: typeof entry.addedAt === "number" ? entry.addedAt : 0,
        ...(isAddedAtSource(entry.addedAtSource) ? { addedAtSource: entry.addedAtSource } : {}),
        ...(typeof entry.duration === "number" ? { duration: entry.duration } : {}),
        ...(typeof entry.tagTitle === "string" ? { tagTitle: entry.tagTitle } : {}),
        ...(typeof entry.tagArtist === "string" ? { tagArtist: entry.tagArtist } : {}),
        ...(typeof entry.tagAlbum === "string" ? { tagAlbum: entry.tagAlbum } : {}),
        ...(typeof entry.tagScannedAt === "number" ? { tagScannedAt: entry.tagScannedAt } : {}),
        ...(typeof entry.missingAt === "number" ? { missingAt: entry.missingAt } : {}),
      };
    }
  }

  const overrides: Record<string, LibraryOverride> = {};
  if (input.overrides && typeof input.overrides === "object") {
    for (const [key, value] of Object.entries(input.overrides)) {
      if (!key || !value || typeof value !== "object") continue;
      const override = value as LibraryOverride;
      const next: LibraryOverride = {};
      if (typeof override.title === "string" && override.title) next.title = override.title;
      if (typeof override.artist === "string" && override.artist) next.artist = override.artist;
      if (typeof override.album === "string" && override.album) next.album = override.album;
      if (Object.keys(next).length) overrides[key] = next;
    }
  }

  return {
    version: 1,
    entries,
    hidden: Array.isArray(input.hidden)
      ? Array.from(new Set(input.hidden.filter((id): id is string => typeof id === "string")))
      : [],
    overrides,
  };
}

export function readLibraryState(): LibraryState {
  const path = getLibraryPath();
  if (!existsSync(path)) return normalize(null);
  try {
    return normalize(JSON.parse(readFileSync(path, "utf-8")));
  } catch (error) {
    console.error("[library] Failed to read state:", error);
    return normalize(null);
  }
}

export function writeLibraryState(state: LibraryState): boolean {
  try {
    const path = getLibraryPath();
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.${Date.now().toString(36)}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
    renameSync(tmp, path);
    return true;
  } catch (error) {
    console.error("[library] Failed to write state:", error);
    return false;
  }
}

export type ScannedFile = { id: string; size: number; mtimeMs: number; birthtimeMs?: number };

function makeLocalDate(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || year < 1990 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function parseDateSegment(segment: string): Date | null {
  const separated = /^(\d{4})[-_.年](\d{1,2})[-_.月](\d{1,2})日?$/.exec(segment);
  if (separated) {
    return makeLocalDate(Number(separated[1]), Number(separated[2]), Number(separated[3]));
  }
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(segment);
  if (compact) {
    return makeLocalDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  }
  return null;
}

/**
 * 从曲目路径里解析下载日期目录，支持：
 * - 单段：2026-06-06 / 2026_06_06 / 2026.06.06 / 20260606
 * - 三段：2026/06/06
 */
export function parsePathDate(id: string): Date | null {
  const segments = id.split(/[\\/]/).slice(0, -1);
  for (const segment of segments) {
    const date = parseDateSegment(segment);
    if (date) return date;
  }
  for (let i = 0; i + 2 < segments.length; i += 1) {
    if (!/^\d{4}$/.test(segments[i])) continue;
    if (!/^\d{1,2}$/.test(segments[i + 1]) || !/^\d{1,2}$/.test(segments[i + 2])) continue;
    const date = makeLocalDate(Number(segments[i]), Number(segments[i + 1]), Number(segments[i + 2]));
    if (date) return date;
  }
  return null;
}

function isPlausibleTimestamp(ms: number | undefined, now: number): ms is number {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 && ms <= now + 86400000;
}

/**
 * 入库时间来源优先级：路径日期目录 → 文件创建时间 → 修改时间 → 首次扫描兜底。
 * 返回的 source 会存进索引，UI 据此区分「精确」与「估算」。
 */
export function resolveAddedAt(
  id: string,
  birthtimeMs: number | undefined,
  mtimeMs: number | undefined,
  now = Date.now()
): { addedAt: number; addedAtSource: AddedAtSource } {
  const pathDate = parsePathDate(id);
  if (pathDate) return { addedAt: pathDate.getTime(), addedAtSource: "path" };
  if (isPlausibleTimestamp(birthtimeMs, now)) {
    return { addedAt: birthtimeMs, addedAtSource: "birthtime" };
  }
  if (isPlausibleTimestamp(mtimeMs, now)) {
    return { addedAt: mtimeMs, addedAtSource: "mtime" };
  }
  return { addedAt: now, addedAtSource: "scan" };
}

/** 内容指纹（大小 + 秒级 mtime），用于识别「移动但未改动」的文件 */
function fingerprint(size: number, mtimeMs: number): string {
  return `${size}:${Math.round(mtimeMs / 1000)}`;
}

/**
 * 文件被移动（旧路径消失、新路径出现、大小与 mtime 不变）时，
 * 复用旧记录，保留 addedAt / 覆盖 / hidden，避免当成新曲目重新入库。
 */
export function adoptMovedEntry(
  state: LibraryState,
  file: ScannedFile,
  currentIds: Set<string>
): LibraryEntry | null {
  const fp = fingerprint(file.size, file.mtimeMs);
  for (const [oldId, entry] of Object.entries(state.entries)) {
    if (currentIds.has(oldId)) continue;
    if (fingerprint(entry.size, entry.mtimeMs) !== fp) continue;
    delete state.entries[oldId];
    if (state.overrides[oldId]) {
      state.overrides[file.id] = state.overrides[oldId];
      delete state.overrides[oldId];
    }
    if (state.hidden.includes(oldId)) {
      state.hidden = state.hidden.map((id) => (id === oldId ? file.id : id));
    }
    return entry;
  }
  return null;
}

/** 旧索引缺少 addedAtSource 时，一次性回填；写盘前先备份 library.json */
function backupBeforeMigration(): void {
  const path = getLibraryPath();
  if (!existsSync(path)) return;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    copyFileSync(path, `${path}.bak-${stamp}`);
  } catch (error) {
    console.error("[library] Failed to backup state before migration:", error);
  }
}

/**
 * 把磁盘扫描结果同步进 entries：新文件按来源优先级写入 addedAt；
 * 已有记录只更新可变字段，不刷新 addedAt。size/mtime 变化时失效 tag 缓存；
 * 磁盘上不再存在的记录标记 missingAt。
 */
export function syncEntries(files: ScannedFile[]): LibraryState {
  const state = readLibraryState();
  let changed = false;
  const now = Date.now();
  const incoming = new Set(files.map((file) => file.id));
  const legacy = Object.values(state.entries).some((entry) => !entry.addedAtSource);
  if (legacy) backupBeforeMigration();

  for (const file of files) {
    const entry = state.entries[file.id];
    if (!entry) {
      const adopted = adoptMovedEntry(state, file, incoming);
      if (adopted) {
        adopted.size = file.size;
        adopted.mtimeMs = file.mtimeMs;
        adopted.addedAtSource = adopted.addedAtSource || resolveAddedAt(
          file.id, file.birthtimeMs, file.mtimeMs, now
        ).addedAtSource;
        delete adopted.missingAt;
        state.entries[file.id] = adopted;
        changed = true;
        continue;
      }
      const resolved = resolveAddedAt(file.id, file.birthtimeMs, file.mtimeMs, now);
      state.entries[file.id] = {
        size: file.size,
        mtimeMs: file.mtimeMs,
        addedAt: resolved.addedAt,
        addedAtSource: resolved.addedAtSource,
      };
      changed = true;
      continue;
    }
    if (!entry.addedAtSource) {
      // 一次性回填：有更可靠的来源就替换，否则保留原值并标注「估算」
      const resolved = resolveAddedAt(file.id, file.birthtimeMs, file.mtimeMs, now);
      if (resolved.addedAtSource !== "scan") entry.addedAt = resolved.addedAt;
      entry.addedAtSource = resolved.addedAtSource;
      changed = true;
    }
    if (entry.size !== file.size || entry.mtimeMs !== file.mtimeMs) {
      entry.size = file.size;
      entry.mtimeMs = file.mtimeMs;
      delete entry.duration;
      delete entry.tagTitle;
      delete entry.tagArtist;
      delete entry.tagAlbum;
      delete entry.tagScannedAt;
      changed = true;
    }
    if (entry.missingAt) {
      delete entry.missingAt;
      changed = true;
    }
  }

  for (const [id, entry] of Object.entries(state.entries)) {
    if (incoming.has(id) || state.hidden.includes(id)) continue;
    if (!entry.missingAt) {
      entry.missingAt = now;
      changed = true;
    }
  }

  if (changed) writeLibraryState(state);
  return state;
}

export function setHidden(state: LibraryState, ids: string[]): void {
  const next = new Set(state.hidden);
  for (const id of ids) next.add(id);
  state.hidden = Array.from(next);
}

export function removeHidden(state: LibraryState, id: string): void {
  state.hidden = state.hidden.filter((entry) => entry !== id);
}

export function setOverride(state: LibraryState, id: string, patch: LibraryOverride): void {
  const current = state.overrides[id] ?? {};
  const next: LibraryOverride = { ...current };
  const assign = (key: keyof LibraryOverride) => {
    const value = patch[key];
    if (typeof value === "string" && value.trim()) next[key] = value.trim();
    else delete next[key];
  };
  assign("title");
  assign("artist");
  assign("album");

  if (Object.keys(next).length) state.overrides[id] = next;
  else delete state.overrides[id];
}

/** 彻底删除某曲目的索引（删除文件成功后调用，避免留下幽灵记录）。 */
export function removeRecord(state: LibraryState, id: string): void {
  delete state.entries[id];
  delete state.overrides[id];
  removeHidden(state, id);
}

export type TrashOutcome = { ok: true; trashedTo: string } | { ok: false; error: string };

function uniqueTrashPath(trashDir: string, filename: string): string {
  const ext = extname(filename);
  const stem = basename(filename, ext);
  let candidate = join(trashDir, filename);
  let index = 1;
  while (existsSync(candidate)) {
    candidate = join(trashDir, `${stem} ${index}${ext}`);
    index += 1;
  }
  return candidate;
}

function describeError(error: unknown): string {
  const code = (error as NodeJS.ErrnoException)?.code;
  switch (code) {
    case "ENOENT":
      return "文件不存在";
    case "EACCES":
    case "EPERM":
      return "没有权限";
    case "EBUSY":
    case "ENOTEMPTY":
      return "文件被占用";
    case "ENOSPC":
      return "磁盘空间不足";
    default:
      return (error as Error)?.message || "未知错误";
  }
}

/**
 * 移到 macOS 废纸篓（~/.Trash），不做硬删除。
 * 同卷用 rename；跨卷（外置磁盘）回落 copyFile + unlink，文件仍保留在废纸篓。
 */
export async function trashFile(fullPath: string): Promise<TrashOutcome> {
  try {
    const { promises: fs } = await import("fs");
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return { ok: false, error: "目标不是文件" };

    const trashDir = join(homedir(), ".Trash");
    await fs.mkdir(trashDir, { recursive: true });
    const target = uniqueTrashPath(trashDir, basename(fullPath));

    try {
      await fs.rename(fullPath, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "EXDEV") throw error;
      await fs.copyFile(fullPath, target);
      await fs.unlink(fullPath);
    }

    return { ok: true, trashedTo: target };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}
