"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Moon } from "lucide-react";
import type { HistoryState } from "@/hooks/useCalendar";
import { MyToday } from "./MyToday";
import { HistoryToday } from "./HistoryToday";

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
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

interface HistoryEvent {
  year: number;
  event: string;
  artist?: string | null;
  sourceUrl?: string | null;
}

interface DayDetailProps {
  date: string;
  summary: DaySummary | null;
  historyEvents: HistoryEvent[];
  historyState: HistoryState;
  loading: boolean;
  formatDuration: (seconds: number) => string;
}

export function DayDetail({
  date,
  summary,
  historyEvents,
  historyState,
  loading,
  formatDuration,
}: DayDetailProps) {
  const hasContent = (summary && summary.playCount > 0) || historyEvents.length > 0 || historyState !== "idle" || isToday(date);

  // 格式化日期
  const dateObj = new Date(date + "T00:00:00");

  return (
    <div className="h-full flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={date}
          className="flex-1 flex flex-col"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {hasContent ? (
            <div className="flex-1 flex flex-col gap-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2
                    className="w-6 h-6 animate-spin"
                    style={{ color: "#b3b3b3" }}
                  />
                </div>
              ) : (
                <MyToday
                  summary={summary}
                  formatDuration={formatDuration}
                />
              )}
              <HistoryToday
                events={historyEvents}
                state={historyState}
                month={dateObj.getMonth() + 1}
                day={dateObj.getDate()}
              />
            </div>
          ) : (
            <div
              className="flex-1 rounded-2xl p-8 flex flex-col items-center justify-center gap-4"
              style={{ background: "#181818" }}
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #1a2a1a 0%, #0d1f0d 100%)",
                  boxShadow: "0 0 40px rgba(29,185,84,0.08)",
                }}
              >
                <Moon
                  className="w-10 h-10"
                  style={{ color: "#1db954", opacity: 0.5 }}
                />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-sm font-medium" style={{ color: "#e0e0e0" }}>
                  这一天很安静
                </p>
                <p className="text-xs" style={{ color: "#666" }}>
                  没有播放记录
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
