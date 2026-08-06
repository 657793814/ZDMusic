import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { readEffectiveConfig } from "@/app/lib/config";

export const dynamic = "force-dynamic";

function getConfigPath(): string {
  // Tauri 模式：由 Rust 通过 ZD_CONFIG_FILE 环境变量注入
  // Web 模式：fallback 到 ~/.zdmusic/config.json
  return process.env.ZD_CONFIG_FILE || join(homedir(), ".zdmusic", "config.json");
}

export async function GET() {
  // 返回合并后的有效配置（用户保存的本地配置优先，打包配置兜底），
  // 保证设置界面显示的值与运行时实际使用的值一致
  try {
    return NextResponse.json(readEffectiveConfig());
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

    // 也同步写入 ~/.zdmusic/config.json，保证两边配置一致
    const fallbackDir = join(homedir(), ".zdmusic");
    mkdirSync(fallbackDir, { recursive: true });
    const fallbackPath = join(fallbackDir, "config.json");
    writeFileSync(fallbackPath, JSON.stringify(body, null, 2), "utf-8");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
