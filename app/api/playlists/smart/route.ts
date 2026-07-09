import { NextResponse } from "next/server";
import { scanTracks } from "@/app/lib/tracks";
import { getFrequentTrackIds } from "@/app/lib/play-history";

export const dynamic = "force-dynamic";

interface SmartPlaylist {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  trackIds: string[];
}

/**
 * GET /api/playlists/smart
 * Generates auto playlists:
 *   - "最近添加" (Recently Added) — 20 newest tracks by date
 *   - "高频播放" (Top Played) — 20 most played tracks
 *   - "随机混搭" (Random Mix) — 30 random tracks
 */
export async function GET() {
  try {
    const allTracks = await scanTracks();
    if (!allTracks.length) {
      return NextResponse.json({ playlists: [] });
    }

    const playlists: SmartPlaylist[] = [];

    // 1. "最近添加" - Recently Added (20 newest by parsed date)
    const sortedByDate = [...allTracks].sort((a, b) => {
      // Sort by date descending; tracks without date go last
      const aDate = a.date || "0000-00-00";
      const bDate = b.date || "0000-00-00";
      return bDate.localeCompare(aDate);
    });
    const recentIds = sortedByDate.slice(0, 20).map((t) => t.id);
    playlists.push({
      id: "smart_recent",
      name: "最近添加",
      nameEn: "Recently Added",
      description: "按添加日期排序的最新 20 首歌曲",
      descriptionEn: "20 newest tracks by date added",
      trackIds: recentIds,
    });

    // 2. "高频播放" - Top Played (20 most played)
    const frequentIds = getFrequentTrackIds(20);
    // Filter to only include tracks that actually exist
    const existingIds = new Set(allTracks.map((t) => t.id));
    const validFrequent = frequentIds.filter((id) => existingIds.has(id));
    playlists.push({
      id: "smart_frequent",
      name: "高频播放",
      nameEn: "Top Played",
      description: "播放次数最多的 20 首歌曲",
      descriptionEn: "20 most played tracks",
      trackIds: validFrequent,
    });

    // 3. "随机混搭" - Random Mix (30 random tracks)
    const shuffled = [...allTracks].sort(() => Math.random() - 0.5);
    const randomIds = shuffled.slice(0, 30).map((t) => t.id);
    playlists.push({
      id: "smart_random",
      name: "随机混搭",
      nameEn: "Random Mix",
      description: "30 首随机混搭歌曲",
      descriptionEn: "30 random tracks",
      trackIds: randomIds,
    });

    return NextResponse.json({ playlists });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
