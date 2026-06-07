"use client";

import type { PlayMode } from "@/app/lib/types";
import { useI18n } from "@/app/lib/i18n";

type Props = {
  playing: boolean;
  disabled: boolean;
  prevDisabled?: boolean;
  onPrev: () => void;
  onToggle: () => void | Promise<void>;
  onNext: () => void;
  onStop: () => void;
  playMode: PlayMode;
  setPlayMode: (mode: PlayMode) => void;
};

const btn =
  "group relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent transition-all duration-150 " +
  "outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-primary)] " +
  "hover:bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] hover:text-[color:var(--color-primary)] " +
  "disabled:opacity-30 disabled:pointer-events-none";

const Tooltip = ({ label }: { label: string }) => (
  <span
    className="pointer-events-none absolute -bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium tracking-[var(--tracking-label)] opacity-0 transition-opacity group-hover:opacity-100"
    style={{
      fontFamily: "var(--font-body)",
      backgroundColor: "var(--color-surface-raised)",
      color: "var(--color-on-surface)",
      border: "1px solid var(--color-outline-dim)",
    }}
  >
    {label}
  </span>
);

function RepeatAllIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}

function RepeatOneIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="9" fill="currentColor" stroke="none" fontWeight="bold">1</text>
    </svg>
  );
}

function ShuffleIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M4 20L21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M16 21l-1-1" />
      <path d="M3 3l6 6" />
    </svg>
  );
}

type ModeBtn = { key: PlayMode; icon: React.ComponentType<{ active: boolean }>; labelKey: string };

const modeBtns: ModeBtn[] = [
  { key: 'playlist', icon: RepeatAllIcon, labelKey: 'repeat' },
  { key: 'single', icon: RepeatOneIcon, labelKey: 'loop' },
  { key: 'shuffle', icon: ShuffleIcon, labelKey: 'shuffle' },
];

export function ControlBar({ playing, disabled, prevDisabled, onPrev, onToggle, onNext, onStop, playMode, setPlayMode }: Props) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label={t("prev")} onClick={onPrev} disabled={disabled || prevDisabled} className={btn}>
        <span className="material-symbols-outlined text-[20px]" style={{ fontSize: "20px" }}>skip_previous</span>
        <Tooltip label={t("prev")} />
      </button>

      <button type="button" aria-label={playing ? t("pause") : t("play")} onClick={() => void onToggle()} disabled={disabled} className={btn}>
        {playing ? (
          <span className="material-symbols-outlined text-[20px]" style={{ fontSize: "20px" }}>pause</span>
        ) : (
          <span className="material-symbols-outlined text-[20px]" style={{ fontSize: "20px" }}>play_arrow</span>
        )}
        <Tooltip label={playing ? t("pause") : t("play")} />
      </button>

      <button type="button" aria-label={t("next")} onClick={onNext} disabled={disabled} className={btn}>
        <span className="material-symbols-outlined text-[20px]" style={{ fontSize: "20px" }}>skip_next</span>
        <Tooltip label={t("next")} />
      </button>

      <button type="button" aria-label={t("stop")} onClick={onStop} disabled={disabled} className={btn}>
        <span className="material-symbols-outlined text-[20px]" style={{ fontSize: "20px" }}>stop</span>
        <Tooltip label={t("stop")} />
      </button>

      {modeBtns.map(({ key, icon: Icon, labelKey }) => {
        const active = playMode === key;
        return (
          <button
            key={key}
            type="button"
            aria-label={t(labelKey as "prev")}
            onClick={() => setPlayMode(key)}
            className={[btn, active && "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[color:var(--color-primary)]"].filter(Boolean).join(" ")}
          >
            <Icon active={active} />
            <Tooltip label={t(labelKey as "prev")} />
          </button>
        );
      })}
    </div>
  );
}
