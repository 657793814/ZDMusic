import { NextResponse } from "next/server";
import {
  readLibraryState,
  removeRecord,
  setHidden,
  trashFile,
  writeLibraryState,
} from "@/app/lib/library-store";
import { prunePlayerState } from "@/app/lib/player-state-store";
import { getPlaylists, savePlaylists } from "@/app/lib/playlists-store";
import { resolveMusicPath } from "@/app/lib/tracks";

export const dynamic = "force-dynamic";

type BulkAction = "remove" | "trash";

type BulkResult = {
  id: string;
  ok: boolean;
  path?: string;
  error?: string;
};

const MAX_IDS = 200;

export async function POST(request: Request) {
  let body: { action?: BulkAction; ids?: string[] } = {};
  try {
    body = (await request.json()) as { action?: BulkAction; ids?: string[] };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (body.action !== "remove" && body.action !== "trash") {
    return NextResponse.json({ error: "action 必须是 remove 或 trash" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.filter((id): id is string => typeof id === "string" && !!id)))
    : [];
  if (!ids.length) return NextResponse.json({ error: "ids 不能为空" }, { status: 400 });
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `一次最多处理 ${MAX_IDS} 首` }, { status: 400 });
  }

  const state = readLibraryState();
  const results: BulkResult[] = [];
  const affected: string[] = [];

  for (const id of ids) {
    const fullPath = resolveMusicPath(id);
    if (!fullPath) {
      results.push({ id, ok: false, error: "路径无效" });
      continue;
    }

    if (body.action === "remove") {
      setHidden(state, [id]);
      affected.push(id);
      results.push({ id, ok: true, path: fullPath });
      continue;
    }

    const outcome = await trashFile(fullPath);
    if (!outcome.ok) {
      results.push({ id, ok: false, path: fullPath, error: outcome.error });
      continue;
    }

    removeRecord(state, id);
    affected.push(id);
    results.push({ id, ok: true, path: outcome.trashedTo });
  }

  const stateChanged = affected.length > 0;
  if (stateChanged) writeLibraryState(state);
  if (affected.length) {
    prunePlayerState(affected);
    // 曲目已移出曲库/删除文件，同步清理各歌单里的引用，避免歌单数量与列表不一致
    const removedIds = new Set(affected);
    const store = getPlaylists();
    let touched = false;
    for (const playlist of store.playlists) {
      const next = playlist.trackIds.filter((id) => !removedIds.has(id));
      if (next.length !== playlist.trackIds.length) {
        playlist.trackIds = next;
        playlist.updatedAt = Date.now();
        touched = true;
      }
    }
    if (touched) savePlaylists(store);
  }

  const succeeded = results.filter((item) => item.ok).length;
  return NextResponse.json({
    action: body.action,
    results,
    summary: { total: results.length, succeeded, failed: results.length - succeeded },
  });
}
