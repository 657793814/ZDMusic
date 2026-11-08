"use client";

import { useOverlay } from "@/app/context/OverlayContext";
import type { Playlist } from "@/app/lib/types";
import { ListIcon, MusicIcon } from "@/app/components/ui/icons";
import { useEffect, useState } from "react";

export function MyPlaylists() {
  const { openQueue } = useOverlay();
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/playlists", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { playlists: [] }))
      .then((data: { playlists?: Playlist[] }) => {
        if (alive) setPlaylists(data.playlists ?? []);
      })
      .catch(() => {
        if (alive) setPlaylists([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="zd-home-card glass-panel">
      <div className="zd-home-card-head">
        <span className="zd-kicker">我的歌单</span>
        <button type="button" className="zd-home-link" onClick={() => openQueue("playlists")}>
          <ListIcon size={12} />
          打开歌单
        </button>
      </div>

      {playlists === null ? (
        <div className="zd-empty">正在读取歌单…</div>
      ) : playlists.length === 0 ? (
        <div className="zd-empty">
          还没有歌单。歌单只保存在本地，不会同步到任何平台账号。
        </div>
      ) : (
        <div className="zd-home-playlists">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              className="zd-home-playlist"
              onClick={() => openQueue("playlists")}
              title={`${playlist.name} · ${playlist.trackIds.length} 首`}
            >
              <span className="zd-home-playlist-art" aria-hidden>
                <MusicIcon size={15} />
              </span>
              <span className="zd-home-playlist-meta">
                <span className="zd-home-playlist-name">{playlist.name}</span>
                <span className="zd-home-playlist-sub">{playlist.trackIds.length} 首 · 本地</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
