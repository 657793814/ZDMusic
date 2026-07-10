import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import type { Playlist, PlaylistStore } from "./types";

const DEFAULT_STORE: PlaylistStore = { playlists: [] };

/**
 * Returns the canonical config directory.
 *
 * Order of precedence:
 * 1. ZD_CONFIG_FILE env var's parent dir (set by Rust in Tauri production mode)
 * 2. ~/.zdmusic/ (development / web mode fallback)
 *
 * In production (Tauri DMG):
 *   ZD_CONFIG_FILE = ~/Library/Application Support/com.zdmusic/config.json
 *   → config dir = ~/Library/Application Support/com.zdmusic/
 *   → playlists = ~/Library/Application Support/com.zdmusic/playlists.json
 *
 * In development (npm run dev):
 *   → config dir = ~/.zdmusic/
 *   → playlists = ~/.zdmusic/playlists.json
 */
function getConfigDir(): string {
  const configFile = process.env.ZD_CONFIG_FILE || "";
  if (configFile && configFile.length > 0) {
    const parent = dirname(configFile);
    // Ensure the directory exists
    mkdirSync(parent, { recursive: true });
    return parent;
  }
  // Fallback: ~/.zdmusic/
  const fallback = join(homedir(), ".zdmusic");
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

/** Full path to the playlists.json file. */
function getPlaylistsPath(): string {
  return join(getConfigDir(), "playlists.json");
}

/**
 * Old path where playlists may have been stored before introducing ZD_CONFIG_FILE.
 * We check this as a read-fallback and migrate on first write.
 */
function getOldPlaylistsPath(): string {
  return join(homedir(), ".zdmusic", "playlists.json");
}

/** Check if old playlists exist and migrate them to the new location. */
function tryMigrateFromOldPath(): void {
  const newPath = getPlaylistsPath();
  const oldPath = getOldPlaylistsPath();
  if (oldPath === newPath) return; // same location, no migration needed
  if (existsSync(newPath)) return; // already have data at new location
  if (!existsSync(oldPath)) return; // nothing to migrate
  try {
    // Copy old playlists to new location
    const configDir = getConfigDir();
    mkdirSync(configDir, { recursive: true });
    const data = readFileSync(oldPath, "utf-8");
    writeFileSync(newPath, data, "utf-8");
    console.log(`[playlists] Migrated from ${oldPath} to ${newPath}`);
  } catch (e) {
    console.error("[playlists] Migration failed:", e);
  }
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
    // Fallback: check if old path exists (before ZD_CONFIG_FILE era)
    const oldPath = getOldPlaylistsPath();
    if (oldPath !== path && existsSync(oldPath)) {
      const raw = readFileSync(oldPath, "utf-8");
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
    // Migrate from old path on first write (if exists)
    tryMigrateFromOldPath();
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
