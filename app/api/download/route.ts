import { NextRequest } from "next/server";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { basename, extname, join } from "path";
import { resolveMusicPath } from "@/app/lib/tracks";

export const dynamic = "force-dynamic";

const DOWNLOAD_DIR =
  process.env.ZD_DOWNLOAD_DIR || join(homedir(), "Downloads", "ZDMusic");

function uniqueTarget(dir: string, filename: string): string {
  const ext = extname(filename);
  const base = basename(filename, ext);
  let candidate = join(dir, filename);
  let index = 1;
  while (existsSync(candidate)) {
    candidate = join(dir, `${base} (${index})${ext}`);
    index += 1;
  }
  return candidate;
}

/** 把已扫描曲目复制到本地下载目录（默认 ~/Downloads/ZDMusic）。
 *  单次只处理一首，前端按首循环以便展示进度。 */
export async function POST(req: NextRequest) {
  let body: { trackId?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const trackId = body.trackId;
  if (typeof trackId !== "string" || !trackId.trim()) {
    return Response.json({ ok: false, error: "trackId is required" }, { status: 400 });
  }

  const source = resolveMusicPath(trackId);
  if (!source || !existsSync(source)) {
    return Response.json({ ok: false, error: "源文件不存在" }, { status: 404 });
  }

  try {
    mkdirSync(DOWNLOAD_DIR, { recursive: true });
    const target = uniqueTarget(DOWNLOAD_DIR, basename(source));
    copyFileSync(source, target);
    return Response.json({ ok: true, dir: DOWNLOAD_DIR, path: target });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
