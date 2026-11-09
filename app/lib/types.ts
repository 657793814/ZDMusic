export type TrackSource = "local" | "bilibili";

/** 播放/循环模式（播放内核唯一语义） */
export type RepeatMode = "off" | "track" | "queue";

/** 曲目进入队列的来源 */
export type QueueOrigin = "library" | "playlist" | "search" | "bili" | "agent";

export interface Track {
  /** 数据契约：`${subDir}/${filename}`，不得改成 hash */
  id: string;
  title: string;
  author: string;
  date: string;
  filename: string;
  subDir: string;
  size: number;
  /** 数据契约：`/api/tracks/...` */
  url: string;
  bvid?: string;
  /** 新增可选字段，旧数据无需补齐 */
  source?: TrackSource;
  album?: string;
  coverUrl?: string | null;
  /** 曲库索引补充字段：时长秒数、入库时间、是否有本地元数据覆盖 */
  durationSec?: number;
  addedAt?: number;
  /** 入库时间来源；scan 表示兜底估算 */
  addedAtSource?: "path" | "birthtime" | "mtime" | "scan";
  overridden?: boolean;
}

/** 队列项：同一首歌可在队列出现多次，uid 是运行时唯一标识 */
export interface QueueItem {
  uid: string;
  trackId: string;
  origin: QueueOrigin;
  addedAt: number;
}

/** 落盘的队列快照（~/.zdmusic/player-state.json） */
export interface PlayerSnapshot {
  version: 1;
  queue: QueueItem[];
  currentUid: string | null;
  progress: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  updatedAt: number;
}

/** 旧 UI 兼容：播放模式 */
export type PlayMode = 'playlist' | 'single' | 'shuffle';

export interface ChatMessage {
  id: string;
  role: "agent" | "operator" | "system" | "tool";
  content: string;
  timestamp: number;
  toolName?: string;
}

export interface PlayerState {
  current: Track | null;
  playlist: Track[];
  index: number;
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
}

export interface Playlist {
  id: string;
  name: string;
  nameEn: string;
  description?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
  /** 系统伪歌单（如「全部歌单」）：不落库，内容由曲库实时派生，不可改名/删除 */
  system?: boolean;
}

/** 系统伪歌单的保留 id，不会写进 playlists.json */
export const ALL_SONGS_PLAYLIST_ID = "__all__";

export interface PlaylistStore {
  playlists: Playlist[];
}

export interface AgentState {
  messages: ChatMessage[];
  loading: boolean;
  sessionId: string | null;
}
