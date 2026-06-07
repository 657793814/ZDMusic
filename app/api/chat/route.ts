import OpenAI from "openai";
import { NextRequest } from "next/server";
import { execSync } from "child_process";
import { mkdirSync, readdirSync, renameSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { MUSIC_DIR } from "@/app/lib/tracks";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ============================================================
// OpenAI Client — 对接 Agnes/DeepSeek 等 OpenAI 风格服务商
// ============================================================
const client = new OpenAI({
  baseURL: process.env.ANTHROPIC_BASE_URL || "https://apihub.agnes-ai.com/v1",
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const MODEL = process.env.ANTHROPIC_MODEL || "agnes-2.0-flash";

// ============================================================
// System Prompts
// ============================================================
const BASE_PROMPT = `你是 AuraMusic 的 AI 音频助手。保持简洁的中文终端风格语气。

## 重要限制
- 所有搜索和操作必须通过可用的函数工具完成
- **严禁**安装任何外部工具或依赖，遇到工具缺失或命令失败时，如实告知用户并停止操作，等待用户指示`;

const LOCAL_PROMPT = `${BASE_PROMPT}

## 本地曲库搜索

使用 search_tracks 函数检索曲库：
  函数参数 q=关键词, limit=返回数量上限（默认20）
返回 JSON: { "total": number, "tracks": [{ "id", "title", "author", "url", ... }] }

搜索规则：
- API 对 title、author、filename 做模糊匹配，关键词命中任一字段即返回
- 曲库中部分曲目 author 字段为空，歌手名可能只出现在 title 或 filename 中，这很正常
- 只要搜索返回了结果（total > 0），就说明命中了，应将这些结果推荐给用户
- 可多次调用 search_tracks，使用不同关键词缩小范围
- 搜索返回结果后直接推荐，不需要额外检查 API 是否正常
- 用户说"推荐几首歌"等模糊请求时，可使用 q="" 获取全部曲库，再从中挑选
- **输出 tracks 时，所有字段值必须原样复制，禁止缩写、提炼或重新组织 title**

### 简繁体中文搜索策略（重要）
- 曲库文件名可能混合使用简体和繁体中文，搜索 API 只做精确字符匹配
- **先判断关键词是否包含简繁不同的字符**：如果关键词本身简繁体写法完全相同（如"大地恩情"、"雨天"、"花"），只需搜索一次
- **只有简繁体写法不同时**（如"张学友"vs"張學友"、"听海"vs"聽海"），才发起简体和繁体两次搜索
- 将搜索结果合并去重后推荐给用户
- 如果两次搜索 total 都为 0，才告知用户未找到

## 推荐输出格式（严格遵守）

当向用户推荐歌曲时，先用自然语言简要介绍，然后 **必须** 将曲目放在独立的 tracks 代码块中。格式如下：

\`\`\`tracks
[
  {"id":"xxx","title":"歌名","author":"歌手","url":"/audio/xxx.mp3"},
  {"id":"yyy","title":"歌名2","author":"歌手2","url":"/audio/yyy.mp3"}
]
\`\`\`

关键规则：
1. 代码块标记必须用 \`\`\`tracks 开头，\`\`\` 结尾，各占独立一行
2. 数据必须是合法 JSON 数组，**逐字复制** search_tracks 函数返回的 JSON 字段值（id、title、author、url），**严禁修改、缩短、重写或"美化"任何字段**
3. 每个对象必须包含 id、title、author、url 四个字段
4. 即使只推荐一首歌也要用此格式
5. 不要把 tracks 代码块放在其他 markdown 代码块内
6. 如果用户只是闲聊、提问，不需要输出 tracks 代码块
7. title 字段必须与函数返回值完全一致，即使很长或包含下划线等字符也不能删减`;

const CLOUD_PROMPT = `${BASE_PROMPT}

## B站云端搜索

用户当前处于云端模式。无论用户想找什么内容（音乐、科普、课程、演讲、访谈、纪录片等），都通过 B站 搜索。B站拥有各类视频资源，本应用会将视频转为音频供用户收听。

### 搜索步骤
1. 解析用户意图，提取搜索关键词
2. 使用 search_bilibili 函数搜索：参数 keyword=关键词
   返回 JSON: { "total": number, "videos": [{ "bvid", "title", "author", "duration", "play" }] }
3. 分析搜索结果，筛选最相关的视频（通常 5-10 个），以 tracks 格式输出

### 搜索输出格式（严格遵守）

用 tracks 代码块输出，每个对象 **必须包含 bvid 字段**：

\`\`\`tracks
[
  {"bvid":"BV1xxxxx","title":"视频标题","author":"UP主","duration":"4:32","url":"https://www.bilibili.com/video/BV1xxxxx"},
  {"bvid":"BV2yyyyy","title":"视频标题2","author":"UP主2","duration":"12:05","url":"https://www.bilibili.com/video/BV2yyyyy"}
]
\`\`\`

关键规则：
1. 代码块标记必须用 \`\`\`tracks 开头，\`\`\` 结尾，各占独立一行
2. 数据必须是合法 JSON 数组
3. 每个对象必须包含 bvid、title、author、duration、url 五个字段，duration 来自 search_bilibili 函数返回
4. url 格式为 https://www.bilibili.com/video/{bvid}
5. bvid 字段来自函数返回结果，不要自行编造
6. 如果用户只是闲聊、提问，不需要输出 tracks 代码块

### 转换流程

当用户想要将B站视频转为音频时：
1. 使用 convert_bilibili_videos 函数，传入 bvids 数组（titles 可选，不传也可正常工作）
2. 函数会自动完成下载、重命名、扫描的全流程，返回新增的 tracks 列表
3. 将返回结果用 added 代码块输出（前端会自动添加到播放列表）：

\`\`\`added
[
  {"id":"20250430/文件名.mp3","title":"标题","author":"作者","url":"/api/tracks/20250430/%E6%96%87%E4%BB%B6%E5%90%8D.mp3","date":"","filename":"文件名.mp3","subDir":"20250430","size":12345,"bvid":"BV1xxxxxx"}
]
\`\`\`

- 直接复制函数返回的 track 对象，不要自行编造或修改任何字段
- 即使只有一个文件也用数组格式`;

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
    execSync(`cd ${biliDir} && npx bv2mp3 ${urlArgs}`, {
      stdio: "pipe",
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
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

  // 6. 匹配下载的文件，关联 bvid 并返回
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
        send("status", { stage: "starting" });

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
          const response = await client.chat.completions.create({
            model: MODEL,
            messages: conv,
            tools: availableTools.length > 0 ? availableTools : undefined,
            stream: true,
            temperature: 0.7,
          });

          let assistantText = "";
          const toolCalls: Record<
            number,
            { id: string; name: string; arguments: string }
          > = {};

          for await (const chunk of response) {
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

            // Execute tool
            const result = await executeTool(baseUrl, tc.name, args);

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
          }
        }

        send("done", { status: "completed" });
      } catch (err) {
        console.error("Chat error:", err);
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
