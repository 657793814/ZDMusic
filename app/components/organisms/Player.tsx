"use client";


import { ControlBar } from "@/app/components/molecules/ControlBar";
import { SeekBar } from "@/app/components/molecules/SeekBar";
import { TrackInfo } from "@/app/components/molecules/TrackInfo";
import { VolumeControl } from "@/app/components/molecules/VolumeControl";
import { SpectrumBars } from "@/app/components/atoms/SpectrumBars";
import { usePlayer } from "@/app/context/PlayerContext";

export function Player() {
  const { state, next, prev, togglePlay, stop, seek, setVolume, playMode, setPlayMode, analyser, vizReady, flipped, toggleFlip, lyricsOpen, toggleLyrics } = usePlayer();

  return (
    <div
      className="flex flex-col gap-[0.375rem] rounded-2xl p-3 md:gap-2 md:p-4"
      style={{
        backgroundColor: "var(--color-surface-dim)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
      }}
    >
      <TrackInfo track={state.current} playing={state.playing} />

      {/* 频谱柱状图 — 紧贴 TrackInfo，与控件行共享空间 */}
      <div className="flex -mt-3 -mb-1 items-center justify-center">
        <SpectrumBars analyser={analyser} playing={state.playing} />
      </div>

      <div className="flex items-center justify-between gap-3 md:gap-4">
        <ControlBar
          playing={state.playing}
          disabled={state.playlist.length === 0}
          prevDisabled={state.index <= 0}
          onPrev={prev}
          onToggle={togglePlay}
          onNext={next}
          onStop={stop}
          playMode={playMode}
          setPlayMode={setPlayMode}
        />
        <div className="flex items-center gap-2">
          {/* 歌词按钮 */}
          <button
            type="button"
            onClick={toggleLyrics}
            className="flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
            style={{
              borderColor: "var(--color-outline-dim)",
              color: lyricsOpen ? "var(--color-primary)" : "var(--color-outline)",
              fontFamily: "var(--font-body)",
            }}
            aria-label={lyricsOpen ? "关闭歌词" : "歌词"}
            title={lyricsOpen ? "关闭歌词" : "歌词"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </button>

          {/* 页面翻转按钮 */}
          <button
            type="button"
            onClick={toggleFlip}
            className="flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
            style={{
              borderColor: "var(--color-outline-dim)",
              color: flipped ? "var(--color-primary)" : "var(--color-outline)",
              fontFamily: "var(--font-body)",
            }}
            aria-label={flipped ? "退出全屏" : "全屏沉浸"}
            title={flipped ? "退出全屏" : "全屏沉浸"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v18" />
              <path d="M3 12h18" />
              <path d="M5 7l7-4 7 4" />
              <path d="M5 17l7 4 7-4" />
            </svg>
          </button>
          <VolumeControl volume={state.volume} onChange={setVolume} />
        </div>
      </div>
      <SeekBar progress={state.progress} duration={state.duration} playing={state.playing} onSeek={seek} />
    </div>
  );
}
