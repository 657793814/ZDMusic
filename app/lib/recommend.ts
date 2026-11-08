import { readHistory } from "./play-history";
import type { Track } from "./types";

const DAY_MS = 86400000;

/** 画像至少需要这么多条播放记录，且至少 3 首不同曲目，避免用一两次播放瞎猜 */
const MIN_PROFILE_SAMPLES = 5;

export interface PickItem {
  track: Track;
  /** 推荐理由，直接展示给用户，不写空话 */
  reason: string;
}

export interface ListeningProfile {
  /** 播放记录总数 */
  sampleSize: number;
  /** 样本是否足够生成画像 */
  sufficient: boolean;
  topArtist: { name: string; plays: number } | null;
  topSong: { trackId: string; title: string; plays: number } | null;
  distinctTracks: number;
  activeDays: number;
  totalMinutes: number;
}

function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** 每日推荐同一天内保持稳定：用日期做随机种子 */
function daySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function fallbackTitle(trackId: string): string {
  const name = trackId.split("/").pop() ?? trackId;
  return name.replace(/\.mp3$/i, "");
}

export function getListeningProfile(tracks: Track[]): ListeningProfile {
  const records = readHistory().records;
  const byId = new Map(tracks.map((track) => [track.id, track]));

  const playsById = new Map<string, number>();
  const artistPlays = new Map<string, number>();
  for (const record of records) {
    playsById.set(record.trackId, (playsById.get(record.trackId) ?? 0) + 1);
    const author = byId.get(record.trackId)?.author?.trim();
    if (author) artistPlays.set(author, (artistPlays.get(author) ?? 0) + 1);
  }

  const topArtist = [...artistPlays.entries()].sort((a, b) => b[1] - a[1])[0];
  const topSong = [...playsById.entries()].sort((a, b) => b[1] - a[1])[0];
  const distinctTracks = playsById.size;
  const activeDays = new Set(records.map((record) => dayKey(record.playedAt))).size;
  const totalMinutes = Math.round(
    records.reduce((sum, record) => sum + (record.duration ?? 0), 0) / 60
  );

  return {
    sampleSize: records.length,
    sufficient: records.length >= MIN_PROFILE_SAMPLES && distinctTracks >= 3,
    topArtist: topArtist ? { name: topArtist[0], plays: topArtist[1] } : null,
    topSong: topSong
      ? {
          trackId: topSong[0],
          title: byId.get(topSong[0])?.title ?? fallbackTitle(topSong[0]),
          plays: topSong[1],
        }
      : null,
    distinctTracks,
    activeDays,
    totalMinutes,
  };
}

/**
 * 每日推荐：常听歌手 + 上次没听完 + 近 7 天没听的，全部来自本地曲库。
 * 同一天内结果稳定；“换一批”用 rotate 打乱种子。
 */
export function getDailyPicks(tracks: Track[], limit = 8, rotate = false): PickItem[] {
  if (!tracks.length) return [];

  const rand = mulberry32(daySeed() * 31 + (rotate ? Math.floor(Date.now() / 60000) : 0));
  const records = readHistory().records;
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const picked = new Map<string, PickItem>();

  const push = (track: Track | undefined, reason: string) => {
    if (!track || picked.has(track.id) || picked.size >= limit) return;
    picked.set(track.id, { track, reason });
  };

  // 1) 常听歌手：按该歌手播放次数排序，每人挑一首，最多 3 首
  const artistPlays = new Map<string, number>();
  for (const record of records) {
    const author = byId.get(record.trackId)?.author?.trim();
    if (author) artistPlays.set(author, (artistPlays.get(author) ?? 0) + 1);
  }
  const topArtists = [...artistPlays.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
  for (const artist of topArtists) {
    const pool = shuffle(
      tracks.filter((track) => track.author.trim() === artist),
      rand
    );
    push(pool[0], "常听歌手");
  }

  // 2) 上次没听完：同一首只取最后一次记录
  const lastByTrack = new Map<string, { playedAt: number; completed: boolean }>();
  for (const record of records) {
    const prev = lastByTrack.get(record.trackId);
    if (!prev || record.playedAt > prev.playedAt) {
      lastByTrack.set(record.trackId, {
        playedAt: record.playedAt,
        completed: record.completed,
      });
    }
  }
  const unfinished = [...lastByTrack.entries()]
    .filter(([, value]) => !value.completed)
    .sort((a, b) => b[1].playedAt - a[1].playedAt)
    .slice(0, 3);
  for (const [trackId] of unfinished) push(byId.get(trackId), "上次没听完");

  // 3) 换换口味：优先近 7 天没播放过的
  const recentIds = new Set(
    records.filter((record) => record.playedAt >= Date.now() - 7 * DAY_MS).map((record) => record.trackId)
  );
  const freshReason = records.length ? "换换口味" : "随机推荐";
  for (const track of shuffle(tracks.filter((item) => !recentIds.has(item.id)), rand)) {
    push(track, freshReason);
  }

  // 4) 曲库太小：剩余补齐
  if (picked.size < limit) {
    for (const track of shuffle(tracks, rand)) push(track, "曲库精选");
  }

  return [...picked.values()];
}

/**
 * 本地推荐（原“平台推荐”）：不接任何平台歌单，只按本地播放热度与入库时间排序。
 */
export function getLocalPicks(tracks: Track[], limit = 8): PickItem[] {
  if (!tracks.length) return [];

  const now = Date.now();
  const records = readHistory().records;
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const picked = new Map<string, PickItem>();

  const push = (track: Track | undefined, reason: string) => {
    if (!track || picked.has(track.id) || picked.size >= limit) return;
    picked.set(track.id, { track, reason });
  };

  // 近 30 天在本地听得最多的
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.playedAt >= now - 30 * DAY_MS) {
      counts.set(record.trackId, (counts.get(record.trackId) ?? 0) + 1);
    }
  }
  for (const [trackId] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    push(byId.get(trackId), "近 30 天常听");
  }

  // 近期入库
  const dated = tracks
    .filter((track) => track.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  for (const track of dated) push(track, "近期入库");

  // 补齐
  for (const track of tracks) push(track, "曲库精选");

  return [...picked.values()];
}
