import { NextRequest } from "next/server";
import { execSync } from "child_process";
import { readFile, writeFile, access, unlink } from "fs/promises";
import { resolveMusicPath } from "@/app/lib/tracks";

export const dynamic = "force-dynamic";

const FFPROBE = "/opt/homebrew/bin/ffprobe";

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

type LyricsSource = "local" | "embedded" | "lrclib" | "custom" | "none";

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

/**
 * 歌词文件编码兜底：UTF-8 优先，出现替换字符再按 GBK 解码。
 * 国内大量 .lrc 是 GBK/GB18030 编码，直接按 UTF-8 读会整篇乱码。
 */
function decodeLyricsBuffer(buffer: Buffer): string {
  let text = buffer.toString("utf-8");
  if (!text.includes("\uFFFD")) return text.replace(/^\uFEFF/, "");
  try {
    text = new TextDecoder("gbk").decode(buffer);
  } catch {
    /* 运行环境不支持 GBK 时保留 UTF-8 结果 */
  }
  return text.replace(/^\uFEFF/, "");
}

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
    const buffer = await readFile(lrcFile);
    const content = decodeLyricsBuffer(buffer);
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

/** 读取内嵌歌词标签（ID3 USLT / TXXX:LYRICS 等，ffprobe 统一映射到 format.tags） */
function readEmbeddedLRC(trackId: string): string | null {
  const fullPath = resolveMusicPath(trackId);
  if (!fullPath) return null;
  try {
    const cmd = `${FFPROBE} -v quiet -print_format json -show_format ${JSON.stringify(fullPath)}`;
    const out = execSync(cmd, { timeout: 3000, encoding: "utf-8" });
    const tags = (JSON.parse(out).format?.tags ?? {}) as Record<string, string>;
    for (const [key, value] of Object.entries(tags)) {
      if (!/lyric|uslt|unsynced/i.test(key)) continue;
      if (typeof value === "string" && value.trim()) return value;
    }
    return null;
  } catch {
    return null;
  }
}

function buildPayload(
  raw: string,
  meta: { title: string; artist: string; duration: number },
  source: LyricsSource,
) {
  const synced = parseLRC(raw);
  return {
    title: meta.title,
    artist: meta.artist,
    synced,
    plain: synced.length ? null : raw.trim() || null,
    duration: meta.duration,
    source,
    hasTimestamps: synced.length > 0,
  };
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title")?.trim();
  const artist = req.nextUrl.searchParams.get("artist")?.trim();
  const trackId = req.nextUrl.searchParams.get("track")?.trim(); // e.g. "20260606/filename.mp3"

  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  // ── 1. 本地 .lrc 文件（用户自定义或之前从 LRCLib 缓存下来的）──
  if (trackId) {
    const local = await readLocalLRC(trackId);
    if (local) {
      const lines = parseLRC(local);
      if (lines.length) {
        return Response.json({ ...buildPayload(local, { title, artist: artist ?? "", duration: 0 }, "local"), fromLocal: true });
      }
      if (local.trim()) {
        return Response.json({ ...buildPayload(local, { title, artist: artist ?? "", duration: 0 }, "local"), fromLocal: true });
      }
    }
  }

  // ── 2. 内嵌歌词标签（ID3/USLT）──
  if (trackId) {
    try {
      const embedded = readEmbeddedLRC(trackId);
      if (embedded) {
        return Response.json(buildPayload(embedded, { title, artist: artist ?? "", duration: 0 }, "embedded"));
      }
    } catch {
      /* ignore */
    }
  }

  // ── 3. 本地没有，调用 LRCLIB ──
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
        plain: plainLyrics,
        duration: resultDuration,
        notFound: true,
        source: "none" as LyricsSource,
      });
    }

    // ── 4. 保存到本地，下次直接命中 ──
    if (trackId && rawLRC) {
      await saveLocalLRC(trackId, rawLRC);
    }

    return Response.json({
      ...buildPayload(rawLRC, { title: resultTitle, artist: resultArtist, duration: resultDuration }, "lrclib"),
      plain: plainLyrics,
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
        source: "none" as LyricsSource,
      },
      { status: 502 }
    );
  }
}

/** 保存自定义歌词（粘贴 / 导入 lrc）。内容不需要带时间戳，纯文本也能存。 */
export async function POST(req: NextRequest) {
  let body: { trackId?: string; content?: string };
  try {
    body = (await req.json()) as { trackId?: string; content?: string };
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const trackId = body.trackId?.trim();
  const content = body.content ?? "";
  if (!trackId) return Response.json({ error: "缺少 trackId" }, { status: 400 });
  if (!content.trim()) return Response.json({ error: "歌词内容为空" }, { status: 400 });
  const lrcFile = lrcPathForTrack(trackId);
  if (!lrcFile) return Response.json({ error: "曲目路径无效" }, { status: 400 });
  try {
    await writeFile(lrcFile, content, "utf-8");
  } catch (err) {
    return Response.json(
      { error: `写入失败：${(err as NodeJS.ErrnoException).message}` },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, path: lrcFile, synced: parseLRC(content).length });
}

/** 清除自定义 / 缓存的本地歌词 */
export async function DELETE(req: NextRequest) {
  let body: { trackId?: string };
  try {
    body = (await req.json()) as { trackId?: string };
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const trackId = body.trackId?.trim();
  if (!trackId) return Response.json({ error: "缺少 trackId" }, { status: 400 });
  const lrcFile = lrcPathForTrack(trackId);
  if (!lrcFile) return Response.json({ error: "曲目路径无效" }, { status: 400 });
  try {
    await access(lrcFile);
  } catch {
    return Response.json({ ok: true, removed: false });
  }
  try {
    await unlink(lrcFile);
  } catch (err) {
    return Response.json(
      { error: `删除失败：${(err as NodeJS.ErrnoException).message}` },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, removed: true });
}
