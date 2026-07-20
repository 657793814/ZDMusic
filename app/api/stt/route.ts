import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getConfigVar } from "@/app/lib/config";

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

// ─── 阿里云 NLS Token ───────────────────────────────

async function getNlsToken(
  appKey: string,
  accessKeyId: string,
  accessKeySecret: string,
): Promise<string> {
  const auth = Buffer.from(`${accessKeyId}:${accessKeySecret}`).toString("base64");
  const res = await fetch(
    `https://nls-meta.cn-shanghai.aliyuncs.com/api/v1/chat/openapi/token?Appkey=${encodeURIComponent(appKey)}`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  if (!res.ok) {
    throw new Error(`Token API 返回 ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.Token) {
    throw new Error(`获取 NLS Token 失败: ${JSON.stringify(data)}`);
  }
  return data.Token;
}

// ─── POST /api/stt ──────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 读取配置
    const appKey = getConfigVar("ALIYUN_NLS_APP_KEY");
    const accessKeyId = getConfigVar("ALIYUN_ACCESS_KEY_ID");
    const accessKeySecret = getConfigVar("ALIYUN_ACCESS_KEY_SECRET");

    if (!appKey || !accessKeyId || !accessKeySecret) {
      return NextResponse.json(
        { text: null, error: "语音识别未配置，请在设置页面配置阿里云语音识别密钥" },
        { status: 400 },
      );
    }

    // 读取音频
    const arrayBuffer = await request.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    if (audioBuffer.length < 200) {
      return NextResponse.json(
        { text: null, error: "音频数据过短，请重新录音" },
        { status: 400 },
      );
    }

    // 检查 FFmpeg
    if (!checkFfmpeg()) {
      return NextResponse.json(
        { text: null, error: "系统缺少 ffmpeg，请安装: brew install ffmpeg" },
        { status: 500 },
      );
    }

    // 创建临时文件
    const tmpDir = mkdtempSync(join(tmpdir(), "zdmusic-stt-"));
    const inputPath = join(tmpDir, "input.webm");
    const outputPath = join(tmpDir, "output.pcm");

    try {
      writeFileSync(inputPath, audioBuffer);

      // 转换为 PCM 16kHz 单声道 16bit
      execSync(
        `ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 -f s16le "${outputPath}"`,
        { stdio: "pipe", timeout: 30000 },
      );

      const pcmBuffer = readFileSync(outputPath);

      // 获取 NLS Token
      const token = await getNlsToken(appKey, accessKeyId, accessKeySecret);

      // 调用阿里云一句话识别
      const params = new URLSearchParams({
        appkey: appKey,
        format: "pcm",
        sample_rate: "16000",
        enable_punctuation_prediction: "true",
        enable_inverse_text_normalization: "true",
      });

      const nlsRes = await fetch(
        `https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr?${params}`,
        {
          method: "POST",
          headers: {
            "X-NLS-Token": token,
            "Content-Type": "application/octet-stream",
          },
          body: pcmBuffer,
          signal: AbortSignal.timeout(15000),
        },
      );

      const result = await nlsRes.json();
      console.log("[STT] NLS result:", JSON.stringify(result));

      if (result.Status !== 20000000) {
        throw new Error(`NLS 识别错误 (${result.Status}): ${result.Message || JSON.stringify(result)}`);
      }

      return NextResponse.json({ text: result.Result || "", error: null });
    } finally {
      // 清理临时文件
      try { unlinkSync(inputPath); } catch {}
      try { unlinkSync(outputPath); } catch {}
      try { execSync(`rmdir "${tmpDir}"`, { stdio: "ignore" }); } catch {}
    }
  } catch (e: any) {
    console.error("[STT] Recognition failed:", e.message);
    return NextResponse.json(
      { text: null, error: `语音识别失败: ${e.message}` },
      { status: 500 },
    );
  }
}
