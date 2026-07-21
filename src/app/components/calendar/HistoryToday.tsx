"use client";

import { motion } from "framer-motion";

interface HistoryEvent {
  year: number;
  event: string;
  artist?: string | null;
}

interface HistoryTodayProps {
  events: HistoryEvent[];
  month: number;
  day: number;
}

export function HistoryToday({ events, month, day }: HistoryTodayProps) {
  if (events.length === 0) return null;

  // 按年份排序
  const sorted = [...events].sort((a, b) => a.year - b.year);

  return (
    <motion.div
      className="flex-1 rounded-2xl p-4"
      style={{ background: "#181818" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      {/* 标签 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">📜</span>
        <span
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: "#b3b3b3" }}
        >
          历史上的今天
        </span>
      </div>

      {/* 时间线 */}
      <div className="space-y-3">
        {sorted.map((evt, i) => (
          <motion.div
            key={`${evt.year}-${i}`}
            className="flex gap-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.15 + i * 0.08 }}
          >
            {/* 完整日期 */}
            <div
              className="text-xs font-bold w-16 flex-shrink-0 text-right pt-0.5 leading-tight"
              style={{ color: "#555", fontFamily: "'Inter', monospace" }}
            >
              {evt.year}.{String(month).padStart(2, "0")}.{String(day).padStart(2, "0")}
            </div>

            {/* 分隔线 */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className="w-2 h-2 rounded-full mt-1.5"
                style={{ background: "#1ed760" }}
              />
              {i < sorted.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{ background: "#333" }} />
              )}
            </div>

            {/* 事件 */}
            <div className="pb-1">
              <p className="text-sm leading-relaxed" style={{ color: "#b3b3b3" }}>
                {evt.event}
              </p>
              {evt.artist && (
                <p className="text-xs mt-1" style={{ color: "#1ed760" }}>
                  {evt.artist}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
