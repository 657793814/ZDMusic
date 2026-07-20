import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ─── 指纹数据库路径 ────────────────────────────────

const DB_FILE = "fingerprints.json";

function getDbDir(): string {
  const configFile = process.env.ZD_CONFIG_FILE || join(homedir(), ".zdmusic", "config.json");
  return join(configFile, "..");
}

function getDbPath(): string {
  return join(getDbDir(), DB_FILE);
}

// ─── 数据类型 ──────────────────────────────────────

export interface FingerprintEntry {
  trackId: string;
  title: string;
  artists: string;
  duration: number;          // fpcalc 报告的秒数
  fingerprint: string;       // fpcalc 输出 base64
  fileSize: number;
  lastModified: number;      // 文件 mtime ms
}

interface FingerprintDb {
  version: 1;
  updatedAt: number;
  entries: Record<string, FingerprintEntry>;
}

// ─── 读写数据库 ────────────────────────────────────

export function readFingerprintDb(): FingerprintDb {
  const dbPath = getDbPath();
  try {
    if (existsSync(dbPath)) {
      const raw = readFileSync(dbPath, "utf-8");
      const db = JSON.parse(raw) as FingerprintDb;
      return db;
    }
  } catch (e) {
    console.error("[Fingerprint] 读取指纹库失败:", e);
  }
  return { version: 1, updatedAt: 0, entries: {} };
}

export function writeFingerprintDb(db: FingerprintDb): void {
  const dbPath = getDbPath();
  writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf-8");
}

// ─── fpcalc 检测 ──────────────────────────────────

export function checkFpcalc(): boolean {
  try {
    execSync("fpcalc -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ─── 提取单个文件指纹 ─────────────────────────────

export function extractFingerprint(
  filePath: string,
): { duration: number; fingerprint: string } | null {
  try {
    const output = execSync(
      `fpcalc "${filePath}"`,
      { stdio: "pipe", timeout: 60000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    );
    const lines = output.trim().split("\n");
    let duration = 0;
    let fingerprint = "";
    for (const line of lines) {
      if (line.startsWith("DURATION=")) {
        duration = parseFloat(line.slice(9));
      } else if (line.startsWith("FINGERPRINT=")) {
        fingerprint = line.slice(12).trim();
      }
    }
    if (!fingerprint) return null;
    return { duration, fingerprint };
  } catch (e: any) {
    console.error("[Fingerprint] fpcalc 失败:", filePath, e.message);
    return null;
  }
}

// ─── 指纹匹配 ─────────────────────────────────────

function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >>> 24;
}

function decodeFingerprint(fp: string): number[] {
  const raw = Buffer.from(fp, "base64");
  // 对齐到 4 字节，防止 fpcalc 输出带额外字符导致 readInt32LE 越界
  const aligned = raw.slice(0, raw.length - (raw.length % 4));
  const result: number[] = [];
  for (let i = 0; i < aligned.length; i += 4) {
    result.push(aligned.readInt32LE(i));
  }
  return result;
}

/**
 * 比较两个 chromaprint 指纹的相似度
 * 滑动窗口 + 逐位匹配
 * 返回 0.0 - 1.0 的分数，>0.75 可认为匹配
 */
export function compareFingerprints(queryFp: string, candidateFp: string): number {
  const query = decodeFingerprint(queryFp);
  const candidate = decodeFingerprint(candidateFp);

  if (query.length === 0 || candidate.length === 0) return 0;

  // 短的是查询指纹，长的是候选项
  const shorter = query.length <= candidate.length ? query : candidate;
  const longer = query.length <= candidate.length ? candidate : query;

  const totalBits = shorter.length * 32;
  if (totalBits === 0) return 0;

  let bestBits = 0;

  for (let offset = 0; offset <= longer.length - shorter.length; offset++) {
    let matchBits = 0;
    for (let i = 0; i < shorter.length; i++) {
      const xor = shorter[i] ^ longer[offset + i];
      matchBits += 32 - popcount(xor);
    }
    if (matchBits > bestBits) bestBits = matchBits;
  }

  return bestBits / totalBits;
}

/**
 * 在指纹库中搜索最匹配的曲目
 */
export function searchInDatabase(
  queryFp: string,
  threshold = 0.75,
): { entry: FingerprintEntry; score: number } | null {
  const db = readFingerprintDb();
  let best: { entry: FingerprintEntry; score: number } | null = null;

  for (const entry of Object.values(db.entries)) {
    const score = compareFingerprints(queryFp, entry.fingerprint);
    if (score > (best?.score ?? 0)) {
      best = { entry, score };
    }
  }

  if (best && best.score >= threshold) return best;
  return null;
}
