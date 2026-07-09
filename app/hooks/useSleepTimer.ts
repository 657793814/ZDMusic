"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SleepTimerDuration = 0 | 15 | 30 | 45 | 60 | 90;

export function useSleepTimer(onTimeUp: () => void) {
  const [active, setActive] = useState(false);
  const [duration, setDuration] = useState<SleepTimerDuration>(0);
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const endTimeRef = useRef(0);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  const start = useCallback((minutes: SleepTimerDuration) => {
    stop();
    if (minutes <= 0) return;
    setDuration(minutes);
    setActive(true);
    const endMs = Date.now() + minutes * 60000;
    endTimeRef.current = endMs;
    setRemaining(minutes * 60);

    intervalRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        stop();
        onTimeUpRef.current();
      }
    }, 1000);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    setDuration(0);
    setRemaining(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  const addMinutes = useCallback((minutes: number) => {
    if (!active) {
      start(minutes as SleepTimerDuration);
      return;
    }
    endTimeRef.current += minutes * 60000;
    setDuration((d) => (d + minutes) as SleepTimerDuration);
  }, [active, start]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { active, duration, remaining, start, stop, addMinutes };
}
