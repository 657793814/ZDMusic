import { readdir, stat } from "fs/promises";
import { homedir } from "os";
import path from "path";
import type { Track } from "./types";
import { syncEntries, type LibraryState } from "./library-store";

function expandTilde(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return homedir() + p.slice(1);
  return p;
}

const MUSIC_DIR = process.env.MUSIC_DIR
  ? expandTilde(process.env.MUSIC_DIR)
  : path.join(homedir(), "Documents/bili");

function isYear(s: string): boolean {
  return /^\d{4}$/.test(s) && s >= "1990" && s <= "2030";
}

function isNum(s: string): boolean {
  return /^\d{1,2}$/.test(s);
}

export function parseName(name: string): { title: string; author: string; date: string; bvid: string } {
  // 从文件名中提取 _BV 后缀（用于搜索），解析标题时不包含 bvid
  let bvid = "";
  const bvidMatch = name.match(/[_ ]BV([A-Za-z0-9]+)$/);
  if (bvidMatch) {
    bvid = `BV${bvidMatch[1]}`;
    name = name.slice(0, -bvidMatch[0].length);
  }

  const parts = name.split("-");
  const n = parts.length;

  if (n >= 4) {
    const [y, m, d] = [parts[n - 3], parts[n - 2], parts[n - 1]];
    if (isYear(y) && isNum(m) && isNum(d)) {
      const date = `${y}-${m}-${d}`;
      if (n >= 5) {
        return {
          title: parts.slice(0, n - 4).join("-").trim(),
          author: parts[n - 4].trim(),
          date,
          bvid,
        };
      }
      return { title: parts.slice(0, n - 3).join("-").trim(), author: "", date, bvid };
    }
  }

  return { title: name, author: "", date: "", bvid };
}

export type RawTrack = Track & { mtimeMs: number; birthtimeMs: number };

/** 只做磁盘扫描，不读曲库状态；管理端用它做重扫统计。 */
export async function scanFiles(): Promise<RawTrack[]> {
  const tracks: RawTrack[] = [];

  let dirs;
  try {
    dirs = await readdir(MUSIC_DIR, { withFileTypes: true });
  } catch {
    return tracks;
  }

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const subDir = dir.name;

    let files;
    try {
      files = await readdir(path.join(MUSIC_DIR, subDir), { withFileTypes: true });
    } catch {
      continue;
    }

    for (const f of files) {
      if (f.isDirectory() || !f.name.toLowerCase().endsWith(".mp3")) continue;

      const filePath = path.join(MUSIC_DIR, subDir, f.name);
      let size = 0;
      let mtimeMs = 0;
      let birthtimeMs = 0;
      try {
        const s = await stat(filePath);
        size = s.size;
        mtimeMs = s.mtimeMs;
        birthtimeMs = s.birthtimeMs;
      } catch {
        /* ignore */
      }

      const baseName = f.name.replace(/\.mp3$/i, "");
      const { title, author, date, bvid } = parseName(baseName);

      tracks.push({
        id: `${subDir}/${f.name}`,
        title,
        author,
        date,
        filename: f.name,
        subDir,
        size,
        mtimeMs,
        birthtimeMs,
        ...(bvid ? { bvid } : {}),
        url: `/api/tracks/${encodeURIComponent(subDir)}/${encodeURIComponent(f.name)}`,
      });
    }
  }

  return tracks;
}

/** 把曲库状态（本地覆盖 / 入库时间 / 时长缓存）叠加到扫描结果上 */
export function applyLibraryState(track: RawTrack, state: LibraryState): Track {
  const { mtimeMs: _mtimeMs, birthtimeMs: _birthtimeMs, ...rest } = track;
  const entry = state.entries[track.id];
  const override = state.overrides[track.id];

  return {
    ...rest,
    title: override?.title || track.title,
    author: override?.artist || track.author,
    album: override?.album || entry?.tagAlbum || "",
    durationSec: entry?.duration ?? 0,
    addedAt: entry?.addedAt ?? 0,
    addedAtSource: entry?.addedAtSource ?? "scan",
    ...(override ? { overridden: true } : {}),
  };
}

/**
 * 曲库对外查询入口：默认过滤「从曲库移除」的曲目（hidden）。
 * includeHidden 仅供重扫统计等管理场景使用。
 */
export async function scanTracks(options?: { includeHidden?: boolean }): Promise<Track[]> {
  const files = await scanFiles();
  // 目录不可读时不要改索引，避免把整库误标成 missing
  if (!files.length) return [];
  const state = syncEntries(files);
  return files
    .filter((file) => options?.includeHidden || !state.hidden.includes(file.id))
    .map((file) => applyLibraryState(file, state));
}

export function resolveMusicPath(relativePath: string): string | null {
  const full = path.resolve(MUSIC_DIR, relativePath);
  const root = path.resolve(MUSIC_DIR);
  if (full !== root && !full.startsWith(`${root}${path.sep}`)) return null;
  return full;
}

export { MUSIC_DIR };
