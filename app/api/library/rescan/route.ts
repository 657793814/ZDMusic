import { NextResponse } from "next/server";
import { getRescanJob, startRescan, type RescanMode } from "@/app/lib/library-jobs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { mode?: RescanMode; id?: string } = {};
  try {
    body = (await request.json()) as { mode?: RescanMode; id?: string };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (body.mode !== "all" && body.mode !== "single") {
    return NextResponse.json({ error: "mode 必须是 all 或 single" }, { status: 400 });
  }

  const job = startRescan(body.mode, body.id);
  return NextResponse.json({ jobId: job.id });
}

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "缺少 jobId" }, { status: 400 });
  const job = getRescanJob(jobId);
  if (!job) return NextResponse.json({ error: "任务不存在或已过期" }, { status: 404 });
  return NextResponse.json(job);
}
