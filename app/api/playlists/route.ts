import { NextRequest, NextResponse } from "next/server";
import {
  getPlaylists,
  savePlaylists,
  generatePlaylistId,
  now,
} from "@/app/lib/playlists-store";
import { scanTracks } from "@/app/lib/tracks";
import { ALL_SONGS_PLAYLIST_ID, type Playlist } from "@/app/lib/types";

export const dynamic = "force-dynamic";

/** 系统伪歌单：不写进 playlists.json，内容每次由曲库扫描实时派生 */
async function buildAllSongsPlaylist(): Promise<Playlist> {
  const tracks = await scanTracks();
  return {
    id: ALL_SONGS_PLAYLIST_ID,
    name: "全部歌单",
    nameEn: "All Songs",
    description: "曲库里所有歌曲，随扫描自动更新",
    trackIds: tracks.map((track) => track.id),
    createdAt: 0,
    updatedAt: 0,
    system: true,
  };
}

/**
 * GET /api/playlists
 * Returns all playlists（第一项为只读的「全部歌单」）。
 */
export async function GET() {
  const store = getPlaylists();
  const all = await buildAllSongsPlaylist();
  return NextResponse.json({ playlists: [all, ...store.playlists] });
}

/**
 * POST /api/playlists
 * Actions:
 *   - { action: "create", name, nameEn } → create a new playlist
 *   - { action: "rename", id, name, nameEn } → rename a playlist
 *   - { action: "add", id, trackIds: string[] } → add tracks to playlist
 *   - { action: "remove", id, trackIds: string[] } → remove tracks from playlist
 *   - { action: "set", id, trackIds: string[] } → replace playlist tracks
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const store = getPlaylists();
    const action = body.action as string;

    if (body.id === ALL_SONGS_PLAYLIST_ID) {
      return NextResponse.json({ error: "「全部歌单」是系统歌单，不能修改" }, { status: 400 });
    }

    switch (action) {
      case "create": {
        const name = (body.name as string) || "新歌单";
        const nameEn = (body.nameEn as string) || "New Playlist";
        // Support custom ID (e.g., __favorites__)
        const customId = body.id as string | undefined;
        // If custom ID already exists, update name and return it
        if (customId) {
          const existing = store.playlists.find((p) => p.id === customId);
          if (existing) {
            if (body.name) existing.name = body.name as string;
            if (body.nameEn) existing.nameEn = body.nameEn as string;
            if (typeof body.description === "string") existing.description = body.description;
            existing.updatedAt = now();
            savePlaylists(store);
            return NextResponse.json({ ok: true, playlist: existing });
          }
        }
        const newPl: Playlist = {
          id: customId || generatePlaylistId(),
          name,
          nameEn,
          description: (body.description as string) || "",
          trackIds: [],
          createdAt: now(),
          updatedAt: now(),
        };
        store.playlists.push(newPl);
        savePlaylists(store);
        return NextResponse.json({ ok: true, playlist: newPl });
      }

      case "rename": {
        const id = body.id as string;
        const pl = store.playlists.find((p) => p.id === id);
        if (!pl) {
          return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
        }
        if (body.name) pl.name = body.name as string;
        if (body.nameEn) pl.nameEn = body.nameEn as string;
        if (typeof body.description === "string") pl.description = body.description;
        pl.updatedAt = now();
        savePlaylists(store);
        return NextResponse.json({ ok: true });
      }

      case "add": {
        const id = body.id as string;
        const trackIds = (body.trackIds as string[]) || [];
        const pl = store.playlists.find((p) => p.id === id);
        if (!pl) {
          return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
        }
        const existing = new Set(pl.trackIds);
        const fresh = trackIds.filter((tid) => !existing.has(tid));
        if (fresh.length > 0) {
          pl.trackIds.push(...fresh);
          pl.updatedAt = now();
          savePlaylists(store);
        }
        return NextResponse.json({ ok: true, added: fresh.length });
      }

      case "remove": {
        const id = body.id as string;
        const trackIds = new Set((body.trackIds as string[]) || []);
        const pl = store.playlists.find((p) => p.id === id);
        if (!pl) {
          return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
        }
        pl.trackIds = pl.trackIds.filter((tid) => !trackIds.has(tid));
        pl.updatedAt = now();
        savePlaylists(store);
        return NextResponse.json({ ok: true });
      }

      case "set": {
        const id = body.id as string;
        const trackIds = (body.trackIds as string[]) || [];
        const pl = store.playlists.find((p) => p.id === id);
        if (!pl) {
          return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
        }
        pl.trackIds = trackIds;
        pl.updatedAt = now();
        savePlaylists(store);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * DELETE /api/playlists?id=xxx
 * Delete a playlist.
 */
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    if (id === ALL_SONGS_PLAYLIST_ID) {
      return NextResponse.json({ error: "「全部歌单」是系统歌单，不能删除" }, { status: 400 });
    }
    const store = getPlaylists();
    const idx = store.playlists.findIndex((p) => p.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }
    store.playlists.splice(idx, 1);
    savePlaylists(store);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
