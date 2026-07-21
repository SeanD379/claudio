"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";

export function Clock() {
  const { t, tArr } = useTranslation();
  const [time, setTime] = useState<Date | null>(null);

  const updateTime = useCallback(() => {
    setTime(new Date());
  }, []);

  useEffect(() => {
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [updateTime]);

  if (!time) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-6xl sm:text-7xl md:text-8xl font-light tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          --<span className="animate-colon-pulse text-accent">:</span>--
        </div>
      </div>
    );
  }

  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");

  const weekdays = tArr("clock.weekdays");
  const year = time.getFullYear().toString();
  const month = (time.getMonth() + 1).toString().padStart(2, "0");
  const day = time.getDate().toString().padStart(2, "0");
  const weekday = weekdays[time.getDay()];

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div
        className="text-6xl sm:text-7xl md:text-8xl font-normal tracking-tight text-text-primary"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em' }}
      >
        {hours}
        <span className="animate-colon-pulse text-accent mx-1">:</span>
        {minutes}
        <span
          className="text-4xl sm:text-5xl md:text-6xl text-text-muted ml-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {seconds}
        </span>
      </div>
      <div className="text-sm text-text-secondary mt-4 tracking-wide">
        {t("clock.date", { year, month, day, weekday })}
      </div>
    </div>
  );
}
