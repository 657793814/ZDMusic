"use client";

import type { CSSProperties } from "react";

/** 稳定哈希：同一 trackId 永远得到同一形态与色相 */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 无封面占位：按曲目 id 确定性生成抽象几何（唱片纹 / 声波 / 同心环），
 * 不使用任何文字或首字母；有真实封面时不走这里。
 */
export function CoverPlaceholder({ trackId }: { trackId: string }) {
  const h = hashSeed(trackId || "zdmusic");
  const variant = h % 3;
  const hue = h % 360;
  const hue2 = (hue + 42) % 360;

  const style = {
    "--zd-cover-h1": hue,
    "--zd-cover-h2": hue2,
  } as CSSProperties;

  return (
    <span className="zd-cover-ph" style={style} aria-hidden>
      <svg viewBox="0 0 100 100" role="presentation" focusable="false">
        {variant === 0 ? (
          <g fill="none" stroke="currentColor">
            <circle cx="50" cy="50" r="42" strokeWidth="1.2" opacity="0.55" />
            <circle cx="50" cy="50" r="34" strokeWidth="1.4" opacity="0.7" />
            <circle cx="50" cy="50" r="26" strokeWidth="1.6" opacity="0.85" />
            <circle cx="50" cy="50" r="18" strokeWidth="1.8" />
            <circle cx="50" cy="50" r="7" fill="currentColor" stroke="none" opacity="0.9" />
            <path d="M50 8v7M50 85v7M8 50h7M85 50h7" strokeWidth="1.2" opacity="0.5" />
          </g>
        ) : variant === 1 ? (
          <g fill="currentColor">
            {[16, 30, 44, 58, 72, 86].map((x, i) => {
              const bars = [26, 48, 68, 54, 40, 20];
              const len = bars[(h >>> i) % bars.length];
              return (
                <rect
                  key={x}
                  x={x}
                  y={50 - len / 2}
                  width="6"
                  height={len}
                  rx="3"
                  opacity={0.5 + ((h >>> (i + 2)) % 40) / 100}
                />
              );
            })}
          </g>
        ) : (
          <g fill="none" stroke="currentColor">
            <circle cx="50" cy="50" r="38" strokeWidth="1.4" opacity="0.55" />
            <circle cx="50" cy="50" r="28" strokeWidth="1.6" opacity="0.8" />
            <circle cx="50" cy="50" r="18" strokeWidth="1.8" />
            <circle cx="50" cy="50" r="4" fill="currentColor" stroke="none" />
            <path
              d="M50 50l28-19M50 50l-23 25M50 50l-14-29"
              strokeWidth="1.1"
              opacity="0.45"
            />
          </g>
        )}
      </svg>
    </span>
  );
}
