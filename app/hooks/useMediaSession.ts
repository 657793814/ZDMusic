"use client";
import { useEffect } from "react";
import type { Track } from "@/app/lib/types";

export function useMediaSession(
  track: Track | null,
  playing: boolean,
  onPrev: () => void,
  onNext: () => void,
  onSeek: (time: number) => void
) {
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.author,
        album: "",
        artwork: [{ src: "", sizes: "", type: "" }],
      });
    }

    navigator.mediaSession.setActionHandler("previoustrack", () => onPrev());
    navigator.mediaSession.setActionHandler("nexttrack", () => onNext());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null) onSeek(details.seekTime);
    });
    navigator.mediaSession.setActionHandler("play", () => {});
    navigator.mediaSession.setActionHandler("pause", () => {});

    if (track && playing) {
      navigator.mediaSession.playbackState = "playing";
    } else {
      navigator.mediaSession.playbackState = "paused";
    }
  }, [track, playing, onPrev, onNext, onSeek]);
}
