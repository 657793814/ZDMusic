import { NextResponse } from "next/server";
import { readLibraryState } from "@/app/lib/library-store";
import { MUSIC_DIR, scanTracks } from "@/app/lib/tracks";

export const dynamic = "force-dynamic";

/** 曲库管理列表：在 /api/tracks/scan 的基础上补充时长、入库时间、覆盖标记。 */
export async function GET() {
  try {
    const tracks = await scanTracks();
    const state = readLibraryState();
    const tagPending = tracks.filter((track) => !state.entries[track.id]?.tagScannedAt).length;
    return NextResponse.json({
      tracks,
      hiddenCount: state.hidden.length,
      tagPending,
      overriddenCount: tracks.filter((track) => track.overridden).length,
      musicDir: MUSIC_DIR,
    });
  } catch (error) {
    console.error("[api/library/list] failed:", error);
    return NextResponse.json({ error: "读取曲库失败" }, { status: 500 });
  }
}
