import { NextResponse } from "next/server";
import { scanTracks, MUSIC_DIR } from "@/app/lib/tracks";
import { readTags, TrackTags } from "@/app/lib/tags";
import path from "path";

export const dynamic = "force-dynamic";

interface EnrichedTrack {
  id: string;
  title: string;
  author: string;
  album: string;
  albumArtist: string;
  year: number;
  trackNumber: number;
  genre: string;
  coverDataUrl: string | null;
  duration: number;
  url: string;
}

interface AlbumGroup {
  album: string;
  albumArtist: string;
  coverDataUrl: string | null;
  year: number;
  tracks: EnrichedTrack[];
}

export async function GET() {
  const tracks = await scanTracks();

  const enriched: EnrichedTrack[] = [];

  for (const t of tracks) {
    // Construct the full file path
    const filePath = path.join(MUSIC_DIR, t.subDir, t.filename);
    const tags = readTags(filePath);

    enriched.push({
      id: t.id,
      title: tags?.title || t.title,
      author: t.author || tags?.artist || "",
      album: tags?.album || "",
      albumArtist: tags?.albumArtist || "",
      year: tags?.year || 0,
      trackNumber: tags?.trackNumber || 0,
      genre: tags?.genre || "",
      coverDataUrl: tags?.coverDataUrl || null,
      duration: tags?.duration || 0,
      url: t.url,
    });
  }

  // Group by album
  const albumMap = new Map<string, AlbumGroup>();
  for (const t of enriched) {
    const key = t.album || "未知专辑";
    if (!albumMap.has(key)) {
      albumMap.set(key, {
        album: key,
        albumArtist: t.albumArtist || t.author,
        coverDataUrl: t.coverDataUrl,
        year: t.year,
        tracks: [],
      });
    }
    const group = albumMap.get(key)!;
    group.tracks.push(t);
    // Use first track's cover for the album
    if (!group.coverDataUrl && t.coverDataUrl) {
      group.coverDataUrl = t.coverDataUrl;
    }
  }

  const albums = Array.from(albumMap.values());
  // Sort by year descending, then alphabetically
  albums.sort((a, b) => (b.year || 0) - (a.year || 0) || a.album.localeCompare(b.album));

  return NextResponse.json({ tracks: enriched, albums });
}
