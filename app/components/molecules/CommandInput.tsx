"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "@/app/lib/i18n";
import { VoiceInput } from "./VoiceInput";

type Props = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function CommandInput({
  onSubmit,
  disabled = false,
  placeholder,
}: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [cursorLeft, setCursorLeft] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const syncCursor = useCallback(() => {
    const input = inputRef.current;
    const measure = measureRef.current;
    if (!input || !measure) return;
    const pos = input.selectionStart ?? valueRef.current.length;
    measure.textContent = valueRef.current.slice(0, pos);
    setCursorLeft(measure.offsetWidth);
  }, []);

  useEffect(() => {
    syncCursor();
  }, [value, syncCursor]);

  const submit = useCallback(() => {
    const trimmed = valueRef.current.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  }, [disabled, onSubmit]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }
    requestAnimationFrame(syncCursor);
  };

  const onVoiceRecognize = useCallback((text: string) => {
    if (text.trim()) {
      setValue(text.trim());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-full border bg-[var(--color-surface-raised)] px-4 py-2.5 transition-colors focus-within:border-[color:var(--color-primary)]"
        style={{
          borderColor: "var(--color-outline-dim)",
        }}
      >
        <span
          className="shrink-0 select-none text-[color:var(--color-primary)]"
          aria-hidden
          style={{ fontFamily: "ui-monospace, monospace" }}
        >
          {"›"}
        </span>
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={value}
            placeholder={placeholder ?? t("placeholder")}
            onChange={(e) => {
              setValue(e.target.value);
              requestAnimationFrame(syncCursor);
            }}
            onKeyDown={onKeyDown}
            onKeyUp={syncCursor}
            onSelect={syncCursor}
            onClick={syncCursor}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full border-0 bg-transparent p-0 text-sm text-[color:var(--color-on-surface)] outline-none placeholder:text-[color:var(--color-outline)]"
            style={{
              fontFamily: "ui-monospace, monospace",
              caretColor: "transparent",
              letterSpacing: "0.045em",
            }}
          />
          <span
            ref={measureRef}
            className="pointer-events-none absolute top-0 left-0 whitespace-pre text-sm"
            aria-hidden
            style={{ letterSpacing: "0.045em", color: "transparent" }}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              backgroundColor: "var(--color-primary)",
              width: "2px",
              height: "1.3em",
              borderRadius: "2px",
              left: `${cursorLeft}px`,
              top: "4px",
              display: disabled ? "none" : "block",
              animation: disabled ? "none" : "blink 1.05s steps(1, end) infinite",
            }}
          />
        </div>
        <VoiceInput onRecognize={onVoiceRecognize} disabled={disabled} />
      </div>
    </div>
  );
}
