"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** AnalyserNode（来自 PlayerContext） */
  analyser: AnalyserNode | null;
  /** 是否正在播放 */
  playing: boolean;
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  sat: number;
  light: number;
  alpha: number;
  pulsePhase: number;
  pulseSpeed: number;
}

const PARTICLE_COUNT = 80;
const BASE_SPEED = 0.15;

function createParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * BASE_SPEED * 2,
    vy: (Math.random() - 0.5) * BASE_SPEED * 2,
    size: Math.random() * 3 + 1,
    hue: 260 + Math.random() * 60, // 紫 ~ 蓝
    sat: 60 + Math.random() * 30,
    light: 50 + Math.random() * 30,
    alpha: 0.15 + Math.random() * 0.25,
    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: 1 + Math.random() * 2,
  };
}

export function AmbientBackground({ analyser, playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    let stopped = false;

    const particles: Particle[] = [];

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 重新创建粒子以适应新尺寸
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(createParticle(w, h));
      }
    }

    resize();
    window.addEventListener("resize", resize);

    // 频谱数据（即使 analyser 为 null 也能渐变过渡）
    const freqBuffer = new Uint8Array(analyser?.frequencyBinCount ?? 128);
    let avgEnergy = 0;
    const dataArray = new Uint8Array(analyser?.frequencyBinCount ?? 128);

    function draw() {
      if (stopped) return;
      rafId = requestAnimationFrame(draw);

      const w = canvas!.width / (window.devicePixelRatio || 1);
      const h = canvas!.height / (window.devicePixelRatio || 1);

      // 读取频谱
      if (analyser && playing) {
        analyser.getByteFrequencyData(dataArray);

        // 计算平均能量（0-1）
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        avgEnergy = avgEnergy * 0.85 + (sum / dataArray.length / 255) * 0.15;

        // 低频能量（前 1/4 bins）用于冲击效果
        let bassSum = 0;
        const bassCount = Math.floor(dataArray.length / 4);
        for (let i = 0; i < bassCount; i++) bassSum += dataArray[i];
        const bassEnergy = bassSum / bassCount / 255;

        // 中高频能量（后 3/4 bins）用于闪烁
        let midSum = 0;
        const midCount = dataArray.length - bassCount;
        for (let i = bassCount; i < dataArray.length; i++) midSum += dataArray[i];
        const midEnergy = midSum / midCount / 255;

        // 更新粒子
        for (const p of particles) {
          // 时间相位
          p.pulsePhase += 0.02 * p.pulseSpeed * (1 + bassEnergy * 2);

          // 低频推动（冲击扩散）
          const bassPush = 1 + bassEnergy * 3;
          const angle = Math.atan2(p.y - h / 2, p.x - w / 2);
          if (bassEnergy > 0.15) {
            p.vx += Math.cos(angle) * bassEnergy * 0.8;
            p.vy += Math.sin(angle) * bassEnergy * 0.8;
          }

          // 中高频躁动
          p.vx += (Math.random() - 0.5) * midEnergy * 0.6;
          p.vy += (Math.random() - 0.5) * midEnergy * 0.6;

          // 阻尼
          p.vx *= 0.98;
          p.vy *= 0.98;

          // 边界限制
          const margin = 40;
          if (p.x < -margin) p.x = w + margin;
          if (p.x > w + margin) p.x = -margin;
          if (p.y < -margin) p.y = h + margin;
          if (p.y > h + margin) p.y = -margin;

          p.x += p.vx * bassPush;
          p.y += p.vy * bassPush;

          // 能量影响亮度 + 大小
          const pulse = Math.sin(p.pulsePhase) * 0.3 + 0.7;
          p.light = 50 + energyToLight(avgEnergy) * 30 + pulse * 10;
        }
      } else {
        // 无播放：平稳漂动
        avgEnergy *= 0.95;
        for (const p of particles) {
          p.pulsePhase += 0.01 * p.pulseSpeed;
          p.x += p.vx;
          p.y += p.vy;
          p.light = 50;
        }
      }

      // 绘制
      ctx!.clearRect(0, 0, w, h);

      // 全局发光效果
      const glowIntensity = 0.08 + avgEnergy * 0.12;
      ctx!.shadowBlur = 20;
      ctx!.shadowColor = `hsla(260, 80%, 60%, ${glowIntensity})`;

      for (const p of particles) {
        const pulse = playing ? Math.sin(p.pulsePhase) * 0.3 + 0.7 : 1;
        const size = p.size * (0.5 + avgEnergy * 1.5) * pulse;
        const alpha = p.alpha * (0.5 + avgEnergy * 0.5);

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx!.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.light}%, ${alpha})`;
        ctx!.fill();
      }

      // 额外低频冲击环
      if (analyser && playing) {
        // 用瞬时 bass 而不是平滑的 avgEnergy
        let bassInstant = 0;
        if (dataArray.length > 0) {
          const bc = Math.floor(dataArray.length / 4);
          let s = 0;
          for (let i = 0; i < bc; i++) s += dataArray[i];
          bassInstant = s / bc / 255;
        }

        if (bassInstant > 0.25) {
          ctx!.shadowBlur = 40;
          ctx!.shadowColor = `hsla(280, 80%, 70%, ${bassInstant * 0.15})`;
          const r = Math.min(w, h) * 0.3 * bassInstant;
          const gradient = ctx!.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
          gradient.addColorStop(0, `hsla(280, 80%, 70%, ${bassInstant * 0.08})`);
          gradient.addColorStop(0.5, `hsla(260, 60%, 50%, ${bassInstant * 0.04})`);
          gradient.addColorStop(1, "hsla(260, 60%, 50%, 0)");
          ctx!.fillStyle = gradient;
          ctx!.fillRect(0, 0, w, h);
        }
      }
    }

    draw();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [analyser, playing]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: -1,
        imageRendering: "auto",
      }}
      aria-hidden
    />
  );
}

/** 将平均能量映射到亮度增量 */
function energyToLight(e: number): number {
  if (e < 0.05) return 0;
  if (e < 0.15) return (e - 0.05) / 0.1 * 10;
  if (e < 0.3) return 10 + (e - 0.15) / 0.15 * 20;
  return 30 + Math.min(e, 1) * 20;
}
