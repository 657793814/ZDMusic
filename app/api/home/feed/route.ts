import { NextRequest, NextResponse } from "next/server";
import { scanTracks } from "@/app/lib/tracks";
import { getDailyPicks, getListeningProfile, getLocalPicks } from "@/app/lib/recommend";

export const dynamic = "force-dynamic";

/**
 * GET /api/home/feed
 * 首页数据源：每日推荐、本地推荐（原平台推荐）、听歌画像。
 * 全部基于本地曲库与本地播放历史，不请求任何平台接口。
 *
 * Query:
 *   - rotate=1  每日推荐“换一批”（同一天内默认结果稳定）
 */
export async function GET(request: NextRequest) {
  const rotate = request.nextUrl.searchParams.get("rotate") === "1";

  try {
    const tracks = await scanTracks();
    return NextResponse.json({
      daily: getDailyPicks(tracks, 8, rotate),
      local: getLocalPicks(tracks, 8),
      profile: getListeningProfile(tracks),
      libraryCount: tracks.length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
