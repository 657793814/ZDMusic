"use client";

import type { Track } from "@/app/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioPlayer(options?: { onEnded?: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(options?.onEnded);
  useEffect(() => {
    onEndedRef.current = options?.onEnded;
  }, [options?.onEnded]);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const volumeRef = useRef(0.8);
  const [rate, setRateState] = useState(1);
  const rateRef = useRef(1);

  const setAudioRef = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el;
    setAudioElement(el);
  }, []);

  useEffect(() => {
    const el = audioElement;
    if (!el) return;

    const syncDuration = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const syncProgress = () =>
      setProgress(Number.isFinite(el.currentTime) ? el.currentTime : 0);
    const syncPlayFlags = () => setPlaying(true);
    const syncPauseFlags = () => setPlaying(false);
    const syncEnded = () => {
      setPlaying(false);
      onEndedRef.current?.();
    };
    const syncVol = () =>
      setVolumeState(Number.isFinite(el.volume) ? el.volume : 1);

    el.addEventListener("loadedmetadata", syncDuration);
    el.addEventListener("durationchange", syncDuration);
    el.addEventListener("timeupdate", syncProgress);
    el.addEventListener("play", syncPlayFlags);
    el.addEventListener("playing", syncPlayFlags);
    el.addEventListener("pause", syncPauseFlags);
    el.addEventListener("ended", syncEnded);
    el.addEventListener("volumechange", syncVol);

    el.volume = volumeRef.current;
    el.playbackRate = rateRef.current;
    setVolumeState(el.volume);
    syncDuration();
    syncProgress();

    return () => {
      el.removeEventListener("loadedmetadata", syncDuration);
      el.removeEventListener("durationchange", syncDuration);
      el.removeEventListener("timeupdate", syncProgress);
      el.removeEventListener("play", syncPlayFlags);
      el.removeEventListener("playing", syncPlayFlags);
      el.removeEventListener("pause", syncPauseFlags);
      el.removeEventListener("ended", syncEnded);
      el.removeEventListener("volumechange", syncVol);
    };
  }, [audioElement]);

  const play = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    try { await el.play(); } catch { /* */ }
  }, []);

  const pause = useCallback(() => { audioRef.current?.pause(); }, []);

  const toggle = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) await play();
    else pause();
  }, [play, pause]);

  const seek = useCallback((t: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(t)) return;
    el.currentTime = Math.max(0, Math.min(t, el.duration || t));
    setProgress(el.currentTime);
  }, []);

  const setVolume = useCallback((n: number) => {
    const v = Math.max(0, Math.min(1, n));
    volumeRef.current = v;
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const setRate = useCallback((value: number) => {
    const next = Math.max(0.25, Math.min(4, value));
    rateRef.current = next;
    setRateState(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, []);

  /** 只装载音源，不自动播放（供播放内核控制 autoplay / 淡入） */
  const load = useCallback((url: string) => {
    const el = audioRef.current;
    if (!el) return;
    el.src = url;
    el.load();
    el.playbackRate = rateRef.current;
    setProgress(0);
    setDuration(0);
  }, []);

  const playTrack = useCallback((track: Track) => {
    const el = audioRef.current;
    if (!el) return;
    el.src = track.url;
    el.load();
    el.playbackRate = rateRef.current;
    setProgress(0);
    setDuration(0);
    setPlaying(true);
    el.play().catch(() => { setPlaying(false); });
  }, []);

  return {
    audioRef,
    audioElement,
    setAudioRef,
    playing,
    progress,
    duration,
    volume,
    rate,
    play,
    pause,
    toggle,
    seek,
    setVolume,
    setRate,
    load,
    playTrack,
  };
}
