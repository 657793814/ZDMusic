"use client";

import type { StagePalette } from "@/app/lib/coverPalette";
import { useEffect, useRef, type CSSProperties } from "react";

const SPARKS = Array.from({ length: 30 }, (_, i) => ({
  left: `${((i * 41 + 5) % 92) + 4}%`,
  top: `${((i * 29 + 21) % 38) + 58}%`,
  size: 1.2 + ((i * 5) % 3) * 0.7,
  duration: 16 + ((i * 7) % 14),
  delay: -((i * 4) % 20),
  alpha: 0.16 + ((i * 9) % 5) * 0.05,
}));

/** WebGL 不可用 / 初始化失败时的静态基座：雾、光带、涟漪、微粒，不出白屏 */
export function StageCssFallback({
  coverUrl,
  palette,
  analyser,
  playing,
  active,
}: {
  coverUrl: string | null;
  palette: StagePalette;
  analyser: AnalyserNode | null;
  playing: boolean;
  active: boolean;
}) {
  const sceneRef = useRef<HTMLDivElement | null>(null);

  // 指针视差：只写两个 CSS 变量，位移与插值交给 CSS transform
  useEffect(() => {
    if (!active) return;
    const scene = sceneRef.current;
    if (!scene) return;
    const onMove = (event: PointerEvent) => {
      scene.style.setProperty(
        "--zd-par-x",
        ((event.clientX / window.innerWidth - 0.5) * 2).toFixed(3),
      );
      scene.style.setProperty(
        "--zd-par-y",
        ((event.clientY / window.innerHeight - 0.5) * 2).toFixed(3),
      );
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [active]);

  // 低频呼吸：只输出一个 0–1 的 bass 值，30fps 节流，不重建任何图形
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (!active || !playing || !analyser) {
      scene.style.setProperty("--zd-stage-bass", "0");
      return;
    }

    const freq = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let smooth = 0;
    let last = 0;

    const tick = (now: number) => {
      analyser.getByteFrequencyData(freq);
      let bass = 0;
      for (let i = 1; i < 8; i += 1) bass += freq[i] ?? 0;
      bass /= 7 * 255;
      smooth += (bass - smooth) * 0.12;
      if (now - last > 33) {
        last = now;
        scene.style.setProperty("--zd-stage-bass", smooth.toFixed(3));
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active, playing, analyser]);

  const style = {
    "--zd-stage-tone": palette.primary,
    "--zd-stage-tone-2": palette.secondary,
  } as CSSProperties;

  return (
    <div className="zd-stage-visual" data-mode="css" aria-hidden>
      <div
        className="zd-stage-scene"
        ref={sceneRef}
        data-variant="c"
        data-playing={playing ? "true" : "false"}
        data-reduced="false"
        style={style}
      >
        <span className="zd-stage-base" />
        <span className="zd-stage-grade" />

        <div className="zd-stage-layer zd-stage-far">
          <span className="zd-stage-aura" />
          <div className="zd-horizon">
            <span className="zd-horizon-glow" />
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="zd-ripple"
                style={{ animationDelay: `${index * 5.3}s` }}
              />
            ))}
          </div>
        </div>

        <div className="zd-stage-layer zd-stage-mid">
          <span className="zd-stage-halo" />
          <div
            className="zd-stage-disc"
            data-playing={playing ? "true" : "false"}
            data-has-cover={coverUrl ? "true" : "false"}
            data-stage-interactive
            style={coverUrl ? { backgroundImage: `url("${coverUrl}")` } : undefined}
          >
            <span className="zd-stage-disc-sheen" />
          </div>
        </div>

        <div className="zd-stage-layer zd-stage-near">
          {SPARKS.map((dot, index) => (
            <span
              key={index}
              className="zd-spark"
              style={{
                left: dot.left,
                top: dot.top,
                width: dot.size,
                height: dot.size,
                opacity: dot.alpha,
                animationDuration: `${dot.duration}s`,
                animationDelay: `${dot.delay}s`,
              }}
            />
          ))}
        </div>

        <span className="zd-stage-vignette" />
      </div>
    </div>
  );
}
