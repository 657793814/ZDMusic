"use client";

import type { DanmakuItem } from "@/app/lib/bili";
import { useDanmaku } from "@/app/context/DanmakuContext";
import { usePlayer } from "@/app/context/PlayerContext";
import { useCallback, useEffect, useRef, useState } from "react";

const SCROLL_DURATION = 12;
const LOOKAHEAD = 0.4;
const MAX_LANES = 12;
const LANE_HEIGHT = 32; // px per lane

type ActiveDanmaku = DanmakuItem & { spawnId: number; lane: number };

let spawnIdCounter = 0;

export function DanmakuOverlay() {
  const { state } = usePlayer();
  const { enabled, currentDanmaku } = useDanmaku();

  const [active, setActive] = useState<ActiveDanmaku[]>([]);
  const lastProgressRef = useRef(0);
  const lastIndexRef = useRef(0);

  // Track lane occupancy: lane -> timer ID (when it'll be free)
  const laneTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const progress = state.progress;

  // Find the lowest available lane
  const findFreeLane = useCallback((occupiedLanes: Set<number>): number => {
    for (let i = 0; i < MAX_LANES; i++) {
      if (!occupiedLanes.has(i)) return i;
    }
    // All lanes occupied, recycle the oldest (lowest) one
    return 0;
  }, []);

  const spawnDanmaku = useCallback(
    (item: DanmakuItem) => {
      // Check current active lanes
      setActive((prev) => {
        const occupied = new Set(prev.map((d) => d.lane));
        const lane = findFreeLane(occupied);
        const spawnId = ++spawnIdCounter;

        // Schedule cleanup of this lane
        const existing = laneTimersRef.current.get(lane);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
          setActive((prev) => prev.filter((d) => d.spawnId !== spawnId));
          laneTimersRef.current.delete(lane);
        }, SCROLL_DURATION * 1000);

        laneTimersRef.current.set(lane, timer);

        return [...prev, { ...item, spawnId, lane }];
      });
    },
    [findFreeLane]
  );

  useEffect(() => {
    if (!enabled || !currentDanmaku.length) {
      setActive([]);
      lastIndexRef.current = 0;
      lastProgressRef.current = progress;
      return;
    }

    const delta = progress - lastProgressRef.current;
    const seeked = delta < -1 || delta > 3;
    lastProgressRef.current = progress;

    if (seeked) {
      setActive([]);
      lastIndexRef.current = 0;
      if (progress <= 0) return;
      const resumeIdx = currentDanmaku.findIndex(
        (d) => d.time >= progress - LOOKAHEAD
      );
      lastIndexRef.current = Math.max(0, resumeIdx);
    }

    const target = progress + LOOKAHEAD;
    const items = currentDanmaku;
    let idx = lastIndexRef.current;
    while (idx < items.length && items[idx]!.time <= target) {
      spawnDanmaku(items[idx]!);
      idx++;
    }
    lastIndexRef.current = idx;
  }, [progress, enabled, currentDanmaku, spawnDanmaku]);

  if (!enabled || !active.length) return null;

  return (
    <>
      <style>{`
        @keyframes dm-scroll {
          from { transform: translate3d(100vw, 0, 0); }
          to   { transform: translate3d(-100%, 0, 0); }
        }
      `}</style>
      {active.map((d) => {
        const topPx = `${d.lane * LANE_HEIGHT + 8}px`;
        return (
          <span
            key={d.spawnId}
            className="pointer-events-none fixed z-50 whitespace-nowrap text-sm font-semibold leading-7 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]"
            style={{
              top: topPx,
              left: 0,
              animation: `dm-scroll ${SCROLL_DURATION}s linear forwards`,
              color: d.color,
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              textShadow:
                "0 0 4px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.95)",
              zIndex: 9999,
              willChange: "transform",
            }}
          >
            {d.content}
          </span>
        );
      })}
    </>
  );
}
