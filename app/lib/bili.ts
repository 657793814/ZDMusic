import { createHash } from "crypto";

export interface BiliVideo {
  bvid: string;
  title: string;
  author: string;
  duration: string;
  play: number;
  pic: string;
}

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5,
  49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55,
  40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57,
  62, 11, 36, 20, 34, 44, 52,
] as const;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "identity",
  "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="134", "Google Chrome";v="134"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  "Priority": "u=1, i",
};

// Cookie header used for API requests that support cookie-based auth
function buildCookieHeader(buvid3: string): string {
  const parts = [`buvid3=${buvid3}`];
  // wbi signing needs wk to be present
  if (process.env.BILIBILI_COOKIE_WK) parts.push(`wk=${process.env.BILIBILI_COOKIE_WK}`);
  if (process.env.BILIBILI_COOKIE_SESSDATA) parts.push(`SESSDATA=${process.env.BILIBILI_COOKIE_SESSDATA}`);
  return parts.join("; ");
}

let cachedKeys: { imgKey: string; subKey: string; ts: number } | null = null;
let cachedBuvid3: string | null = null;
let buvid3FreshAt = 0;
const BUVID3_REFRESH_INTERVAL = 10 * 60 * 1000; // refresh every 10 minutes
let cachedVideoInfo: Record<string, { cid: string; title: string; ts: number }> | null = null;
const VIDEO_INFO_TTL = 24 * 60 * 60 * 1000; // 24 hours
const REQUEST_DELAY_MIN = 800; // ms between API calls
const REQUEST_DELAY_MAX = 2000; // ms
let lastApiCallAt = 0;

function getMixinKey(imgKey: string, subKey: string): string {
  const raw = imgKey + subKey;
  return MIXIN_KEY_ENC_TAB.map((i) => raw[i]).join("").slice(0, 32);
}

function signParams(
  params: Record<string, string | number>,
  mixinKey: string
): Record<string, string> {
  const wts = Math.floor(Date.now() / 1000);
  const signed: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    signed[k] = String(v);
  }
  signed.wts = String(wts);

  const sorted = Object.keys(signed)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(signed[k])}`)
    .join("&");

  const wRid = createHash("md5")
    .update(sorted + mixinKey)
    .digest("hex");

  signed.w_rid = wRid;
  return signed;
}

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function delayBeforeApiCall() {
  const now = Date.now();
  const elapsed = now - lastApiCallAt;
  if (elapsed < REQUEST_DELAY_MIN) {
    await sleep(REQUEST_DELAY_MIN - elapsed + Math.random() * (REQUEST_DELAY_MAX - REQUEST_DELAY_MIN));
  }
  lastApiCallAt = Date.now();
}

/**
 * Ensure we have a valid buvid3.
 * Uses pre-configured cookie from env vars if available (best for servers).
 * Otherwise fetches from B站首页, refreshing every 10 minutes.
 */
async function ensureBuvid3(): Promise<string> {
  // If env provides full cookies, use them directly
  if (process.env.BILIBILI_COOKIE_SESSDATA && process.env.BILIBILI_COOKIE_WK) {
    const buvid3FromCookie = process.env.BILIBILI_COOKIE_BUVID3 || "";
    if (buvid3FromCookie) {
      cachedBuvid3 = buvid3FromCookie;
      buvid3FreshAt = Date.now();
      return cachedBuvid3;
    }
  }

  // Auto-refresh if stale
  if (cachedBuvid3 && Date.now() - buvid3FreshAt < BUVID3_REFRESH_INTERVAL) {
    return cachedBuvid3;
  }

  try {
    const res = await fetch("https://www.bilibili.com", {
      method: "GET",
      headers: { "User-Agent": UA },
      redirect: "follow",
    });
    const cookies = res.headers.getSetCookie?.() ?? [];
    for (const c of cookies) {
      const match = c.match(/buvid3=([^;]+)/);
      if (match) {
        cachedBuvid3 = match[1];
        buvid3FreshAt = Date.now();
        return cachedBuvid3;
      }
    }
  } catch { /* fallback */ }

  // Fallback: generate a plausible buvid3
  cachedBuvid3 = `${crypto.randomUUID()}infoc`;
  buvid3FreshAt = Date.now();
  return cachedBuvid3;
}

const KEY_TTL = 12 * 60 * 60 * 1000;

async function getWbiKeys(): Promise<{ imgKey: string; subKey: string }> {
  if (cachedKeys && Date.now() - cachedKeys.ts < KEY_TTL) {
    return { imgKey: cachedKeys.imgKey, subKey: cachedKeys.subKey };
  }
  const buvid3 = await ensureBuvid3();
  await delayBeforeApiCall();

  const res = await fetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: {
      ...COMMON_HEADERS,
      Cookie: buildCookieHeader(buvid3),
    },
  });

  // Detect HTML response
  const navText = await res.text();
  if (navText.includes("<!DOCTYPE") || navText.includes("<html")) {
    console.warn("[getWbiKeys] Bilibili returned HTML, using fallback keys");
    cachedKeys = { imgKey: "", subKey: "", ts: Date.now() };
    return { imgKey: "", subKey: "" };
  }

  const json = JSON.parse(navText) as {
    data?: {
      wbi_img?: { img_url?: string; sub_url?: string };
    };
  };
  const imgUrl = json.data?.wbi_img?.img_url ?? "";
  const subUrl = json.data?.wbi_img?.sub_url ?? "";
  const imgKey = imgUrl.split("/").pop()?.replace(".png", "") ?? "";
  const subKey = subUrl.split("/").pop()?.replace(".png", "") ?? "";
  if (imgKey && subKey) {
    cachedKeys = { imgKey, subKey, ts: Date.now() };
  }
  return { imgKey, subKey };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

export interface DanmakuItem {
  time: number;
  content: string;
  type: number;
  color: string;
}

export async function getVideoInfo(bvid: string): Promise<{ cid: string; title: string }> {
  // 缓存结果
  if (cachedVideoInfo?.[bvid]) {
    const cached = cachedVideoInfo[bvid];
    if (Date.now() - cached.ts < VIDEO_INFO_TTL) return cached;
  }

  await delayBeforeApiCall();
  const { imgKey, subKey } = await getWbiKeys();
  const mixinKey = getMixinKey(imgKey, subKey);
  const buvid3 = await ensureBuvid3();

  const params = signParams({ bvid }, mixinKey);
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const res = await fetch(
    `https://api.bilibili.com/x/web-interface/view?${qs}`,
    {
      headers: {
        ...COMMON_HEADERS,
        Cookie: buildCookieHeader(buvid3),
      },
    }
  );

  // Detect HTML response (Bilibili security block / rate limit page)
  const viewText = await res.text();
  if (viewText.includes("<!DOCTYPE") || viewText.includes("<html")) {
    console.warn(`[getVideoInfo] Bilibili returned HTML for ${bvid}`);
    throw new Error(`Bilibili API unavailable: security block detected`);
  }

  const json = JSON.parse(viewText) as {
    code?: number;
    data?: { cid?: number; title?: string };
  };

  if (json.code !== 0 || !json.data?.cid) {
    throw new Error(`Failed to get video info for ${bvid}: code=${json.code}`);
  }

  const result = { cid: String(json.data.cid), title: json.data.title ?? "" };
  cachedVideoInfo = cachedVideoInfo ?? {};
  cachedVideoInfo[bvid] = { ...result, ts: Date.now() };
  return result;
}

let cachedDanmaku: Record<string, { items: DanmakuItem[]; ts: number }> | null = null;
const DANMAKU_TTL = 10 * 60 * 1000; // 10 minutes

export async function getDanmaku(cid: string): Promise<DanmakuItem[]> {
  // 缓存结果，避免频繁请求
  if (cachedDanmaku?.[cid]) {
    const cached = cachedDanmaku[cid];
    if (Date.now() - cached.ts < DANMAKU_TTL) return cached.items;
  }

  await delayBeforeApiCall();
  const buvid3 = await ensureBuvid3();
  const oid = parseInt(cid, 10);

  const res = await fetch(
    `https://api.bilibili.com/x/v1/dm/list.so?oid=${oid}`,
    {
      headers: {
        ...COMMON_HEADERS,
        Cookie: buildCookieHeader(buvid3),
      },
    }
  );

  const xml = await res.text();

  // 如果返回 HTML 错误页面（B站弹幕 API 限流时会返回错误页），返回空
  if (xml.includes("<!DOCTYPE") || xml.includes("<html")) {
    console.warn('[Danmaku] API returned HTML instead of XML, likely rate-limited or no danmaku.');
    cachedDanmaku = cachedDanmaku ?? {};
    cachedDanmaku[cid] = { items: [], ts: Date.now() };
    return [];
  }

  const items: DanmakuItem[] = [];
  const dRegex = /<d p="([^"]*)"[^>]*>([^<]*)<\/d>/g;
  let match: RegExpExecArray | null;
  while ((match = dRegex.exec(xml)) !== null) {
    const attrs = match[1]!.split(",");
    const time = parseFloat(attrs[0] ?? "0");
    const type = parseInt(attrs[1] ?? "0", 10);
    const color = attrs[3] ? `#${parseInt(attrs[3]).toString(16).padStart(6, "0")}` : "#ffffff";
    const content = match[2]!;
    if (content.trim()) {
      items.push({ time, content, type, color });
    }
  }

  items.sort((a, b) => a.time - b.time);

  cachedDanmaku = cachedDanmaku ?? {};
  cachedDanmaku[cid] = { items, ts: Date.now() };
  return items;
}

export async function searchVideos(
  keyword: string,
  page = 1
): Promise<{ total: number; videos: BiliVideo[] }> {
  await delayBeforeApiCall();
  const { imgKey, subKey } = await getWbiKeys();
  const mixinKey = getMixinKey(imgKey, subKey);
  const buvid3 = await ensureBuvid3();

  const params = signParams(
    { search_type: "video", keyword, page, order: "totalrank" },
    mixinKey
  );
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const res = await fetch(
    `https://api.bilibili.com/x/web-interface/search/type?${qs}`,
    {
      headers: {
        ...COMMON_HEADERS,
        Cookie: buildCookieHeader(buvid3),
      },
    }
  );

  // Reject non-OK status before parsing
  if (!res.ok) {
    console.warn(`[searchVideos] Bilibili API returned non-OK status: ${res.status}`);
    return { total: 0, videos: [] };
  }

  // Detect HTML response (Bilibili security block / rate limit page)
  const text = await res.text();
  if (text.includes("<!DOCTYPE") || text.includes("<html")) {
    console.warn("[searchVideos] Bilibili API returned HTML instead of JSON, likely blocked.");
    return { total: 0, videos: [] };
  }

  const json = JSON.parse(text) as {
    code?: number;
    data?: {
      numResults?: number;
      result?: Array<{
        bvid?: string;
        title?: string;
        author?: string;
        duration?: string;
        play?: number;
        pic?: string;
      }>;
    };
  };

  if (json.code !== 0 || !json.data?.result) {
    return { total: 0, videos: [] };
  }

  const videos: BiliVideo[] = json.data.result
    .filter((v) => v.bvid)
    .map((v) => ({
      bvid: v.bvid!,
      title: stripHtml(v.title ?? ""),
      author: v.author ?? "",
      duration: v.duration ?? "",
      play: v.play ?? 0,
      pic: v.pic?.startsWith("//") ? `https:${v.pic}` : (v.pic ?? ""),
    }));

  return { total: json.data.numResults ?? videos.length, videos };
}
