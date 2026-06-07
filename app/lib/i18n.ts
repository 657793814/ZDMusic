"use client";
/* @jsxReactCompiler */

import React, { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "zh-CN" | "en-US";

export type DictKey =
  | "prev"
  | "play"
  | "pause"
  | "next"
  | "stop"
  | "repeat"
  | "loop"
  | "shuffle"
  | "noSignal"
  | "playing"
  | "paused"
  | "volume"
  | "activeQueue"
  | "trackCount"
  | "refresh"
  | "refreshTitle"
  | "filter"
  | "loading"
  | "queueEmpty"
  | "scanLocal"
  | "remove"
  | "liveFeed"
  | "strmSync"
  | "systemOnline"
  | "mem"
  | "cpuLoad"
  | "packetLoss"
  | "syncStatus"
  | "nodeVersion"
  | "agentLabel"
  | "thinking"
  | "neuralAgent"
  | "processing"
  | "standby"
  | "sessionOk"
  | "noSession"
  | "awaitingInput"
  | "cancel"
  | "stopAgent"
  | "placeholder"
  | "tracksAdded"
  | "added"
  | "queued"
  | "converting"
  | "allAdded"
  | "addAll"
  | "operatorLabel"
  | "toolLabel"
  | "sysLabel"
  | "danmaku"
  | "danmakuUnavailable"
  | "local"
  | "cloud"
  | "title"
  | "description";

const zh: Record<DictKey, string> = {
  prev: "上一首",
  play: "播放",
  pause: "暂停",
  next: "下一首",
  stop: "停止",
  repeat: "列表循环",
  loop: "单曲循环",
  shuffle: "随机播放",
  noSignal: "暂无歌曲",
  playing: "正在播放",
  paused: "已暂停",
  volume: "音量",
  activeQueue: "播放列表",
  trackCount: "首歌曲",
  refresh: "刷新",
  refreshTitle: "重新扫描",
  filter: "筛选…",
  loading: "加载中…",
  queueEmpty: "队列为空",
  scanLocal: "扫描本地",
  remove: "移除",
  liveFeed: "直播流",
  strmSync: "同步中",
  systemOnline: "已连接",
  mem: "内存:",
  cpuLoad: "CPU:",
  packetLoss: "丢包率:",
  syncStatus: "同步状态:",
  nodeVersion: "节点版本:",
  agentLabel: "AI 助手",
  thinking: "思考中",
  neuralAgent: "AI 助手",
  processing: "处理中",
  standby: "待机中",
  sessionOk: "会话中",
  noSession: "无会话",
  awaitingInput: "问我任何音乐相关的事…",
  cancel: "中断",
  stopAgent: "停止",
  placeholder: "告诉我你想听什么…",
  tracksAdded: "已添加",
  added: "已添加",
  queued: "已排队",
  converting: "转换中…",
  allAdded: "全部已添加",
  addAll: "添加全部",
  operatorLabel: "我",
  toolLabel: "工具",
  sysLabel: "系统",
  danmaku: "弹幕",
  danmakuUnavailable: "无法找到弹幕源",
  local: "本地",
  cloud: "云端",
  title: "卓动悦听",
  description: "在任何时间、任何地点播放音乐。",
};

const en: Record<DictKey, string> = {
  prev: "Previous",
  play: "Play",
  pause: "Pause",
  next: "Next",
  stop: "Stop",
  repeat: "Repeat all",
  loop: "Loop once",
  shuffle: "Shuffle",
  noSignal: "No track",
  playing: "Now playing",
  paused: "Paused",
  volume: "Volume",
  activeQueue: "Queue",
  trackCount: "tracks",
  refresh: "Refresh",
  refreshTitle: "Rescan",
  filter: "Search…",
  loading: "Loading…",
  queueEmpty: "Empty queue",
  scanLocal: "Scan local",
  remove: "Remove",
  liveFeed: "Live feed",
  strmSync: "Sync active",
  systemOnline: "Online",
  mem: "Memory:",
  cpuLoad: "CPU:",
  packetLoss: "Packet loss:",
  syncStatus: "Sync status:",
  nodeVersion: "Node version:",
  agentLabel: "AI",
  thinking: "thinking",
  neuralAgent: "AI Assistant",
  processing: "Working",
  standby: "Idle",
  sessionOk: "Active",
  noSession: "None",
  awaitingInput: "Ask me anything about music…",
  cancel: "Cancel",
  stopAgent: "Stop",
  placeholder: "Tell me what you want to listen to…",
  tracksAdded: "tracks added",
  added: "Added",
  queued: "Queued",
  converting: "Converting…",
  allAdded: "All added",
  addAll: "Add all",
  operatorLabel: "You",
  toolLabel: "Tool",
  sysLabel: "System",
  danmaku: "Comments",
  danmakuUnavailable: "No comments source found",
  local: "Local",
  cloud: "Cloud",
  title: "卓动悦听",
  description: "Listen to music anytime, anywhere.",
};

const langOrder: Lang[] = ["zh-CN", "en-US"];

export interface I18nCtx {
  t: (key: DictKey) => string;
  lang: Lang;
  setLang: (lang: Lang) => void;
  cycleLang: () => void;
}

const I18nContext = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const stored = (typeof window !== "undefined" && localStorage.getItem("aura-lang")) as Lang | null;
  const [lang, setLangState] = useState<Lang>(stored && langOrder.includes(stored) ? stored : "zh-CN");

  const dict = lang === "zh-CN" ? zh : en;
  const t = useCallback((key: DictKey) => dict[key], [lang]);

  const setLang = useCallback(
    (nextLang: Lang) => {
      setLangState(nextLang);
      localStorage.setItem("aura-lang", nextLang);
    },
    []
  );

  const cycleLang = useCallback(() => {
    setLang(lang === "zh-CN" ? "en-US" : "zh-CN");
  }, [lang, setLang]);

  const ctx: I18nCtx = { t, lang, setLang, cycleLang };

  return React.createElement(I18nContext.Provider, { value: ctx }, children);
}

export function useI18n(): I18nCtx {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n must be used within I18nProvider");
  return v;
}
