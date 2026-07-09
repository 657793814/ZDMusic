import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname } from "path";
import type { Playlist, PlaylistStore } from "./types";

const DEFAULT_STORE: PlaylistStore = { playlists: [] };

/** Returns the config directory. In Tauri mode uses ZD_CONFIG_FILE's parent; in web mode uses ~/.zdmusic/ */
function getConfigDir(): string {
  const configFile = process.env.ZD_CONFIG_FILE || "";
  if (configFile) return dirname(configFile);
  return homedir() + "/.zdmusic";
}

/** Full path to the playlists.json file. */
function getPlaylistsPath(): string {
  const dir = getConfigDir();
  return dir ? `${dir}/playlists.json` : "";
}

/** Read playlists from disk. Returns empty store if file doesn't exist. */
export function readPlaylists(): PlaylistStore {
  const path = getPlaylistsPath();
  if (!path) return DEFAULT_STORE;
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf-8");
      return JSON.parse(raw) as PlaylistStore;
    }
  } catch (e) {
    console.error("[playlists] Failed to read:", e);
  }
  return DEFAULT_STORE;
}

/** Write playlists to disk. */
export function writePlaylists(store: PlaylistStore): boolean {
  const path = getPlaylistsPath();
  if (!path) return false;
  try {
    mkdirSync(getConfigDir(), { recursive: true });
    writeFileSync(path, JSON.stringify(store, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("[playlists] Failed to write:", e);
    return false;
  }
}

/** In-memory cache, cleared on each write so next read re-reads from disk. */
let _cachedStore: PlaylistStore | null = null;

/** Get cached playlists, reading from disk if needed. */
export function getPlaylists(): PlaylistStore {
  if (_cachedStore === null) {
    _cachedStore = readPlaylists();
  }
  return _cachedStore;
}

/** Persist playlists and refresh cache. */
export function savePlaylists(store: PlaylistStore): boolean {
  const ok = writePlaylists(store);
  if (ok) _cachedStore = store;
  return ok;
}

/** Generate a short unique ID for a new playlist. */
export function generatePlaylistId(): string {
  return "pl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

/** Get ISO timestamp string. */
export function now(): number {
  return Date.now();
}
