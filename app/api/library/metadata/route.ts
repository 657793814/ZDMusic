import { NextResponse } from "next/server";
import {
  readLibraryState,
  setOverride,
  writeLibraryState,
  type LibraryOverride,
} from "@/app/lib/library-store";
import { resolveMusicPath } from "@/app/lib/tracks";

export const dynamic = "force-dynamic";

/**
 * 元数据编辑只写本地覆盖表（library.json），不写回 mp3 ID3 tag：
 * 避免重编码/损坏原文件的风险，重新扫描后覆盖依然生效；传 clear=true 可恢复文件名解析。
 */
export async function PATCH(request: Request) {
  let body: { id?: string; title?: string; artist?: string; album?: string; clear?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "缺少曲目 id" }, { status: 400 });
  if (!resolveMusicPath(id)) return NextResponse.json({ error: "路径无效" }, { status: 400 });

  const state = readLibraryState();

  if (body.clear) {
    delete state.overrides[id];
  } else {
    const patch: LibraryOverride = {};
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.artist === "string") patch.artist = body.artist;
    if (typeof body.album === "string") patch.album = body.album;
    setOverride(state, id, patch);
  }

  if (!writeLibraryState(state)) {
    return NextResponse.json({ error: "写入本地覆盖表失败" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id,
    override: state.overrides[id] ?? null,
    storage: "~/.zdmusic/library.json（打包环境为 Application Support）",
  });
}
