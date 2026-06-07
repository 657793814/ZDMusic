"use client";

import type { DanmakuItem } from "@/app/lib/bili";
import { usePlayer } from "@/app/context/PlayerContext";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type DanmakuCtxValue = {
  enabled: boolean;
  hasDanmaku: boolean;
  hasBvidOrSearch: boolean;
  currentDanmaku: DanmakuItem[];
  toggleDanmaku: () => void;
  fetchDanmaku: (bvid: string) => void;
};

const DanmakuContext = createContext<DanmakuCtxValue | null>(null);

export function DanmakuProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [danmakuMap, setDanmakuMap] = useState<
    Record<string, DanmakuItem[]>
  >({});
  const danmakuMapRef = useRef(danmakuMap);
  useEffect(() => {
    danmakuMapRef.current = danmakuMap;
  }, [danmakuMap]);

  const { state } = usePlayer();
  const bvid = state.current?.bvid ?? null;
  const [resolvedBvid, setResolvedBvid] = useState<string | null>(null);
  // 缓存标题→bvid 映射（自动搜索用）
  const titleBvidRef = useRef<Record<string, string>>({});

  const toggleDanmaku = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  const fetchDanmaku = useCallback(
    (bvidToFetch: string) => {
      if (danmakuMapRef.current[bvidToFetch]) return;

      fetch(`/api/bili/danmaku?bvid=${encodeURIComponent(bvidToFetch)}`)
        .then((res) => res.json())
        .then((json: { danmaku?: DanmakuItem[]; error?: string }) => {
          if (json.error) {
            console.error('[Danmaku] API error:', json.error);
            return;
          }
          if (json.danmaku?.length) {
            setDanmakuMap((prev) => ({
              ...prev,
              [bvidToFetch]: json.danmaku!,
            }));
          }
        })
        .catch(() => {
          /* ignore fetch errors */
        });
    },
    []
  );

  // 自动搜索 Bilibili：通过歌曲标题查找 BVID
  const searchDanmakuByTitle = useCallback(
    (title: string) => {
      if (titleBvidRef.current[title]) {
        // 已经搜过，直接拿 BVID 拉弹幕
        const found = titleBvidRef.current[title];
        if (found) {
          setResolvedBvid(found);
          fetchDanmaku(found);
        }
        return;
      }

      // 清理标题：去掉【】修饰词、多余符号，提取核心关键词
      const cleanTitle = title
        .replace(/【[^】]*】/g, "")
        .replace(/\|/g, " ")
        .replace(/[-—]+/g, " ")
        .trim();

      fetch(`/api/bili/search?keyword=${encodeURIComponent(cleanTitle)}`)
        .then((r) => r.json())
        .then((json: { videos?: Array<{ bvid: string; title: string }> }) => {
          const videos = json.videos;
          if (!videos?.length) {
            titleBvidRef.current[title] = ""; // 标记为已搜但无结果
            return;
          }
          const top = videos[0]!;
          titleBvidRef.current[title] = top.bvid;
          setResolvedBvid(top.bvid);
          fetchDanmaku(top.bvid);
        })
        .catch(() => {
          titleBvidRef.current[title] = "";
        });
    },
    [fetchDanmaku]
  );

  // 当前切换曲目时自动拉取弹幕
  useEffect(() => {
    setResolvedBvid(null);
    if (bvid) {
      setResolvedBvid(bvid);
      fetchDanmaku(bvid);
    } else if (state.current?.title) {
      searchDanmakuByTitle(state.current.title);
    }
  }, [bvid, state.current?.id, fetchDanmaku, searchDanmakuByTitle]);

  const lookupKey = bvid ?? resolvedBvid;
  const currentDanmaku = lookupKey ? danmakuMap[lookupKey] ?? [] : [];
  // 只要当前曲目可能关联弹幕（有 BVID 或者自动搜索找到结果），就允许用户开启
  const hasDanmaku = currentDanmaku.length > 0,
    hasBvidOrSearch = !!(bvid || resolvedBvid);

  const value = useMemo<DanmakuCtxValue>(
    () => ({
      enabled,
      hasDanmaku,
      hasBvidOrSearch,
      currentDanmaku,
      toggleDanmaku,
      fetchDanmaku,
    }),
    [enabled, hasDanmaku, hasBvidOrSearch, currentDanmaku, toggleDanmaku, fetchDanmaku]
  );

  return (
    <DanmakuContext.Provider value={value}>
      {children}
    </DanmakuContext.Provider>
  );
}

export function useDanmaku() {
  const v = useContext(DanmakuContext);
  if (!v) throw new Error("useDanmaku must be used within DanmakuProvider");
  return v;
}
