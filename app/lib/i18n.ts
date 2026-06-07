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
  noSignal: "无信号",
  playing: "▶ 播放中",
  paused: "已暂停",
  volume: "音量",
  activeQueue: "歌单列表",
  trackCount: "歌曲数量",
  refresh: "刷新",
  refreshTitle: "重新扫描",
  filter: "筛选…",
  loading: "加载…",
  queueEmpty: "队列为空",
  scanLocal: "扫描本地",
  remove: "移除",
  liveFeed: "直播流",
  strmSync: "流同步",
  systemOnline: "系统在线",
  mem: "内存:",
  cpuLoad: "CPU负载:",
  packetLoss: "丢包率:",
  syncStatus: "同步状态:",
  nodeVersion: "节点版本:",
  agentLabel: "智能体",
  thinking: "思考中",
  neuralAgent: "悦听智能体",
  processing: "处理中",
  standby: "待机",
  sessionOk: "会话成功",
  noSession: "无会话",
  awaitingInput: "等待用户输入…",
  cancel: "中断",
  stopAgent: "停止智能体",
  placeholder: "Hi, 告诉我你想听什么…",
  tracksAdded: "已添加歌曲",
  added: "已添加",
  queued: "已排队列",
  converting: "转换中…",
  allAdded: "所有已添加",
  addAll: "添加所有",
  operatorLabel: "操作员",
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
  prev: "PREV",
  play: "PLAY",
  pause: "PAUSE",
  next: "NEXT",
  stop: "STOP",
  repeat: "REPEAT",
  loop: "LOOP",
  shuffle: "SHUFFLE",
  noSignal: "NO SIGNAL",
  playing: "▶ PLAYING",
  paused: "PAUSED",
  volume: "Volume",
  activeQueue: "ACTIVE_QUEUE",
  trackCount: "tracks",
  refresh: "Refresh",
  refreshTitle: "Rescan",
  filter: "FILTER…",
  loading: "LOADING…",
  queueEmpty: "QUEUE_EMPTY",
  scanLocal: "SCAN LOCAL",
  remove: "Remove",
  liveFeed: "LIVE FEED",
  strmSync: "STRM_SYNC: ACTIVE",
  systemOnline: "SYSTEM ONLINE",
  mem: "MEM:",
  cpuLoad: "CPU LOAD:",
  packetLoss: "PACKET LOSS:",
  syncStatus: "SYNC STATUS:",
  nodeVersion: "NODE VERSION:",
  agentLabel: "AGENT_01",
  thinking: "thinking",
  neuralAgent: "NEURAL_AGENT",
  processing: "PROCESSING",
  standby: "STANDBY",
  sessionOk: "SESSION OK",
  noSession: "NO SESSION",
  awaitingInput: "Awaiting operator input…",
  cancel: "Cancel",
  stopAgent: "STOP",
  placeholder: "Tell me what you want to listen to…",
  tracksAdded: "tracks added",
  added: "ADDED",
  queued: "QUEUED",
  converting: "CONVERTING…",
  allAdded: "ALL ADDED",
  addAll: "ADD ALL",
  operatorLabel: "OPERATOR",
  toolLabel: "TOOL",
  sysLabel: "SYS",
  danmaku: "DANMAKU",
  danmakuUnavailable: "No danmaku source found",
  local: "LOCAL",
  cloud: "CLOUD",
  title: "ZDMusic",
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
