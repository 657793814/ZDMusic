"use client";

import { useEffect, useRef } from "react";

type Props = {
  analyser: AnalyserNode | null;
  playing: boolean;
  onExit: () => void;
};

interface Particle {
  baseAngle: number;
  baseRadius: number;
  px: number;
  py: number;
  size: number;
  hue: number;
  light: number;
  alpha: number;
  phase: number;
}

const BAR_COUNT = 64;
const P_COUNT = 160;

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

function createParticle(w: number, h: number): Particle {
  const angle = rand(0, Math.PI * 2);
  const radius = rand(0.05, 0.9) * Math.min(w, h) * 0.5;
  return {
    baseAngle: angle,
    baseRadius: radius,
    px: w / 2 + Math.cos(angle) * radius,
    py: h / 2 + Math.sin(angle) * radius,
    size: rand(1, 4),
    hue: rand(220, 300),
    light: rand(55, 80),
    alpha: rand(0.3, 0.8),
    phase: rand(0, Math.PI * 2),
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
    const particles: Particle[] = [];
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
      particles.length = 0;
      for (let i = 0; i < P_COUNT; i++) particles.push(createParticle(w, h));
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

      // ═══ 1. 底部音柱 ═══
      if (analyser && playing && freq.length > 0) {
        const step = Math.max(1, Math.floor(freq.length / BAR_COUNT));
        const maxBarH = h * 0.35;
        const barW = 4;
        const gap = 2;
        const totalW = BAR_COUNT * (barW + gap);
        const startX = (w - totalW) / 2;
        const baseY = h;
        for (let i = 0; i < BAR_COUNT; i++) {
          let s = 0;
          const st = i * step;
          const en = Math.min(st + step, freq.length);
          for (let j = st; j < en; j++) s += freq[j];
          const norm = s / (en - st) / 255;
          const barH = Math.max(2, norm * maxBarH);
          const x = startX + i * (barW + gap);
          const y = baseY - barH;
          const hue = 260 - norm * 180;
          ctx!.shadowBlur = 8 + norm * 15;
          ctx!.shadowColor = `hsla(${hue}, 90%, 60%, ${norm * 0.6})`;
          ctx!.fillStyle = `hsla(${hue}, 85%, ${55 + norm * 30}%, ${0.8 + norm * 0.2})`;
          ctx!.fillRect(x, y, barW, barH);
          ctx!.shadowBlur = 10 + norm * 18;
          ctx!.shadowColor = `hsla(${hue}, 100%, 85%, ${norm * 0.7})`;
          ctx!.beginPath();
          ctx!.arc(x + barW / 2, y, 1 + norm * 2, 0, Math.PI * 2);
          ctx!.fillStyle = `hsla(${hue}, 100%, 90%, ${0.5 + norm * 0.5})`;
          ctx!.fill();
        }
        ctx!.shadowBlur = 0;
      }

      // ═══ 2. 粒子 ═══
      const expand = 0.3 + bass * 1.4;
      const maxR = Math.min(w, h) * 0.48;
      for (const p of particles) {
        p.phase += 0.03 * (1 + bass * 3);
        const r = p.baseRadius * expand;
        const clampedR = Math.min(r, maxR);
        const wiggle = 1 + Math.sin(p.phase) * 0.04;
        p.px = cx + Math.cos(p.baseAngle) * clampedR * wiggle;
        p.py = cy + Math.sin(p.baseAngle) * clampedR * wiggle;
        const pulse = playing ? Math.sin(p.phase) * 0.25 + 0.75 : 1;
        const sz = p.size * (0.5 + avg * 3) * pulse;
        const lt = p.light + avg * 35;
        const al = p.alpha * (0.5 + avg * 0.5);
        ctx!.shadowBlur = 8 + avg * 15;
        ctx!.shadowColor = `hsla(260, 70%, 60%, ${al * 0.5})`;
        ctx!.beginPath();
        ctx!.arc(p.px, p.py, Math.max(1, sz), 0, Math.PI * 2);
        ctx!.fillStyle = `hsla(${p.hue}, 80%, ${lt}%, ${al})`;
        ctx!.fill();
        if (sz > 1.5) {
          ctx!.shadowBlur = 0;
          ctx!.beginPath();
          ctx!.arc(p.px, p.py, sz * 3, 0, Math.PI * 2);
          ctx!.fillStyle = `hsla(${p.hue + 10}, 60%, ${lt + 15}%, ${al * 0.1 * avg})`;
          ctx!.fill();
        }
      }

      // ═══ 3. 环形波纹 ═══
      if (analyser && playing && bass > 0.08) {
        const rings = Math.min(3, Math.floor(bass * 6));
        for (let ri = 0; ri < rings; ri++) {
          const t = (ri + 1) / (rings + 1);
          const ringR = maxR * bass * (0.3 + t * 0.7);
          ctx!.shadowBlur = 0;
          ctx!.beginPath();
          ctx!.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx!.strokeStyle = `hsla(270, 80%, 65%, ${(1 - t) * bass * 0.2})`;
          ctx!.lineWidth = 1 + (1 - t) * 2;
          ctx!.stroke();
          const dotCount = 12 + Math.floor(t * 12);
          for (let di = 0; di < dotCount; di++) {
            const a = (di / dotCount) * Math.PI * 2;
            ctx!.beginPath();
            ctx!.arc(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, 1 + (1 - t), 0, Math.PI * 2);
            ctx!.fillStyle = `hsla(270, 90%, 75%, ${(1 - t) * bass * 0.25})`;
            ctx!.fill();
          }
        }
      }
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
    <div className="fixed inset-0 z-50" style={{ backgroundColor: "#0a0a0b" }}>
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
