"use client";

import { Badge } from "@/app/components/atoms/Badge";
import { GlowDot } from "@/app/components/atoms/GlowDot";
import { ModeSwitch } from "@/app/components/atoms/ModeSwitch";
import { Label } from "@/app/components/atoms/Label";
import { ChatMessage } from "@/app/components/molecules/ChatMessage";
import { CommandInput } from "@/app/components/molecules/CommandInput";
import { useAgent } from "@/app/context/AgentContext";
import { useI18n } from "@/app/lib/i18n";
import { useEffect, useMemo, useRef } from "react";

const ThinkingCard = (
  <article className="mb-2 flex w-full justify-start" key="__thinking__">
    <div className="max-w-[min(100%,38rem)] rounded-lg bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)] px-4 py-3">
      <div className="mb-2 flex items-baseline gap-2">
        <span
          className="text-[10px] font-medium tracking-[var(--tracking-label)]"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-primary)" }}
        >
          __AGENT_LABEL__
        </span>
        <span
          className="text-[10px] font-medium tracking-[var(--tracking-label)] opacity-70"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-outline)" }}
        >
          __THINKING__
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: "var(--color-primary)",
              animation: `thinking-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  </article>
);

export function AgentChat() {
  const { messages, loading, sessionId, sendMessage, cancel, stageMsg } = useAgent();
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  const showThinking = loading && (messages.length === 0 || messages[messages.length - 1].role !== "agent");

  // ThinkingCard with i18n text injected
  const thinkingCardWithText = useMemo(() => {
    return (
      <article className="mb-2 flex w-full justify-start" key="__thinking__">
        <div className="max-w-[min(100%,38rem)] rounded-lg bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)] px-4 py-3">
          <div className="mb-2 flex items-baseline gap-2">
            <span
              className="text-[10px] font-medium tracking-[var(--tracking-label)]"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-primary)" }}
            >
              {t("agentLabel")}
            </span>
            <span
              className="text-[10px] font-medium tracking-[var(--tracking-label)] opacity-70"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-outline)" }}
            >
              {stageMsg || t("thinking")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: "var(--color-primary)",
                  animation: `thinking-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </article>
    );
  }, [t("agentLabel"), t("thinking"), stageMsg]);

  const rendered = useMemo(() => {
    if (!showThinking || messages.length === 0) {
      return showThinking
        ? [thinkingCardWithText]
        : messages.map((m) => <ChatMessage key={m.id} message={m} />);
    }

    let insertIdx = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "tool") {
        insertIdx = i + 1;
        break;
      }
    }

    const before = messages.slice(0, insertIdx);
    const after = messages.slice(insertIdx);

    return [
      ...before.map((m) => <ChatMessage key={m.id} message={m} />),
      thinkingCardWithText,
      ...after.map((m) => <ChatMessage key={m.id} message={m} />),
    ];
  }, [messages, showThinking, thinkingCardWithText]);

  return (
    <section
      className="flex h-full min-h-[min(560px,70vh)] w-full flex-1 flex-col overflow-hidden rounded-2xl md:min-h-0"
      style={{
        backgroundColor: "var(--color-surface-dim)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
      }}
    >
      <header
        className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5 md:px-4"
        style={{ borderColor: "var(--color-outline-dim)" }}
      >
        <GlowDot color="primary" />
        <Label size="md" className="text-[color:var(--color-on-surface)]">
          {t("neuralAgent")}
        </Label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ModeSwitch />
          {loading ? (
            <Badge label={t("processing")} variant="primary" />
          ) : (
            <Badge label={t("standby")} variant="default" />
          )}
          {sessionId ? (
            <Badge label={t("sessionOk")} variant="primary" />
          ) : (
            <Badge label={t("noSession")} variant="default" />
          )}
        </div>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-3 md:px-3 md:py-4">
        {messages.length === 0 && !loading ? (
          <p className="px-2 text-center text-sm opacity-55" style={{ fontFamily: "var(--font-body)" }}>
            {t("awaitingInput")}
          </p>
        ) : (
          rendered
        )}
        <div ref={bottomRef} aria-hidden />
      </div>

      <div className="shrink-0 border-t px-3 py-3 md:px-4" style={{ borderColor: "var(--color-outline-dim)" }}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <CommandInput disabled={loading} onSubmit={(txt) => void sendMessage(txt)} />
          </div>
          {loading && (
            <button
              type="button"
              aria-label={t("cancel")}
              onClick={cancel}
              className="group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-transparent transition-colors outline-none focus-visible:ring-1 hover:border-[color:var(--color-error)] hover:text-[color:var(--color-error)]"
              style={{
                borderColor: "var(--color-outline-dim)",
                color: "var(--color-outline)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1" stroke="none" />
              </svg>
              <span
                className="pointer-events-none absolute -bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium tracking-[var(--tracking-label)] opacity-0 transition-opacity group-hover:opacity-100"
                style={{
                  fontFamily: "var(--font-body)",
                  backgroundColor: "var(--color-surface-raised)",
                  color: "var(--color-error)",
                  border: "1px solid var(--color-outline-dim)",
                }}
              >
                {t("stopAgent")}
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
