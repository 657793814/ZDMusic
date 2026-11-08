"use client";

import type { ListenSummary } from "@/app/hooks/useHomeData";

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${m}` : `${h}h`;
}

export function TodayStats({
  summary,
  loading,
}: {
  summary: ListenSummary;
  loading: boolean;
}) {
  const empty = !loading && summary.totalCount === 0;

  return (
    <div className="zd-home-stats" data-empty={empty ? "true" : "false"}>
      <div className="zd-home-stats-head">
        <span className="zd-kicker">今日聆听</span>
        <span className="zd-home-stats-hint">
          {loading ? "统计中…" : empty ? "开始播放后生成" : `近 7 天 ${summary.weekCount} 次`}
        </span>
      </div>
      <div className="zd-home-stat-grid">
        <div className="zd-home-stat">
          <span className="zd-home-stat-value">
            {loading || empty ? "—" : minutesLabel(summary.todayMinutes)}
          </span>
          <span className="zd-home-stat-label">分钟</span>
        </div>
        <div className="zd-home-stat">
          <span className="zd-home-stat-value">
            {loading || empty ? "—" : summary.todayCount}
          </span>
          <span className="zd-home-stat-label">首</span>
        </div>
        <div className="zd-home-stat">
          <span className="zd-home-stat-value">
            {loading || empty ? "—" : summary.streakDays}
          </span>
          <span className="zd-home-stat-label">连续天</span>
        </div>
      </div>
    </div>
  );
}
