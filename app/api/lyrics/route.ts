import { NextRequest } from "next/server";
import { readFile, writeFile, access } from "fs/promises";
import path from "path";
import { resolveMusicPath } from "@/app/lib/tracks";

export const dynamic = "force-dynamic";

interface LRCLibResult {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface LyricLine {
  time: number;    // seconds
  text: string;
}

interface LyricsResponse {
  title: string;
  artist: string;
  synced: LyricLine[];
  plain: string | null;
  duration: number;
  fromLocal?: boolean;
  notFound?: boolean;
}

/**
 * Parse LRC synced lyrics into structured array
 */
function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})[\.:](\d{2,3})\](.*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(lrc)) !== null) {
    const m = parseInt(match[1]!, 10);
    const s = parseInt(match[2]!, 10);
    const msStr = match[3]!;
    const ms = msStr.length === 3 ? parseInt(msStr, 10) : parseInt(msStr, 10) * 10;
    const time = m * 60 + s + ms / 1000;
    const text = match[4]?.trim() ?? "";
    if (text) {
      lines.push({ time, text });
    }
  }
  return lines;
}

// ── 本地 LRC 文件读写 ──

function lrcPathForTrack(trackId: string): string | null {
  // trackId = "20260606/filename.mp3"
  if (!trackId) return null;
  const fullPath = resolveMusicPath(trackId);
  if (!fullPath) return null;
  return fullPath.replace(/\.mp3$/i, ".lrc");
}

async function readLocalLRC(trackId: string): Promise<string | null> {
  const lrcFile = lrcPathForTrack(trackId);
  if (!lrcFile) return null;
  try {
    await access(lrcFile);
    const content = await readFile(lrcFile, "utf-8");
    return content || null;
  } catch {
    return null;
  }
}

async function saveLocalLRC(trackId: string, lrcContent: string): Promise<void> {
  const lrcFile = lrcPathForTrack(trackId);
  if (!lrcFile) return;
  try {
    await writeFile(lrcFile, lrcContent, "utf-8");
  } catch {
    // 不阻塞响应
  }
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title")?.trim();
  const artist = req.nextUrl.searchParams.get("artist")?.trim();
  const trackId = req.nextUrl.searchParams.get("track")?.trim(); // e.g. "20260606/filename.mp3"

  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  // ── 1. 先查本地 .lrc 文件 ──
  if (trackId) {
    const local = await readLocalLRC(trackId);
    if (local) {
      const lines = parseLRC(local);
      return Response.json({
        title,
        artist: artist ?? "",
        synced: lines,
        plain: null,
        duration: 0,
        fromLocal: true,
      });
    }
  }

  // ── 2. 本地没有，调用 LRCLIB ──
  try {
    const searchParams = new URLSearchParams();
    searchParams.set("track_name", title);
    if (artist) searchParams.set("artist_name", artist);

    const searchUrl = `https://lrclib.net/api/search?${searchParams.toString()}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "ZDMusic/1.0 (https://lanyuechuhai.com)",
        "Accept": "application/json",
      },
    });

    let rawLRC: string | null = null;
    let resultTitle = title;
    let resultArtist = artist ?? "";
    let resultDuration = 0;
    let plainLyrics: string | null = null;

    if (!searchRes.ok) {
      // 尝试只用歌名搜索降级
      if (artist) {
        const fbRes = await fetch(
          `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}`,
          { headers: { "User-Agent": "ZDMusic/1.0" } }
        );
        if (fbRes.ok) {
          const fbData = (await fbRes.json()) as LRCLibResult[];
          if (fbData.length > 0) {
            rawLRC = fbData[0]!.syncedLyrics;
            resultTitle = fbData[0]!.trackName;
            resultArtist = fbData[0]!.artistName;
            resultDuration = fbData[0]!.duration;
            plainLyrics = fbData[0]!.plainLyrics;
          }
        }
      }
    } else {
      const data = (await searchRes.json()) as LRCLibResult[];
      if (data.length > 0) {
        const exactMatch = artist
          ? data.find(
              (r) =>
                r.artistName.toLowerCase() === artist.toLowerCase() &&
                r.trackName.toLowerCase() === title.toLowerCase()
            )
          : null;
        const best = exactMatch ?? data[0]!;
        rawLRC = best.syncedLyrics;
        resultTitle = best.trackName;
        resultArtist = best.artistName;
        resultDuration = best.duration;
        plainLyrics = best.plainLyrics;
      }
    }

    if (!rawLRC) {
      return Response.json({
        title,
        artist: artist ?? "",
        synced: [],
        plain: null,
        duration: 0,
        notFound: true,
      });
    }

    // ── 3. 保存到本地 ──
    if (trackId && rawLRC) {
      await saveLocalLRC(trackId, rawLRC);
    }

    return Response.json({
      title: resultTitle,
      artist: resultArtist,
      synced: parseLRC(rawLRC),
      plain: plainLyrics,
      duration: resultDuration,
    });
  } catch (err) {
    return Response.json(
      {
        error: String(err),
        title,
        artist: artist ?? "",
        synced: [],
        plain: null,
        duration: 0,
      },
      { status: 502 }
    );
  }
}
