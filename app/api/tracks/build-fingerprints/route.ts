import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { resolve } from "path";
import { MUSIC_DIR, parseName } from "@/app/lib/tracks";
import {
  readFingerprintDb,
  writeFingerprintDb,
  extractFingerprint,
  checkFpcalc,
} from "@/app/lib/fingerprint";

export const dynamic = "force-dynamic";
export const maxDuration = 600; // 10 分钟超时

/**
 * POST /api/tracks/build-fingerprints
 *
 * 遍历本地曲库中所有音频文件，用 fpcalc 提取指纹，存到指纹库。
 * 已存在且文件未变更的跳过。
 */
export async function POST() {
  if (!checkFpcalc()) {
    return NextResponse.json(
      { error: "未安装 fpcalc，请执行: brew install chromaprint", built: 0, skipped: 0 },
      { status: 400 },
    );
  }

  if (!existsSync(MUSIC_DIR)) {
    return NextResponse.json(
      { error: `音乐目录不存在: ${MUSIC_DIR}`, built: 0, skipped: 0 },
      { status: 400 },
    );
  }

  const db = readFingerprintDb();
  const audioExtensions = new Set([".mp3", ".flac", ".wav", ".m4a", ".ogg", ".wma", ".aac"]);

  let built = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const dirs = await readdir(MUSIC_DIR, { withFileTypes: true });

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const subDir = dir.name;
      const dirPath = resolve(MUSIC_DIR, subDir);

      let files: string[];
      try {
        files = await readdir(dirPath);
      } catch {
        continue;
      }

      for (const filename of files) {
        const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
        if (!audioExtensions.has(ext)) continue;

        const trackId = `${subDir}/${filename}`;
        const filePath = resolve(dirPath, filename);

        let fileStat;
        try {
          fileStat = await stat(filePath);
        } catch {
          continue;
        }

        const mtime = fileStat.mtimeMs;
        const existing = db.entries[trackId];

        // 已存在且未变更 → 跳过
        if (existing && existing.lastModified === mtime && existing.fileSize === fileStat.size) {
          skipped++;
          continue;
        }

        const result = extractFingerprint(filePath);
        if (!result) {
          errors++;
          continue;
        }

        // 先解析文件名
        const baseName = filename.replace(/\.[^.]+$/, "");
        const parsed = parseName(baseName);

        db.entries[trackId] = {
          trackId,
          title: parsed.title,
          artists: parsed.author,
          duration: result.duration,
          fingerprint: result.fingerprint,
          fileSize: fileStat.size,
          lastModified: mtime,
        };

        built++;
      }
    }

    db.updatedAt = Date.now();
    writeFingerprintDb(db);

    return NextResponse.json({
      built,
      skipped,
      errors,
      total: Object.keys(db.entries).length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `指纹索引失败: ${e.message}`, built, skipped, errors },
      { status: 500 },
    );
  }
}
