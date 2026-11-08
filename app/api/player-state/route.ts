import { NextRequest } from "next/server";
import { readPlayerState, writePlayerState } from "@/app/lib/player-state-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(readPlayerState());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ok = writePlayerState(body);
    return Response.json({ ok }, { status: ok ? 200 : 500 });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
