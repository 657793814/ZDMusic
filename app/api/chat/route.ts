import OpenAI from "openai";
import { NextRequest } from "next/server";
import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { MUSIC_DIR } from "@/app/lib/tracks";
import { getConfigVar } from "@/app/lib/config";
import { getConfigVersion } from "@/app/api/config/reload/route";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ============================================================
// OpenAI Client — 对接 Agnes/DeepSeek 等 OpenAI 风格服务商
// 懒加载: 避免 module 加载时因无 API Key 抛出异常导致整个路由 500
// ============================================================
const MODEL = "agnes-2.0-flash";

let _client: OpenAI | null = null;
let _clientVersion = 0;
function getClient(): OpenAI {
  const version = getConfigVersion();
  if (!_client || version !== _clientVersion) {
    _client = new OpenAI({
      baseURL: getConfigVar("ANTHROPIC_BASE_URL", "https://apihub.agnes-ai.com/v1"),
      apiKey: getConfigVar("ANTHROPIC_API_KEY", ""),
    });
    _clientVersion = version;
  }
  return _client;
}

// ============================================================
// System Prompts
// ============================================================
const BASE_PROMPT = `你是 ZDMusic 的 AI 音频助手。保持简洁的中文终端风格语气。

## 重要限制
- 所有搜索和操作必须通过可用的函数工具完成
- **严禁**安装任何外部工具或依赖，遇到工具缺失或命令失败时，如实告知用户并停止操作，等待用户指示`;

const LOCAL_PROMPT = `${BASE_PROMPT}

## 本地曲库搜索

使用 search_tracks(q, limit=20)。API 对 title/author/filename 做模糊匹配，直接返回 JSON。
- 结果 total>0 即命中，直接推荐
- 简繁体差异先判断再决定是否搜两次，合并去重后返回
- 输出用 \`\`\`tracks 代码块，字段必须原样复制 id/title/author/url，禁止修改`;

const CLOUD_PROMPT = `${BASE_PROMPT}

## B站云端搜索

使用 search_bilibili(keyword) 搜B站，结果 JSON 包含 bvid/title/author/duration/play。
- 筛选最相关 5-10 条，用 \`\`\`tracks 输出，对象必须含 bvid/title/author/duration/url
- 用户要转换时调用 convert_bilibili_videos(bvids, titles?)，函数自动下载→扫描→返回新 tracks
- 转换结果用 \`\`\`added 输出，直接复制函数返回的 JSON 对象，不要修改`;

// ============================================================
// Tool Definitions
// ============================================================
const LOCAL_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_tracks",
      description: "搜索本地曲库中的音乐文件，支持按标题/作者/文件名模糊匹配",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description:
              "搜索关键词，对 title、author、filename 做模糊匹配。传空字符串可获取全部曲库",
          },
          limit: {
            type: "integer",
            description: "返回结果数量上限，默认20",
          },
        },
        required: ["q"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

const CLOUD_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_bilibili",
      description: "在B站搜索视频（音乐、科普、课程、演讲、访谈、纪录片等各类内容）",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "搜索关键词",
          },
        },
        required: ["keyword"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "convert_bilibili_videos",
      description:
        "将B站视频批量转为MP3音频文件。自动完成下载、重命名、扫描的完整流程，返回新增的 tracks 列表",
      parameters: {
        type: "object",
        properties: {
          bvids: {
            type: "array",
            items: { type: "string" },
            description: "B站视频BV号数组",
          },
          titles: {
            type: "array",
            items: { type: "string" },
            description: "与 bvids 一一对应的视频标题（可选，不传则自动从下载文件名提取）",
          },
        },
        required: ["bvids"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

// ============================================================
// Tool Execution
// ============================================================
/** 从 NextRequest 提取当前服务 base URL */
function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = req.nextUrl.protocol; // "http:" or "https:"
  return `${protocol}//${host}`;
}

async function searchTracks(baseUrl: string, q: string, limit?: number): Promise<string> {
  const params = new URLSearchParams();
  params.set("q", q);
  if (limit) params.set("limit", String(limit));
  const res = await fetch(`${baseUrl}/api/search?${params}`);
  const data = await res.json();
  return JSON.stringify(data);
}

async function searchBilibili(baseUrl: string, keyword: string): Promise<string> {
  const params = new URLSearchParams();
  params.set("keyword", keyword);
  const res = await fetch(`${baseUrl}/api/bili/search?${params}`);
  const data = await res.json();
  return JSON.stringify(data);
}

async function convertBilibiliVideos(baseUrl: string, bvids: string[], titles?: string[]): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const biliDir = join(MUSIC_DIR, today);

  mkdirSync(biliDir, { recursive: true });

  // 1. Record before state
  const beforeFiles = new Set(existsSync(biliDir) ? readdirSync(biliDir) : []);

  // 2. Write BV-to-title mapping
  const safeTitles = titles ?? [];
  const bvMapLines = bvids.map((bv, i) => `${bv}|${safeTitles[i] || ""}`);
  writeFileSync("/tmp/bili_bv_map.txt", bvMapLines.join("\n"));

  // 3. Run bv2mp3 to download
  const urlArgs = bvids.map((bv) => `--url="https://www.bilibili.com/video/${bv}"`).join(" ");
  console.log(`[convertBilibiliVideos] Downloading to ${biliDir}: ${urlArgs}`);
  try {
    const nodeBin = process.execPath; // use same Node.js as the server itself
    const bv2mp3Path = resolve(process.cwd(), "node_modules/bv2mp3/src/index.js");
    execSync(`cd ${biliDir} && ${nodeBin} ${bv2mp3Path} ${urlArgs}`, {
      stdio: "pipe",
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        CLACK_HIDE: "1",
      },
    });
  } catch (e: any) {
    console.error(`[convertBilibiliVideos] bv2mp3 failed:`, e.stderr?.toString() || e.message);
    throw new Error(`bv2mp3 下载失败: ${e.stderr?.toString() || e.message}`);
  }

  // 4. 给下载的文件附加 BV 号到文件名尾部，方便后续匹配
  console.log(`[convertBilibiliVideos] Download complete, scanning files...`);
  const afterFiles = readdirSync(biliDir);
  const newFiles = afterFiles.filter((f) => !beforeFiles.has(f));
  console.log(`[convertBilibiliVideos] New files:`, newFiles);

  for (const file of newFiles) {
    const matchedBv = bvids.find((bv) => file.includes(bv));
    if (!matchedBv) continue;
    // 文件可能已有 bvid 后缀，或没有
    if (file.includes(`_BV${matchedBv}`)) continue;
    const base = file.replace(/\.mp3$/i, "");
    const newName = `${base}_BV${matchedBv}.mp3`;
    try {
      renameSync(join(biliDir, file), join(biliDir, newName));
    } catch {
      // ignore rename errors
    }
  }

  // 5. Scan for track metadata
  console.log(`[convertBilibiliVideos] Scanning ${baseUrl}/api/tracks/scan?subDir=${today}`);
  const scanRes = await fetch(`${baseUrl}/api/tracks/scan?subDir=${today}`);
  if (!scanRes.ok) {
    const scanText = await scanRes.text();
    throw new Error(`扫描曲库失败 (${scanRes.status}): ${scanText}`);
  }
  const scanData: any = await scanRes.json();
  const scanTracks: any[] = scanData.tracks || [];
  console.log(`[convertBilibiliVideos] Scan returned ${scanTracks.length} tracks`);

  // 7. 匹配下载的文件，关联 bvid 并返回
  // 优先找本次新增的文件；若无新增，则匹配目录中已有的文件（重试场景）
  const finalNewFiles = readdirSync(biliDir).filter((f) => !beforeFiles.has(f));
  const hasNewFiles = finalNewFiles.length > 0;
  const relevantFiles = hasNewFiles
    ? finalNewFiles
    : readdirSync(biliDir).filter((f) => f.endsWith(".mp3"));

  const added = scanTracks
    .filter((t: any) => t.filename && relevantFiles.includes(t.filename))
    .map((t: any) => {
      const matchedBv = bvids.find(
        (bv) => t.filename?.includes(bv) || t.title?.includes(bv)
      );
      if (matchedBv) t.bvid = matchedBv;
      return t;
    });

  if (!hasNewFiles && added.length === 0) {
    // 极端兜底：扫描结果没匹配上，直接按文件名匹配 BV 构造 track
    console.log(`[convertBilibiliVideos] No scan match, building from filenames...`);
    const allMp3 = readdirSync(biliDir).filter((f) => f.endsWith(".mp3"));
    for (const f of allMp3) {
      const matchedBv = bvids.find((bv) => f.includes(bv));
      if (!matchedBv) continue;
      const baseName = f.replace(/\.mp3$/i, "");
      added.push({
        id: `${today}/${f}`,
        title: baseName,
        author: "",
        date: today.slice(0, 4) + "-" + today.slice(4, 6) + "-" + today.slice(6, 8),
        filename: f,
        subDir: today,
        size: 0,
        bvid: matchedBv,
        url: `/api/tracks/${encodeURIComponent(today)}/${encodeURIComponent(f)}`,
      });
    }
  }

  // 8. 为下载的文件获取歌词并保存 .lrc
  const lrcPromises = added.map(async (track: any) => {
    try {
      const keywords = (track.title || track.filename || "")
        .replace(/\.mp3$/i, "")
        .replace(/【[^】]*】/g, "")
        .replace(/^\s*[-—|]+\s*/g, "")
        .trim();

      let songTitle = keywords;
      let songArtist = "";
      const bracketMatch = keywords.match(/《([^》]+)》/);
      if (bracketMatch) {
        const content = bracketMatch[1]!;
        const dashIdx = content.search(/[-—–]/);
        songTitle = dashIdx > 1 ? content.slice(0, dashIdx).trim() : content;
        const beforeBracket = keywords.split(/《/)[0]?.trim() || "";
        songArtist = beforeBracket.replace(/^【[^】]*】/g, "").replace(/[-—|\s]+$/, "").trim();
      }

      if (!songTitle) return;

      const params = new URLSearchParams({ track_name: songTitle });
      if (songArtist) params.set("artist_name", songArtist);

      const searchRes = await fetch(`https://lrclib.net/api/search?${params}`, {
        headers: { "User-Agent": "ZDMusic/1.0" },
      });
      if (!searchRes.ok) return;

      const results: any[] = await searchRes.json();
      if (!results.length) return;

      const best = songArtist
        ? results.find(
            (r) =>
              r.artistName.toLowerCase() === songArtist.toLowerCase() &&
              r.trackName.toLowerCase() === songTitle.toLowerCase()
          ) ?? results[0]
        : results[0];

      if (best?.syncedLyrics) {
        const mp3Path = join(biliDir, track.filename);
        const lrcPath = mp3Path.replace(/\.mp3$/i, ".lrc");
        writeFileSync(lrcPath, best.syncedLyrics, "utf-8");
        console.log(`[lyrics] Saved: ${lrcPath}`);
      }
    } catch {
      // 不阻塞
    }
  });
  await Promise.allSettled(lrcPromises);

  return JSON.stringify({ status: "completed", tracks: added }, null, 2);
}

async function executeTool(baseUrl: string, name: string, args: any): Promise<string> {
  switch (name) {
    case "search_tracks":
      return searchTracks(baseUrl, args.q, args.limit);
    case "search_bilibili":
      return searchBilibili(baseUrl, args.keyword);
    case "convert_bilibili_videos":
      return convertBilibiliVideos(baseUrl, args.bvids, args.titles);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ============================================================
// SSE Event Helpers
// ============================================================
function sseEvent(sessionId: string, data: Record<string, unknown>) {
  return { session_id: sessionId, ...data };
}

// ============================================================
// Route Handler
// ============================================================
export async function POST(req: NextRequest) {
  const { message, mode, history } = await req.json();

  const startTime = Date.now();
  const msgPreview = (message || "").slice(0, 60);
  const historyCount = Array.isArray(history) ? history.length : 0;
  console.log(`[Chat] >>> 收到请求 | mode=${mode} | msg="${msgPreview}" | history=${historyCount}条`);

  // 检查 API Key 是否已配置
  const apiKey = getConfigVar("ANTHROPIC_API_KEY", "");
  const baseURL = getConfigVar("ANTHROPIC_BASE_URL", "https://apihub.agnes-ai.com/v1");
  console.log(`[Chat] 配置: model=${MODEL} | baseURL=${baseURL} | apiKey=${apiKey ? "✓ " + apiKey.slice(0, 8) + "..." : "✗ 未配置"}`);
  if (!apiKey) {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: "❌ AI API Key 未配置。请在设置页面填入 API Key 后再试" })}\n\n`
          )
        );
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({ status: "error" })}\n\n`
          )
        );
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  if (!message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const systemPrompt = mode === "cloud" ? CLOUD_PROMPT : LOCAL_PROMPT;

  // Build conversation history context for the prompt
  let historyContext = "";
  if (Array.isArray(history) && history.length > 0) {
    const lines = history
      .filter(
        (m: { role: string; content: string }) =>
          m.role === "agent" || m.role === "operator"
      )
      .slice(-16)
      .map((m: { role: string; content: string }) =>
        `${m.role === "operator" ? "用户" : "助手"}: ${m.content}`
      );
    historyContext =
      `\n\n## 对话历史（最近${lines.length}条）\n` +
      lines.join("\n") +
      "\n---\n";
  }

  const fullPrompt = historyContext + message;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const baseUrl = getBaseUrl(req);

      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        send("status", { stage: "starting", detail: "连接 AI 服务..." });

        console.log(`[Chat] AI 流程开始 | 已过 ${Date.now() - startTime}ms`);

        const availableTools = mode === "cloud" ? CLOUD_TOOLS : LOCAL_TOOLS;
        const sessionId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        // Build OpenAI message array
        const conv: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
        ];

        // Append history
        if (Array.isArray(history)) {
          for (const m of history.slice(-20)) {
            if (m.role === "operator") {
              conv.push({ role: "user", content: m.content });
            } else if (m.role === "agent") {
              conv.push({ role: "assistant", content: m.content });
            }
          }
        }

        // Current user message
        conv.push({ role: "user", content: fullPrompt });

        // Agent loop (max 25 turns)
        for (let turn = 0; turn < 25; turn++) {
          const turnStart = Date.now();
          const convTokenEst = JSON.stringify(conv).length;
          console.log(`[Chat]   ↳ turn ${turn + 1}: 发起 AI 调用 | conv≈${(convTokenEst / 1024).toFixed(1)}KB | 已过 ${Date.now() - startTime}ms`);
          send("status", { stage: "ai_thinking", detail: `AI 思考中 (第${turn + 1}轮)...` });

          const response = await getClient().chat.completions.create({
            model: MODEL,
            messages: conv,
            tools: availableTools.length > 0 ? availableTools : undefined,
            stream: true,
            temperature: 0.7,
          });

          let firstChunkTime = 0;
          let assistantText = "";
          const toolCalls: Record<
            number,
            { id: string; name: string; arguments: string }
          > = {};

          for await (const chunk of response) {
            if (!firstChunkTime) {
              firstChunkTime = Date.now();
              console.log(`[Chat]     ↳ 收到首块 AI 响应 | 耗时 ${firstChunkTime - turnStart}ms`);
            }
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              assistantText += delta.content;
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (idx === undefined) continue;
                if (!toolCalls[idx])
                  toolCalls[idx] = { id: "", name: "", arguments: "" };
                if (tc.id) toolCalls[idx].id = tc.id;
                if (tc.function?.name)
                  toolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments)
                  toolCalls[idx].arguments += tc.function.arguments;
              }
            }
          }

          const turnElapsed = Date.now() - turnStart;
          const textPreview = assistantText.slice(0, 80).split("\n").join(" ");
          console.log(`[Chat]   ↳ turn ${turn + 1}: AI 返回 | ${turnElapsed}ms | text="${textPreview}" | tools=${Object.values(toolCalls).filter(tc => tc.name).length}个`);


          const toolCallsList = Object.values(toolCalls).filter((tc) => tc.name);

          // Send assistant text to frontend
          if (assistantText.trim()) {
            send(
              "output",
              sseEvent(sessionId, {
                type: "assistant",
                message: {
                  content: [{ type: "text", text: assistantText }],
                },
              })
            );
          }

          // Build assistant message for conversation
          const assistantMsg: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam =
            {
              role: "assistant",
              content: assistantText || null,
            };

          if (toolCallsList.length > 0) {
            assistantMsg.tool_calls = toolCallsList.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.arguments },
            }));
          }
          conv.push(assistantMsg);

          // No tool calls → finished
          if (toolCallsList.length === 0) break;

          console.log(`[Chat]     ↳ 执行 ${toolCallsList.length} 个工具调用`);
          send("status", { stage: "executing_tools", detail: `执行 ${toolCallsList.length} 个操作...` });

          // Execute each tool call
          for (const tc of toolCallsList) {
            let args: any = {};
            try {
              args = JSON.parse(tc.arguments);
            } catch {
              args = {};
            }

            // Notify frontend about tool call
            send(
              "output",
              sseEvent(sessionId, {
                type: "tool_call",
                name: tc.name,
                arguments: tc.arguments,
                input: args,
              })
            );

            let result: string;
            try {
              result = await executeTool(baseUrl, tc.name, args);

              // Send result to frontend
              send(
                "output",
                sseEvent(sessionId, {
                  type: "result",
                  subtype: "success",
                  result,
                })
              );

              // Feed result back to model
              conv.push({
                role: "tool",
                tool_call_id: tc.id,
                content: result,
              } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam);
            } catch (err: any) {
              console.error(`[Tool ${tc.name}] execution failed:`, err.message);
              const errorMsg = `Tool ${tc.name} failed: ${err.message?.slice(0, 200)}`;

              // Send error result so frontend renders as agent message, not system error
              send(
                "output",
                sseEvent(sessionId, {
                  type: "result",
                  subtype: "error",
                  result: errorMsg,
                })
              );

              // Feed error back to LLM so it can explain to user
              conv.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ error: err.message?.slice(0, 500) }),
              } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam);
            }
          }
        }

        const totalTime = Date.now() - startTime;
        console.log(`[Chat] <<< 完成 | 总耗时 ${totalTime}ms | turns=${/* count turns */ "done"}`);
        send("done", { status: "completed" });
      } catch (err) {
        console.error(`[Chat] <<< 错误 ${Date.now() - startTime}ms:`, err);
        send("error", { error: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
