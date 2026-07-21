import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createHmac } from "crypto";
import { clearConfigCache, getConfigVar } from "@/app/lib/config";
import { checkFpcalc, extractFingerprint, searchInDatabase } from "@/app/lib/fingerprint";

export const dynamic = "force-dynamic";

// ─── FFmpeg 检查 ────────────────────────────────────

function checkFfmpeg(): boolean {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ─── ACRCloud 签名 ──────────────────────────────────

function acrCloudSign(
  method: string,
  uri: string,
  accessKey: string,
  dataType: string,
  sigVersion: string,
  timestamp: number,
  accessSecret: string,
): string {
  const stringToSign = [
    method,
    uri,
    accessKey,
    dataType,
    sigVersion,
    String(timestamp),
  ].join("\n");
  return createHmac("sha1", accessSecret)
    .update(stringToSign)
    .digest("base64");
}

// ─── 通用：保存录音到临时文件 ─────────────────────

function saveAudio(audioBuffer: Buffer): { tmpDir: string; inputPath: string; pcmPath: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "zdmusic-mr-"));
  const inputPath = join(tmpDir, "input.webm");
  const pcmPath = join(tmpDir, "sample.wav");
  writeFileSync(inputPath, audioBuffer);
  execSync(
    `ffmpeg -y -i "${inputPath}" -ar 44100 -ac 1 -f wav "${pcmPath}"`,
    { stdio: "pipe", timeout: 30000 },
  );
  return { tmpDir, inputPath, pcmPath };
}

function cleanup(tmpDir: string, ...paths: string[]) {
  for (const p of paths) {
    try { unlinkSync(p); } catch {}
  }
  try { execSync(`rmdir "${tmpDir}"`, { stdio: "ignore" }); } catch {}
}

// ─── POST /api/music-recognize ──────────────────────

export async function POST(request: NextRequest) {
  const arrayBuffer = await request.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  if (audioBuffer.length < 2000) {
    return NextResponse.json({
      error: "音频数据过短，请录制更长时间（建议 10-15 秒）",
      track: null,
    });
  }

  if (!checkFfmpeg()) {
    return NextResponse.json({
      error: "系统缺少 ffmpeg，请安装: brew install ffmpeg",
      track: null,
    });
  }

  // 每次请求从文件重读配置（保证设置页改动即时生效）
  clearConfigCache();
  const mode = getConfigVar("MUSIC_RECOGNITION_MODE", "cloud");

  if (mode === "local") {
    return handleLocal(audioBuffer);
  }

  return handleCloud(audioBuffer);
}

// ─── Local 模式 ─────────────────────────────────────

async function handleLocal(audioBuffer: Buffer) {
  if (!checkFpcalc()) {
    return NextResponse.json({
      error: "本地识曲需要 fpcalc（chromaprint）: brew install chromaprint",
      mode: "local",
      track: null,
    });
  }

  let tmpDir = "";
  let inputPath = "";
  let pcmPath = "";

  try {
    const tmp = saveAudio(audioBuffer);
    tmpDir = tmp.tmpDir;
    inputPath = tmp.inputPath;
    pcmPath = tmp.pcmPath;

    // 提取录音指纹
    const queryFp = extractFingerprint(pcmPath);
    if (!queryFp || !queryFp.fingerprint) {
      return NextResponse.json({
        error: "无法提取录音指纹，请重试",
        mode: "local",
        track: null,
      });
    }

    // 搜索指纹库
    const match = searchInDatabase(queryFp.fingerprint, 0.6);
    if (!match) {
      return NextResponse.json({
        error: "未在本地曲库中找到匹配的歌曲",
        mode: "local",
        track: null,
      });
    }

    return NextResponse.json({
      error: null,
      local: true,
      score: match.score,
      track: {
        title: match.entry.title || "",
        artists: match.entry.artists || "",
        durationMs: Math.round(match.entry.duration * 1000),
        trackId: match.entry.trackId,
      },
    });
  } catch (e: any) {
    console.error("[MusicRecognize/Local] Failed:", e.message);
    return NextResponse.json({
      error: `本地识曲失败: ${e.message}`,
      mode: "local",
      track: null,
    });
  } finally {
    if (tmpDir) cleanup(tmpDir, inputPath, pcmPath);
  }
}

// ─── Cloud 模式 ────────────────────────────────────

async function handleCloud(audioBuffer: Buffer) {
  const accessKey = getConfigVar("ACRCLOUD_ACCESS_KEY");
  const accessSecret = getConfigVar("ACRCLOUD_ACCESS_SECRET");
  const host = getConfigVar("ACRCLOUD_HOST", "identify-cn-north-1.acrcloud.cn");

  if (!accessKey || !accessSecret) {
    return NextResponse.json({
      error: "听歌识曲未配置，请在设置页面配置 ACRCloud 密钥，或切换为本地模式",
      mode: "cloud",
      track: null,
    });
  }

  let tmpDir = "";
  let inputPath = "";
  let pcmPath = "";

  try {
    const tmp = saveAudio(audioBuffer);
    tmpDir = tmp.tmpDir;
    inputPath = tmp.inputPath;
    pcmPath = tmp.pcmPath;

    const pcmBuffer = readFileSync(pcmPath);

    // 构建 ACRCloud 请求
    const timestamp = Math.floor(Date.now() / 1000);
    const dataType = "audio";
    const sigVersion = "1";
    const signature = acrCloudSign(
      "POST", "/v1/identify", accessKey, dataType, sigVersion, timestamp, accessSecret,
    );

    const boundary = `----zdmusic${timestamp}`;
    const crlf = "\r\n";
    const parts: string[] = [];

    const appendField = (name: string, value: string) => {
      parts.push(
        `--${boundary}${crlf}Content-Disposition: form-data; name="${name}"${crlf}${crlf}${value}${crlf}`,
      );
    };

    appendField("access_key", accessKey);
    appendField("data_type", dataType);
    appendField("signature_version", sigVersion);
    appendField("signature", signature);
    appendField("sample_bytes", String(pcmBuffer.length));
    appendField("timestamp", String(timestamp));

    parts.push(
      `--${boundary}${crlf}Content-Disposition: form-data; name="sample"; filename="sample.wav"${crlf}Content-Type: audio/wav${crlf}${crlf}`,
    );

    const header = Buffer.from(parts.join(""), "utf-8");
    const footer = Buffer.from(`${crlf}--${boundary}--${crlf}`, "utf-8");
    const body = Buffer.concat([header, pcmBuffer, footer]);

    const acrRes = await fetch(`https://${host}/v1/identify`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
      signal: AbortSignal.timeout(20000),
    });

    const result = await acrRes.json();
    console.log("[MusicRecognize/Cloud] ACRCloud result:", JSON.stringify(result).slice(0, 500));

    if (result.status?.code !== 0) {
      return NextResponse.json({ error: result.status?.msg || "听歌识曲失败", mode: "cloud", track: null });
    }

    const music = result.metadata?.music?.[0];
    if (!music) {
      return NextResponse.json({ error: "未识别到歌曲", mode: "cloud", track: null });
    }

    return NextResponse.json({
      error: null,
      local: false,
      track: {
        title: music.title || "",
        artists: (music.artists || []).map((a: any) => a.name).join(", "),
        album: music.album?.name || "",
        durationMs: music.duration_ms || 0,
        acrId: music.acr_id || "",
        externalIds: music.external_ids || {},
        playOffsetMs: music.play_offset_ms || 0,
      },
    });
  } catch (e: any) {
    console.error("[MusicRecognize/Cloud] Failed:", e.message);
    return NextResponse.json({ error: `听歌识曲失败: ${e.message}`, mode: "cloud", track: null });
  } finally {
    if (tmpDir) cleanup(tmpDir, inputPath, pcmPath);
  }
}
