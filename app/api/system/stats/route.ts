import { NextResponse } from "next/server";
import os from "os";

export const dynamic = "force-dynamic";

export async function GET() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const memPercent = Math.round((usedMem / totalMem) * 100);
  const memUsedGB = Number((usedMem / (1024 ** 3)).toFixed(1));
  const memTotalGB = Number((totalMem / (1024 ** 3)).toFixed(1));

  const cpus = os.cpus();
  const idle = cpus[0].times.idle;
  const total = Object.values(cpus[0].times).reduce((a, b) => a + b, 0);
  const cpuPercent = Math.round(((total - idle) / total) * 100);

  return NextResponse.json({
    mem: { usedGB: memUsedGB, totalGB: memTotalGB, usedPercent: memPercent },
    cpu: { percent: Math.max(0, Math.min(100, cpuPercent)) },
  });
}
