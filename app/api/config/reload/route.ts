import { NextResponse } from "next/server";
import { clearConfigCache } from "@/app/lib/config";

export const dynamic = "force-dynamic";

// Global reload counter — modules check this against their own version
let _configVersion = 1;

export function getConfigVersion(): number {
  return _configVersion;
}

export async function POST() {
  _configVersion++;
  clearConfigCache();
  console.log("[config/reload] Config reloaded, version =", _configVersion);
  return NextResponse.json({ ok: true, version: _configVersion });
}
