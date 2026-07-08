import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export const dynamic = "force-dynamic";

function getConfigPath(): string {
  return process.env.ZD_CONFIG_FILE || "";
}

export async function GET() {
  const path = getConfigPath();
  if (!path) {
    return NextResponse.json({ error: "ZD_CONFIG_FILE not set" }, { status: 500 });
  }
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf-8");
      return NextResponse.json(JSON.parse(raw));
    }
    return NextResponse.json({ music_dir: null, env_vars: null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const path = getConfigPath();
  if (!path) {
    return NextResponse.json({ error: "ZD_CONFIG_FILE not set" }, { status: 500 });
  }
  try {
    const body = await request.json();
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
