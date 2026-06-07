import { NextRequest } from "next/server";
import { readdir, stat } from "fs/promises";
import path from "path";
import { MUSIC_DIR, parseName, scanTracks } from "@/app/lib/tracks";
import type { Track } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const subDir = req.nextUrl.searchParams.get("subDir")?.trim();

  // 无 subDir → 全量扫描
  if (!subDir) {
    const all = await scanTracks();
    return Response.json({ tracks: all });
  }

  // 有 subDir → 扫描特定子目录
  const dirPath = path.resolve(MUSIC_DIR, subDir);
  const normalizedMusicDir = path.normalize(MUSIC_DIR + path.sep);
  if (!dirPath.startsWith(normalizedMusicDir)) {
    return Response.json({ error: "invalid subDir" }, { status: 403 });
  }

  const tracks: Track[] = [];
  let files;
  try {
    files = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return Response.json({ tracks });
  }

  for (const f of files) {
    if (f.isDirectory() || !f.name.toLowerCase().endsWith(".mp3")) continue;

    const filePath = path.join(dirPath, f.name);
    let size = 0;
    try {
      const s = await stat(filePath);
      size = s.size;
    } catch { /* ignore */ }

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
      ...(bvid ? { bvid } : {}),
      url: `/api/tracks/${encodeURIComponent(subDir)}/${encodeURIComponent(f.name)}`,
    });
  }

  return Response.json({ tracks });
}
