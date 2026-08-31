"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthContext } from "@/app/components/auth/AuthProvider";

interface DayStats {
  date: string;
  songCount: number;
  totalDuration: number;
  coverUrls: string[];
}

interface Song {
  id: string;
  neteaseId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  duration: number | null;
}

interface PlayRecord {
  songId: string;
  playedAt: string;
  duration: number | null;
}

interface TimeSlots {
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
}

interface DaySummary {
  playCount: number;
  uniqueSongCount: number;
  totalDuration: number;
  topArtist: string | null;
  topSong: string | null;
  timeSlots: TimeSlots;
}

interface DayDetail {
  songs: Song[];
  playRecords: PlayRecord[];
  totalDuration: number;
  songCount: number;
  playCount: number;
  summary: DaySummary;
}

interface HistoryEvent {
  year: number;
  event: string;
  artist?: string | null;
  sourceUrl?: string | null;
}

export type HistoryState = "idle" | "loading" | "ready" | "exhausted" | "error";

function parseHistoryData(data: unknown): { events: HistoryEvent[]; exhausted: boolean } {
  if (typeof data !== "object" || data === null) {
    return { events: [], exhausted: false };
  }

  const response = data as { events?: unknown; exhausted?: unknown };
  const events = Array.isArray(response.events)
    ? response.events.reduce<HistoryEvent[]>((validEvents, item) => {
        if (typeof item !== "object" || item === null) return validEvents;

        const event = item as { year?: unknown; event?: unknown; artist?: unknown; sourceUrl?: unknown };
        if (typeof event.year !== "number" || typeof event.event !== "string") return validEvents;

        const historyEvent: HistoryEvent = { year: event.year, event: event.event };
        if (typeof event.artist === "string" || event.artist === null) historyEvent.artist = event.artist;
        if (typeof event.sourceUrl === "string" || event.sourceUrl === null) historyEvent.sourceUrl = event.sourceUrl;
        validEvents.push(historyEvent);
        return validEvents;
      }, [])
    : [];

  return { events, exhausted: response.exhausted === true };
}

export function useCalendar() {
  const { isLoggedIn } = useAuthContext();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  const [monthlyData, setMonthlyData] = useState<DayStats[]>([]);
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  const [historyState, setHistoryState] = useState<HistoryState>("idle");
  const [loading, setLoading] = useState(false);
  const dayDetailRequestId = useRef(0);

  // 获取月度数据（需要登录）
  const fetchMonthly = useCallback(async (y: number, m: number) => {
    if (!isLoggedIn) {
      setMonthlyData([]);
      return;
    }
    try {
      const res = await fetch(`/api/calendar/monthly?year=${y}&month=${m}`);
      if (res.ok) {
        const data = await res.json();
        setMonthlyData(data.records || []);
      }
    } catch (e) {
      console.error("Fetch monthly error:", e);
    }
  }, [isLoggedIn]);

  // 获取某天详情
  const fetchDayDetail = useCallback((date: string) => {
    const requestId = ++dayDetailRequestId.current;
    const isCurrentRequest = () => requestId === dayDetailRequestId.current;

    // 历史事件是公开数据，不需要登录
    if (isCurrentRequest()) {
      setHistoryState("loading");
      setHistoryEvents([]);
    }
    void (async () => {
      try {
        const historyRes = await fetch(
          `/api/calendar/history?year=${date.slice(0, 4)}&month=${date.slice(5, 7)}&day=${date.slice(8, 10)}`,
          { cache: "no-store" }
        );
        if (!historyRes.ok) {
          throw new Error(`History request failed: ${historyRes.status}`);
        }
        const { events, exhausted } = parseHistoryData(await historyRes.json());
        if (!isCurrentRequest()) return;
        setHistoryEvents(events);
        setHistoryState(exhausted ? "exhausted" : "ready");
      } catch (e) {
        console.error("Fetch history error:", e);
        if (!isCurrentRequest()) return;
        setHistoryEvents([]);
        setHistoryState("error");
      }
    })();

    // 播放详情需要登录
    if (!isLoggedIn) {
      if (isCurrentRequest()) {
        setDayDetail(null);
        setLoading(false);
      }
      return;
    }

    if (isCurrentRequest()) setLoading(true);
    void (async () => {
      try {
        const dayRes = await fetch(`/api/calendar/day?date=${date}`);
        if (dayRes.ok) {
          const data = await dayRes.json();
          if (isCurrentRequest()) setDayDetail(data);
        }
      } catch (e) {
        console.error("Fetch day detail error:", e);
      } finally {
        if (isCurrentRequest()) setLoading(false);
      }
    })();
  }, [isLoggedIn]);

  // 月份变化时重新获取
  useEffect(() => {
    fetchMonthly(year, month);
  }, [year, month, fetchMonthly]);

  // 选中日期变化时获取详情
  useEffect(() => {
    fetchDayDetail(selectedDate);
  }, [selectedDate, fetchDayDetail]);

  // 切换到上个月
  const prevMonth = useCallback(() => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  // 切换到下个月
  const nextMonth = useCallback(() => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  // 回到今天
  const goToday = useCallback(() => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDate(today.toISOString().slice(0, 10));
  }, []);

  // 格式化时长
  const formatDuration = useCallback((seconds: number) => {
    if (seconds < 60) return `${seconds} 秒`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours} 小时 ${mins} 分`;
    return `${mins} 分钟`;
  }, []);

  return {
    year,
    month,
    selectedDate,
    setSelectedDate,
    monthlyData,
    dayDetail,
    historyEvents,
    historyState,
    loading,
    prevMonth,
    nextMonth,
    goToday,
    formatDuration,
  };
}
