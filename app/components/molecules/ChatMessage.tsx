"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/app/lib/types";
import type { ChatMessage as ChatMessageModel } from "@/app/lib/types";
import { useI18n, type DictKey } from "@/app/lib/i18n";
import { usePlayer } from "@/app/context/PlayerContext";
import { useAgent } from "@/app/context/AgentContext";
import { useDanmaku } from "@/app/context/DanmakuContext";

type Props = { message: ChatMessageModel };

type ContentPart =
  | { type: "text"; text: string }
  | { type: "tracks"; tracks: Track[] }
  | { type: "added"; tracks: Track[] };

const FENCED_RE = /```(?:tracks|json|added)?\s*\n([\s\S]*?)```/g;

function looksLikeTracks(arr: unknown[]): arr is Track[] {
  if (arr.length === 0) return false;
  const first = arr[0] as Record<string, unknown>;
  return typeof first === "object" && first !== null && "title" in first;
}

function tryParseTrackArray(raw: string): Track[] | null {
  try {
    const trimmed = raw.trim();
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && looksLikeTracks(parsed)) return parsed;
    if (parsed?.tracks && Array.isArray(parsed.tracks) && looksLikeTracks(parsed.tracks))
      return parsed.tracks;
  } catch { /* not valid JSON */ }
  return tryExtractTracksFromRaw(raw);
}

const OBJ_RE = /\{([^}]*)\}/g;

function tryExtractTracksFromRaw(raw: string): Track[] | null {
  const tracks: Track[] = [];
  OBJ_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OBJ_RE.exec(raw)) !== null) {
    const obj = m[1];
    const bvid = obj.match(/"bvid"\s*:\s*"([^"]+)"/)?.[1];
    const id = obj.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
    const title = obj.match(/"title"\s*:\s*"([\s\S]+?)"\s*,\s*"(?:author|duration|url|bvid|id)"/)?.[1];
    const author = obj.match(/"author"\s*:\s*"([\s\S]+?)"\s*,\s*"(?:duration|url|bvid)"/)?.[1];
    const duration = obj.match(/"duration"\s*:\s*"([^"]+)"/)?.[1];
    const url = obj.match(/"url"\s*:\s*"([^"]+)"/)?.[1];

    const trackId = bvid || id;
    if (trackId && title) {
      tracks.push({
        id: trackId,
        ...(bvid ? { bvid } : {}),
        title,
        author: author ?? "",
        ...(duration ? { duration } : {}),
        url: url ?? "",
        date: "",
        filename: "",
        subDir: "",
        size: 0,
      } as Track);
    }
  }
  OBJ_RE.lastIndex = 0;
  return tracks.length > 0 ? tracks : null;
}

function detectTag(matchStr: string): "tracks" | "added" {
  if (matchStr.startsWith("```added")) return "added";
  return "tracks";
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let last = 0;

  FENCED_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCED_RE.exec(content)) !== null) {
    const tracks = tryParseTrackArray(match[1]);
    if (match.index > last) {
      parts.push({ type: "text", text: content.slice(last, match.index) });
    }
    if (tracks) {
      const tag = detectTag(match[0]);
      parts.push({ type: tag, tracks });
    } else {
      parts.push({ type: "text", text: match[1] });
    }
    last = match.index + match[0].length;
  }

  if (last < content.length) {
    const remainder = content.slice(last);
    const bare = remainder.match(/(\[[\s\n]*\{[\s\S]*?\}[\s\n]*\])/);
    if (bare) {
      const tracks = tryParseTrackArray(bare[1]);
      if (tracks) {
        const idx = remainder.indexOf(bare[1]);
        if (idx > 0) parts.push({ type: "text", text: remainder.slice(0, idx) });
        parts.push({ type: "tracks", tracks });
        const end = idx + bare[1].length;
        if (end < remainder.length) parts.push({ type: "text", text: remainder.slice(end) });
        return parts;
      }
    }
    parts.push({ type: "text", text: remainder });
  }
  return parts;
}

type TrackExt = Track & { bvid?: string; duration?: string };

function AddedCards({ tracks }: { tracks: TrackExt[] }) {
  const { addTracks } = usePlayer();
  const { t } = useI18n();
  const didAutoAdd = useRef(false);

  useEffect(() => {
    if (!didAutoAdd.current && tracks.length > 0) {
      didAutoAdd.current = true;
      addTracks(tracks);
    }
  }, [tracks, addTracks]);

  return (
    <div
      className="my-2 overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--color-outline-dim)" }}
    >
      <div
        className="px-3 py-2"
        style={{ backgroundColor: "var(--color-surface-raised)" }}
      >
        <span
          className="text-[11px] font-semibold tracking-[var(--tracking-label)]"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-primary)" }}
        >
          [{tracks.length} {t("tracksAdded")}]
        </span>
      </div>
      <div className="max-h-[16rem] overflow-y-auto scrollbar-thin">
        {tracks.map((tr, i) => (
          <div
            key={tr.id || i}
            className="flex items-center gap-2 border-t px-3 py-2"
            style={{ borderColor: "var(--color-outline-dim)" }}
          >
            <div className="min-w-0 flex-1">
              <p
                className="m-0 truncate text-sm"
                style={{ fontFamily: "var(--font-body)", color: "var(--color-on-surface)" }}
              >
                {tr.title}
              </p>
              <p className="m-0 truncate text-xs opacity-60" style={{ fontFamily: "var(--font-body)" }}>
                {tr.author}
                {tr.duration && <span className="ml-2 opacity-70">{tr.duration}</span>}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[var(--tracking-label)] opacity-50"
              style={{
                fontFamily: "var(--font-body)",
                borderColor: "var(--color-outline-dim)",
                color: "var(--color-outline)",
              }}
            >
              {t("added")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ButtonState = "add" | "queued" | "converting" | "added";

function getButtonState(
  track: TrackExt,
  inPlaylist: Set<string>,
  convertQueue: string[],
  convertingSet: Set<string>,
  convertedSet: Set<string>
): ButtonState {
  if (inPlaylist.has(track.id) || (track.bvid && inPlaylist.has(track.bvid))) return "added";
  if (track.bvid) {
    if (convertedSet.has(track.bvid)) return "added";
    if (convertingSet.has(track.bvid)) return "converting";
    if (convertQueue.includes(track.bvid)) return "queued";
  }
  return "add";
}

function TrackCards({ tracks }: { tracks: TrackExt[] }) {
  const { state, addTracks } = usePlayer();
  const { queueConvert, convertQueue, convertingSet, convertedSet } = useAgent();
  const { fetchDanmaku } = useDanmaku();
  const { t } = useI18n();
  const inPlaylist = new Set(state.playlist.map((tr) => tr.id));

  const isCloud = tracks.some((tr) => tr.bvid);

  const allDone = tracks.every((tr) => {
    const s = getButtonState(tr, inPlaylist, convertQueue, convertingSet, convertedSet);
    return s !== "add";
  });

  const handleAdd = (track: TrackExt) => {
    if (track.bvid) {
      queueConvert([track.bvid]);
      fetchDanmaku(track.bvid);
    } else {
      addTracks([track]);
    }
  };

  const handleAddAll = () => {
    if (isCloud) {
      const bvids = tracks
        .filter((t) => t.bvid && getButtonState(t, inPlaylist, convertQueue, convertingSet, convertedSet) === "add")
        .map((t) => t.bvid!);
      if (bvids.length) {
        queueConvert(bvids);
        bvids.forEach((bv) => fetchDanmaku(bv));
      }
    } else {
      addTracks(tracks);
    }
  };

  return (
    <div
      className="my-2 overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--color-outline-dim)" }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2"
        style={{ backgroundColor: "var(--color-surface-raised)" }}
      >
        <span
          className="text-[11px] font-semibold tracking-[var(--tracking-label)]"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-outline)" }}
        >
          [{tracks.length} tracks]
        </span>
        <button
          onClick={handleAddAll}
          disabled={allDone}
          className="rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[var(--tracking-label)] transition-opacity disabled:opacity-40"
          style={{
            fontFamily: "var(--font-body)",
            borderColor: "var(--color-primary)",
            color: "var(--color-primary)",
          }}
        >
          {allDone ? t("allAdded") : t("addAll")}
        </button>
      </div>
      <div className="max-h-[16rem] overflow-y-auto scrollbar-thin">
        {tracks.map((tr) => {
          const btnState = getButtonState(tr, inPlaylist, convertQueue, convertingSet, convertedSet);
          const cfg = BTN_CONFIG[btnState];
          const label = cfg.labelKey === "Add" ? cfg.labelKey : t(cfg.labelKey as DictKey);
          return (
            <div
              key={tr.bvid || tr.id}
              className="flex items-center gap-2 border-t px-3 py-2"
              style={{ borderColor: "var(--color-outline-dim)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-sm" style={{ fontFamily: "var(--font-body)" }}>
                  {tr.bvid ? (
                    <a
                      href={`https://www.bilibili.com/video/${tr.bvid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:underline"
                      style={{ color: "var(--color-primary)" }}
                      title={tr.title}
                    >
                      {tr.title}
                    </a>
                  ) : (
                    <span style={{ color: "var(--color-on-surface)" }}>{tr.title}</span>
                  )}
                </p>
                <p className="m-0 truncate text-xs opacity-60" style={{ fontFamily: "var(--font-body)" }}>
                  {tr.author}
                  {tr.duration && <span className="ml-2 opacity-70">{tr.duration}</span>}
                </p>
              </div>
              <button
                onClick={() => handleAdd(tr)}
                disabled={cfg.disabled}
                className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[var(--tracking-label)] transition-opacity disabled:opacity-40"
                style={{
                  fontFamily: "var(--font-body)",
                  borderColor: cfg.disabled ? "var(--color-outline-dim)" : "var(--color-primary)",
                  color: cfg.disabled ? "var(--color-outline)" : "var(--color-primary)",
                }}
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const BTN_CONFIG: Record<ButtonState, { labelKey: string; disabled: boolean }> = {
  add: { labelKey: "Add", disabled: false },
  queued: { labelKey: "queued", disabled: true },
  converting: { labelKey: "converting", disabled: true },
  added: { labelKey: "added", disabled: true },
};

function labelFor(role: ChatMessageModel["role"], t: (key: DictKey) => string) {
  if (role === "agent") return t("agentLabel");
  if (role === "operator") return t("operatorLabel");
  if (role === "tool") return t("toolLabel");
  return t("sysLabel");
}

function formatTs(ts: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(ts);
  } catch {
    return String(ts);
  }
}

function ToolMessage({ message: m }: Props) {
  const [open, setOpen] = useState(false);
  const firstLine = m.content.split("\n")[0] ?? "";
  const rest = m.content.slice(firstLine.length + 1);
  const toolLabel = m.toolName || firstLine.split(/\s/)[0] || "Tool";

  return (
    <article className="mb-1 flex w-full justify-start">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[min(100%,38rem)] cursor-pointer items-start gap-1.5 border-l-[3px] border-transparent py-1 pl-4 pr-4 text-left rounded-r-lg transition-opacity hover:opacity-90"
        style={{
          borderLeftColor: "var(--color-secondary)",
          opacity: open ? 0.8 : 0.5,
          backgroundColor: open ? "color-mix(in srgb, var(--color-secondary) 4%, transparent)" : "transparent",
        }}
      >
        <span
          className="mt-px shrink-0 text-[10px]"
          style={{ color: "var(--color-outline)" }}
        >
          {open ? "▾" : "▸"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline min-w-0">
            <span
              className="shrink-0 text-[10px] font-medium tracking-[var(--tracking-label)]"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-secondary)" }}
            >
              [{toolLabel}]
            </span>
            {!open && rest && (
              <span
                className="ml-1.5 truncate text-[11px]"
                style={{ fontFamily: "var(--font-body)", color: "var(--color-outline)" }}
              >
                {rest.slice(0, 80)}
              </span>
            )}
          </div>
          {open && rest && (
            <pre
              className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-outline)" }}
            >
              {rest}
            </pre>
          )}
        </div>
      </button>
    </article>
  );
}

export function ChatMessage({ message: m }: Props) {
  const { t } = useI18n();
  if (m.role === "tool") return <ToolMessage message={m} />;

  const isOp = m.role === "operator";
  const label = labelFor(m.role, t);

  const bgAgent = m.role === "agent";

  const parts = m.role === "agent" ? parseContent(m.content) : null;

  return (
    <article className={`mb-6 flex w-full ${isOp ? "justify-end" : "justify-start"}`}>
      <div
        className={
          `max-w-[min(100%,38rem)] rounded-xl ` +
          (isOp ? "pr-4 pt-3 pb-3 " : "pl-4 pr-4 pt-3 pb-3") +
          (bgAgent ? "bg-[color:var(--color-surface-raised)]" : "")
        }
        style={isOp && bgAgent ? { border: "1px solid var(--color-outline-dim)" } : undefined}
      >
        <div
          className={`mb-3 flex flex-wrap items-baseline gap-2 opacity-92 ${isOp ? "justify-end" : ""}`}
        >
          <span
            className="text-[10px] font-medium tracking-[var(--tracking-label)]"
            style={{ fontFamily: "var(--font-body)", color: isOp ? "var(--color-primary)" : "var(--color-outline)" }}
          >
            {label}
          </span>
          <span className="text-[11px] text-[color:var(--color-outline)]">{formatTs(m.timestamp)}</span>
        </div>
        {parts ? (
          <div className={isOp ? "text-right" : "text-left"}>
            {parts.map((part, i) => {
              if (part.type === "added") return <AddedCards key={i} tracks={part.tracks} />;
              if (part.type === "tracks") return <TrackCards key={i} tracks={part.tracks} />;
              return (
                <pre
                  key={i}
                  className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed"
                  style={{ fontFamily: "var(--font-body)", color: "var(--color-on-surface)" }}
                >
                  {part.text}
                </pre>
              );
            })}
          </div>
        ) : (
          <pre
            className={`m-0 whitespace-pre-wrap break-words text-sm leading-relaxed ${isOp ? "text-right" : "text-left"}`}
            style={{ fontFamily: "var(--font-body)", color: "var(--color-on-surface)" }}
          >
            {m.content}
          </pre>
        )}
      </div>
    </article>
  );
}
