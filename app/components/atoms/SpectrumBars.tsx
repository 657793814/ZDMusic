"use client";

type Props = {
  active: boolean;
  muted: boolean;
};

export function SpectrumBars({ active, muted }: Props) {
  const barCount = 4;

  return (
    <span
      className="inline-flex items-end gap-[3px]"
      style={{
        height: "20px",
        opacity: muted ? 0.45 : 1,
      }}
      aria-hidden
    >
      {Array.from({ length: barCount }).map((_, i) => {
        const delays = ["0s", "0.18s", "0.08s", "0.32s"];
        return (
          <span
            key={i}
            className="inline-block w-[4px] rounded-full"
            style={{
              height: "100%",
              backgroundColor: muted
                ? "var(--color-outline)"
                : "var(--color-primary)",
              transition: "height 0.2s ease",
              animationName: "bar-bounce",
              animationDuration: ["0.48s", "0.62s", "0.55s", "0.72s"][i] ?? "0.55s",
              animationDelay: delays[i] ?? "0s",
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
              animationPlayState: active && !muted ? "running" : "paused",
              transformOrigin: "bottom",
            }}
          />
        );
      })}
    </span>
  );
}
