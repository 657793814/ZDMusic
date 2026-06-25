"use client";

import { useEffect, useRef } from "react";

type Props = {
  analyser: AnalyserNode | null;
  playing: boolean;
};

const BAR_COUNT = 32;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const CANVAS_W = BAR_COUNT * (BAR_WIDTH + BAR_GAP) + 4;
const CANVAS_H = 52;

/**
 * Canvas 频谱柱状图
 * 从 AnalyserNode 读取实时频域数据并绘制
 */
export function SpectrumBars({ analyser, playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser || !playing) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let rafId: number;
    let stopped = false;

    function draw() {
      if (stopped) return;
      rafId = requestAnimationFrame(draw);

      analyser!.getByteFrequencyData(dataArray);

      ctx!.clearRect(0, 0, CANVAS_W, CANVAS_H);

      const step = Math.max(1, Math.floor(bufferLength / BAR_COUNT));

      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        const start = i * step;
        const end = Math.min(start + step, bufferLength);
        for (let j = start; j < end; j++) {
          sum += dataArray[j];
        }
        const avg = sum / (end - start);

        const normalized = avg / 255;
        const barH = Math.max(1, normalized * CANVAS_H);

        const x = 2 + i * (BAR_WIDTH + BAR_GAP);
        const y = CANVAS_H - barH;

        const hue = 280 - normalized * 200;
        ctx!.fillStyle = `hsl(${hue}, 85%, ${55 + normalized * 25}%)`;

        const radius = Math.min(2, BAR_WIDTH / 2);
        ctx!.beginPath();
        ctx!.moveTo(x + radius, y);
        ctx!.lineTo(x + BAR_WIDTH - radius, y);
        ctx!.quadraticCurveTo(x + BAR_WIDTH, y, x + BAR_WIDTH, y + radius);
        ctx!.lineTo(x + BAR_WIDTH, CANVAS_H - radius);
        ctx!.quadraticCurveTo(x + BAR_WIDTH, CANVAS_H, x + BAR_WIDTH - radius, CANVAS_H);
        ctx!.lineTo(x + radius, CANVAS_H);
        ctx!.quadraticCurveTo(x, CANVAS_H, x, CANVAS_H - radius);
        ctx!.lineTo(x, y + radius);
        ctx!.quadraticCurveTo(x, y, x + radius, y);
        ctx!.closePath();
        ctx!.fill();
      }
    }

    draw();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    };
  }, [analyser, playing]);

  if (!analyser || !playing) return null;

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="shrink-0"
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        imageRendering: "pixelated",
      }}
      aria-hidden
    />
  );
}
