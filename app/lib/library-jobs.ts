import { adoptMovedEntry, readLibraryState, resolveAddedAt, writeLibraryState } from "./library-store";
import { MUSIC_DIR, resolveMusicPath, scanFiles, type RawTrack } from "./tracks";
import { readTagSummary } from "./tags";

export type RescanMode = "all" | "single";

export type RescanIssue = { id: string; path: string; message: string };

export type RescanJob = {
  id: string;
  mode: RescanMode;
  total: number;
  processed: number;
  added: number;
  updated: number;
  missing: number;
  currentId: string | null;
  errors: RescanIssue[];
  done: boolean;
  startedAt: number;
  finishedAt?: number;
  message?: string;
};

const globalStore = globalThis as unknown as { __zdRescanJobs?: Map<string, RescanJob> };
const jobs: Map<string, RescanJob> = globalStore.__zdRescanJobs ?? new Map();
globalStore.__zdRescanJobs = jobs;

function createJob(mode: RescanMode): RescanJob {
  const job: RescanJob = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    total: 0,
    processed: 0,
    added: 0,
    updated: 0,
    missing: 0,
    currentId: null,
    errors: [],
    done: false,
    startedAt: Date.now(),
  };
  jobs.set(job.id, job);
  if (jobs.size > 20) {
    const first = jobs.keys().next().value;
    if (typeof first === "string") jobs.delete(first);
  }
  return job;
}

export function getRescanJob(id: string): RescanJob | null {
  return jobs.get(id) ?? null;
}

export function startRescan(mode: RescanMode, targetId?: string, keepHidden = false): RescanJob {
  const job = createJob(mode);
  void runRescan(job, targetId, keepHidden);
  return job;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function runRescan(job: RescanJob, targetId?: string, keepHidden = false): Promise<void> {
  try {
    const files = await scanFiles();
    const state = readLibraryState();
    const currentIds = new Set(files.map((file) => file.id));
    let targets: RawTrack[] = files;

    if (job.mode === "single") {
      if (!targetId) {
        job.message = "缺少曲目 id";
        job.done = true;
        job.finishedAt = Date.now();
        return;
      }
      targets = files.filter((file) => file.id === targetId);
      const unhidden = state.hidden.filter((id) => id !== targetId);
      if (unhidden.length !== state.hidden.length) state.hidden = unhidden;
      if (!targets.length) {
        job.missing = 1;
        job.message = "文件已不存在";
      }
    } else {
      // 整库重扫：默认清空 hidden，让「从曲库移除」的歌回到列表。
      // keepHidden 用于打开面板时的后台补标签：静默任务不能把用户删掉的歌悄悄加回来。
      if (!keepHidden) state.hidden = [];
      const now = Date.now();
      for (const [id, entry] of Object.entries(state.entries)) {
        if (currentIds.has(id)) continue;
        if (!entry.missingAt) {
          entry.missingAt = now;
          job.missing += 1;
        }
      }
      // 新增文件会在下面的逐曲处理里按来源优先级写入 addedAt
    }

    job.total = targets.length;

    for (const file of targets) {
      const filePath = resolveMusicPath(file.id) ?? "";
      const entry = state.entries[file.id];
      const wasKnown = !!entry;
      const changed =
        wasKnown && entry ? entry.size !== file.size || entry.mtimeMs !== file.mtimeMs : false;
      const needsTags = !wasKnown || changed || !entry?.tagScannedAt;

      if (!wasKnown) job.added += 1;
      else if (changed) job.updated += 1;

      if (!filePath) {
        job.errors.push({ id: file.id, path: "", message: "路径无效" });
        job.processed += 1;
        continue;
      }

      let summary = null;
      if (needsTags) {
        try {
          summary = readTagSummary(filePath);
        } catch (error) {
          job.errors.push({
            id: file.id,
            path: filePath,
            message: (error as Error)?.message || "读取标签失败",
          });
        }
      }

      const nextEntry = state.entries[file.id] ?? (() => {
        const adopted = adoptMovedEntry(state, file, currentIds);
        if (adopted) {
          adopted.size = file.size;
          adopted.mtimeMs = file.mtimeMs;
          delete adopted.missingAt;
          return adopted;
        }
        const resolved = resolveAddedAt(file.id, file.birthtimeMs, file.mtimeMs);
        return {
          size: file.size,
          mtimeMs: file.mtimeMs,
          addedAt: resolved.addedAt,
          addedAtSource: resolved.addedAtSource,
        };
      })();
      if (!nextEntry.addedAtSource) {
        // 旧索引一次性回填；已有记录的 addedAt 只有更可靠来源时才替换
        const resolved = resolveAddedAt(file.id, file.birthtimeMs, file.mtimeMs);
        if (resolved.addedAtSource !== "scan") nextEntry.addedAt = resolved.addedAt;
        nextEntry.addedAtSource = resolved.addedAtSource;
      }
      nextEntry.size = file.size;
      nextEntry.mtimeMs = file.mtimeMs;
      if (summary) {
        for (const key of ["duration", "tagTitle", "tagArtist", "tagAlbum"] as const) {
          delete nextEntry[key];
        }
        nextEntry.duration = summary.duration || undefined;
        nextEntry.tagTitle = summary.title || undefined;
        nextEntry.tagArtist = summary.artist || undefined;
        nextEntry.tagAlbum = summary.album || undefined;
        nextEntry.tagScannedAt = Date.now();
      }
      delete nextEntry.missingAt;
      state.entries[file.id] = nextEntry;

      job.processed += 1;
      job.currentId = file.id;
      await yieldToEventLoop();
    }

    writeLibraryState(state);
    job.done = true;
    job.finishedAt = Date.now();
  } catch (error) {
    job.errors.push({ id: "", path: "", message: (error as Error)?.message || "重扫失败" });
    job.done = true;
    job.finishedAt = Date.now();
  }
}

export { MUSIC_DIR };
