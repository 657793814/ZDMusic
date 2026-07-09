import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

export const dynamic = "force-dynamic";

function getConfigPath(): string {
  // Tauri 模式：由 Rust 通过 ZD_CONFIG_FILE 环境变量注入
  // Web 模式：fallback 到 ~/.zdmusic/config.json
  return process.env.ZD_CONFIG_FILE || join(homedir(), ".zdmusic", "config.json");
}

export async function GET() {
  const path = getConfigPath();
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf-8");
      return NextResponse.json(JSON.parse(raw));
    }
    return NextResponse.json({ music_dir: null, env_vars: {} });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const path = getConfigPath();
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
