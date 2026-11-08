"use client";

import type { ListeningProfile } from "@/app/lib/recommend";

const MIN_SAMPLES = 5;

function valueOrDash(value: string | null | undefined) {
  return value && value.trim() ? value : "—";
}

export function ListeningProfileCard({
  profile,
  loading,
}: {
  profile: ListeningProfile;
  loading: boolean;
}) {
  const insufficient = !loading && !profile.sufficient;
  const remaining = Math.max(0, MIN_SAMPLES - profile.sampleSize);

  return (
    <section className="zd-home-card glass-panel" data-empty={insufficient ? "true" : "false"}>
      <div className="zd-home-card-head">
        <span className="zd-kicker">听歌画像</span>
        <span className="zd-home-stats-hint">
          {loading ? "统计中…" : `样本 ${profile.sampleSize} 次播放`}
        </span>
      </div>

      {loading ? (
        <div className="zd-empty">正在读取播放历史…</div>
      ) : insufficient ? (
        <div className="zd-home-profile-empty">
          <span className="zd-home-profile-empty-title">数据不足</span>
          <span className="zd-home-profile-empty-hint">
            画像只统计你真实的本地播放记录。再听 {remaining} 首（且至少 3 首不同曲目）后生成，不会用假数据填充。
          </span>
        </div>
      ) : (
        <div className="zd-home-profile-list">
          <div className="zd-home-profile-row">
            <span className="zd-home-profile-label">常听歌手</span>
            <span className="zd-home-profile-value">
              {valueOrDash(profile.topArtist?.name)}
              {profile.topArtist ? <em>{profile.topArtist.plays} 次</em> : null}
            </span>
          </div>
          <div className="zd-home-profile-row">
            <span className="zd-home-profile-label">常听曲目</span>
            <span className="zd-home-profile-value">
              {valueOrDash(profile.topSong?.title)}
              {profile.topSong ? <em>{profile.topSong.plays} 次</em> : null}
            </span>
          </div>
          <div className="zd-home-profile-row">
            <span className="zd-home-profile-label">曲库触达</span>
            <span className="zd-home-profile-value">
              {profile.distinctTracks}
              <em>首</em>
            </span>
          </div>
          <div className="zd-home-profile-row">
            <span className="zd-home-profile-label">累计聆听</span>
            <span className="zd-home-profile-value">
              {profile.totalMinutes}
              <em>分钟 · {profile.activeDays} 天</em>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
