"use client";

import { useEffect, useRef } from "react";

type Props = {
  analyser: AnalyserNode | null;
  playing: boolean;
  onExit: () => void;
};

/** 一颗 3D 深空星 */
interface WarpStar {
  x: number;       // -1 ~ 1
  y: number;       // -1 ~ 1
  z: number;       // 0=眼前 1=无穷远
  hue: number;
  size: number;
  speed: number;   // 个体速度偏移
}

const STAR_COUNT = 180;
const FOCAL = 0.8;     // 投影焦距

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

function createWarpStar(): WarpStar {
  return {
    x: rand(-1, 1),
    y: rand(-1, 1),
    z: rand(0.5, 1),       // 分布在较远区域
    hue: rand(200, 330),
    size: rand(0.2, 0.8),
    speed: rand(0.6, 1.4),
  };
}

export function FullScreenVisualizer({ analyser, playing, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stopped = false;
    let rafId: number;
    const stars: WarpStar[] = [];
    const freq = new Uint8Array(analyser?.frequencyBinCount ?? 128);
    let avg = 0;
    let bass = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) stars.push(createWarpStar());
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (stopped) return;
      rafId = requestAnimationFrame(draw);

      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;

      // ── 频谱分析 ──
      if (analyser && playing) {
        analyser.getByteFrequencyData(freq);
        let s = 0;
        for (let i = 0; i < freq.length; i++) s += freq[i];
        avg = avg * 0.85 + (s / freq.length / 255) * 0.15;
        const bc = Math.floor(freq.length / 3);
        let bs = 0;
        for (let i = 0; i < bc; i++) bs += freq[i];
        bass = bass * 0.6 + (bs / bc / 255) * 0.4;
      } else {
        avg *= 0.95;
        bass *= 0.95;
      }

      ctx!.clearRect(0, 0, w, h);

      // ═══ 背景星云光晕（随能量脉动）═══
      const nebulaA = 0.1 + avg * 0.12;
      // 左侧泛紫
      const lg = ctx!.createRadialGradient(cx * 0.2, cy, 0, cx * 0.2, cy, w * 0.55);
      lg.addColorStop(0, `hsla(260, 80%, 55%, ${nebulaA})`);
      lg.addColorStop(0.6, `hsla(240, 60%, 40%, ${nebulaA * 0.4})`);
      lg.addColorStop(1, "hsla(240, 60%, 40%, 0)");
      ctx!.fillStyle = lg;
      ctx!.fillRect(0, 0, w, h);
      // 右侧泛粉
      const rg = ctx!.createRadialGradient(w * 0.8, cy * 0.7, 0, w * 0.8, cy * 0.7, w * 0.5);
      rg.addColorStop(0, `hsla(300, 80%, 60%, ${nebulaA * 0.7})`);
      rg.addColorStop(0.5, `hsla(280, 60%, 45%, ${nebulaA * 0.35})`);
      rg.addColorStop(1, "hsla(280, 60%, 45%, 0)");
      ctx!.fillStyle = rg;
      ctx!.fillRect(0, 0, w, h);

      // ═══ 曲速穿越 - 星场 ═══
      const warpSpeed = 0.004 + bass * 0.025 + avg * 0.015;
      const vScale = 0.55; // 垂直压缩

      for (const s of stars) {
        // 向屏幕移动（z 减小）
        s.z -= warpSpeed * s.speed;

        // 超过眼前 → 重置到远处
        if (s.z <= 0.001) {
          s.z = rand(0.85, 1);
          s.x = rand(-1, 1);
          s.y = rand(-1, 1);
          s.hue = rand(200, 330);
          s.size = rand(0.2, 0.8);
          // 重置时随机偏移位置，但避免过于集中在中心
          continue;
        }

        // 3D → 2D 投影
        const px = cx + (s.x / s.z) * w * FOCAL;
        const py = cy + (s.y / s.z) * h * FOCAL * vScale;

        // 超出屏幕范围 → 重置
        if (px < -50 || px > w + 50 || py < -50 || py > h + 50) {
          s.z = rand(0.85, 1);
          s.x = rand(-1, 1);
          s.y = rand(-1, 1);
          continue;
        }

        // 星星大小随 z 接近而增大（但限制最大）
        const nearFactor = 1 / Math.max(0.15, s.z);
        let sz = s.size * nearFactor * 0.012 * Math.min(w, h) * 0.5;
        sz = Math.min(sz, 10); // 最大 10px

        // 亮度：越近越亮 + 能量加成
        const brightness = Math.min(1, (1 - s.z) * 2);
        const al = Math.min(1, brightness * (0.6 + avg * 0.4));

        // 色相：远处蓝紫，近处变亮白
        const hue = s.hue - (1 - s.z) * 40;
        const lt = 60 + (1 - s.z) * 35 + avg * 20;

        // ── 星星发光核心（带光晕） ──
        if (sz > 0.3) {
          // 外光晕
          ctx!.shadowBlur = 0;
          const glowR = Math.min(sz * 2.5, 25);
          const outerGlow = ctx!.createRadialGradient(px, py, 0, px, py, glowR);
          outerGlow.addColorStop(0, `hsla(${hue}, 80%, ${lt + 10}%, ${al * 0.12 * (1 - s.z)})`);
          outerGlow.addColorStop(0.5, `hsla(${hue + 5}, 60%, ${lt + 5}%, ${al * 0.04 * (1 - s.z)})`);
          outerGlow.addColorStop(1, `hsla(${hue + 10}, 50%, ${lt}%, 0)`);
          ctx!.fillStyle = outerGlow;
          ctx!.fillRect(px - glowR, py - glowR, glowR * 2, glowR * 2);

          // 星星本体（小光点，无 shadowBlur 纯柔和）
          ctx!.shadowBlur = 0;
          ctx!.beginPath();
          ctx!.arc(px, py, Math.max(0.2, sz), 0, Math.PI * 2);
          ctx!.fillStyle = `hsla(${hue}, ${80 - (1 - s.z) * 20}%, ${lt}%, ${al * 0.8})`;
          ctx!.fill();
        }
      }

      // ═══ 底部能量柱 ═══
      if (analyser && playing && freq.length > 0) {
        const step = Math.max(1, Math.floor(freq.length / 64));
        const maxBarH = h * 0.15;
        const barW = 4;
        const gap = 2;
        const totalW = 64 * (barW + gap);
        const startX = (w - totalW) / 2;
        for (let i = 0; i < 64; i++) {
          let s = 0;
          const st = i * step;
          const en = Math.min(st + step, freq.length);
          for (let j = st; j < en; j++) s += freq[j];
          const norm = s / (en - st) / 255;
          const barH = Math.max(2, norm * maxBarH);
          const x = startX + i * (barW + gap);
          const y = h - barH;
          const hue = 250 - norm * 150;
          ctx!.shadowBlur = 4 + norm * 8;
          ctx!.shadowColor = `hsla(${hue}, 90%, 65%, ${norm * 0.35})`;
          ctx!.fillStyle = `hsla(${hue}, 80%, ${50 + norm * 30}%, ${0.5 + norm * 0.3})`;
          ctx!.fillRect(x, y, barW, barH);
          ctx!.shadowBlur = 6 + norm * 10;
          ctx!.shadowColor = `hsla(${hue}, 100%, 85%, ${norm * 0.4})`;
          ctx!.beginPath();
          ctx!.arc(x + barW / 2, y, 1 + norm * 1.2, 0, Math.PI * 2);
          ctx!.fillStyle = `hsla(${hue}, 100%, 90%, ${0.25 + norm * 0.4})`;
          ctx!.fill();
        }
        ctx!.shadowBlur = 0;
      }

      // ═══ 中心光晕（曲速核心）═══
      const coreSz = 8 + avg * 15 + bass * 12;
      const cg = ctx!.createRadialGradient(cx, cy * 0.9, 0, cx, cy * 0.9, coreSz);
      cg.addColorStop(0, `hsla(280, 100%, 100%, ${0.5 + avg * 0.4 + bass * 0.3})`);
      cg.addColorStop(0.2, `hsla(275, 90%, 80%, ${0.25 + avg * 0.3})`);
      cg.addColorStop(0.5, `hsla(265, 70%, 60%, ${0.1 + avg * 0.15})`);
      cg.addColorStop(1, "hsla(260, 60%, 50%, 0)");
      ctx!.fillStyle = cg;
      ctx!.fillRect(cx - coreSz, cy * 0.9 - coreSz, coreSz * 2, coreSz * 2);

      ctx!.shadowBlur = 0;
    }

    draw();
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [analyser, playing]);

  return (
    <div className="fixed inset-0 z-50" style={{ backgroundColor: "#05050a" }}>
      <canvas ref={canvasRef} className="fixed inset-0" aria-hidden />
      <div
        className="fixed top-5 left-0 right-0 z-50 flex items-center justify-center gap-3"
        style={{ pointerEvents: "none" }}
      >
        <span style={{ color: "var(--color-on-surface)", fontFamily: "var(--font-body)", fontSize: "11px", letterSpacing: "0.1em", opacity: 0.45 }}>
          按 ESC 退出
        </span>
        <button
          type="button"
          onClick={onExit}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            color: "var(--color-on-surface)",
            border: "1px solid rgba(255,255,255,0.15)",
            pointerEvents: "auto",
          }}
          aria-label="退出全屏"
          title="退出全屏 (ESC)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
