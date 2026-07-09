import { NextRequest, NextResponse } from "next/server";
import {
  readHistory,
  writeHistory,
  recordPlay,
  getRecentTrackIds,
  getFrequentTrackIds,
} from "@/app/lib/play-history";

export const dynamic = "force-dynamic";

/**
 * GET /api/play-history
 * Query params:
 *   - action: "recent" (default days=7) | "frequent" (default limit=20)
 *   - days: number (for recent)
 *   - limit: number (for frequent)
 *
 * Returns: { action, data }
 */
export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action") || "recent";

  switch (action) {
    case "recent": {
      const days = parseInt(request.nextUrl.searchParams.get("days") || "7", 10);
      const ids = getRecentTrackIds(days);
      return NextResponse.json({
        action: "recent",
        days,
        trackIds: [...ids],
        count: ids.size,
      });
    }

    case "frequent": {
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
      const ids = getFrequentTrackIds(limit);
      return NextResponse.json({
        action: "frequent",
        limit,
        trackIds: ids,
        count: ids.length,
      });
    }

    case "all": {
      const history = readHistory();
      return NextResponse.json({
        action: "all",
        totalRecords: history.records.length,
        records: history.records.slice(-100),
      });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}

/**
 * POST /api/play-history
 * Body:
 *   { trackId: string, completed?: boolean }
 *
 * Records a play event. completed defaults to false.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { trackId?: string; completed?: boolean };

    if (!body.trackId || typeof body.trackId !== "string") {
      return NextResponse.json({ error: "Missing or invalid trackId" }, { status: 400 });
    }

    recordPlay(body.trackId, body.completed === true);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * DELETE /api/play-history
 * Clears all play history records.
 */
export async function DELETE() {
  writeHistory({ records: [] });
  return NextResponse.json({ ok: true });
}
