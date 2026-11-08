"use client";

import { useEffect, useState } from "react";

function greetingFor(hour: number): string {
  if (hour < 5) return "夜深了，放一首轻的";
  if (hour < 9) return "早安，从一首歌开始";
  if (hour < 12) return "上午好，让耳朵先醒";
  if (hour < 14) return "午后好，来点节奏";
  if (hour < 18) return "下午好，继续听";
  if (hour < 23) return "晚上好，把音量调低一点";
  return "深夜了，慢慢听";
}

function formatClock(date: Date): string {
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export function HeroClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const date = now ?? new Date();
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date);
  const dayLabel = `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${weekday}`;

  return (
    <div className="zd-home-hero-main">
      <span className="zd-kicker">ZD MUSIC · HOME</span>
      <div className="zd-home-clock" aria-live="off">
        {now ? formatClock(now) : "--:--"}
      </div>
      <div className="zd-home-date">{dayLabel}</div>
      <p className="zd-home-greeting">{greetingFor(date.getHours())}</p>
    </div>
  );
}
