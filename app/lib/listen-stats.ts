import { readHistory } from "./play-history";

export interface ListenSummary {
  /** 今日开始播放的曲目数 */
  todayCount: number;
  /** 今日播放时长（分钟），取曲目本身时长 */
  todayMinutes: number;
  /** 连续听歌天数（今天没有记录时从昨天算起） */
  streakDays: number;
  /** 近 7 天播放次数 */
  weekCount: number;
  /** 历史总播放次数 */
  totalCount: number;
}

function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 聚合播放历史。不读 ID3，只用历史记录里已有的时长，避免首屏被 ffprobe 拖慢。 */
export function getListenSummary(): ListenSummary {
  const records = readHistory().records;
  const todayStart = startOfToday();
  const weekStart = todayStart - 6 * 86400000;

  let todayCount = 0;
  let todaySeconds = 0;
  let weekCount = 0;

  for (const record of records) {
    if (record.playedAt >= todayStart) {
      todayCount += 1;
      todaySeconds += record.duration ?? 0;
    }
    if (record.playedAt >= weekStart) weekCount += 1;
  }

  const days = new Set(records.map((record) => dayKey(record.playedAt)));
  let streakDays = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // 今天还没听时，连续天数从昨天往前算
  if (!days.has(dayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (days.has(dayKey(cursor.getTime()))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    todayCount,
    todayMinutes: Math.round(todaySeconds / 60),
    streakDays,
    weekCount,
    totalCount: records.length,
  };
}
