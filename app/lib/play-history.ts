import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname } from "path";

interface PlayRecord {
  trackId: string;
  playedAt: number; // timestamp
  completed: boolean; // played to >80%
}

interface PlayHistory {
  records: PlayRecord[];
}

function getConfigDir(): string {
  const configFile = process.env.ZD_CONFIG_FILE || "";
  if (configFile) return dirname(configFile);
  return homedir() + "/.zdmusic";
}

function getHistoryPath(): string {
  return getConfigDir() + "/play-history.json";
}

export function readHistory(): PlayHistory {
  const path = getHistoryPath();
  if (!path) return { records: [] };
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf-8"));
    }
  } catch {}
  return { records: [] };
}

export function writeHistory(history: PlayHistory): boolean {
  const path = getHistoryPath();
  if (!path) return false;
  try {
    mkdirSync(getConfigDir(), { recursive: true });
    writeFileSync(path, JSON.stringify(history, null, 2), "utf-8");
    return true;
  } catch { return false; }
}

export function recordPlay(trackId: string, completed: boolean): void {
  const history = readHistory();
  history.records.push({ trackId, playedAt: Date.now(), completed });
  // Keep last 1000 records
  if (history.records.length > 1000) {
    history.records = history.records.slice(-1000);
  }
  writeHistory(history);
}

export function getRecentTrackIds(days: number = 7): Set<string> {
  const cutoff = Date.now() - days * 86400000;
  const history = readHistory();
  const ids = new Set<string>();
  for (const r of history.records) {
    if (r.playedAt >= cutoff) ids.add(r.trackId);
  }
  return ids;
}

export function getFrequentTrackIds(limit: number = 20): string[] {
  const history = readHistory();
  const count = new Map<string, number>();
  for (const r of history.records) {
    count.set(r.trackId, (count.get(r.trackId) || 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
