"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface DayStats {
  date: string;
  songCount: number;
  totalDuration: number;
  coverUrls: string[];
}

interface CalendarGridProps {
  year: number;
  month: number;
  selectedDate: string;
  monthlyData: DayStats[];
  onSelectDate: (date: string) => void;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // 0=周日, 1=周一 ... 6=周六 → 转为周一=0
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function CalendarGrid({
  year,
  month,
  selectedDate,
  monthlyData,
  onSelectDate,
}: CalendarGridProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 把 monthlyData 转成 Map 方便查询
  const dataMap = useMemo(() => {
    const map = new Map<string, DayStats>();
    for (const d of monthlyData) {
      map.set(d.date, d);
    }
    return map;
  }, [monthlyData]);

  // 生成日历格子
  const cells = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOffset = getFirstDayOfWeek(year, month);
    const result: { day: number; dateStr: string; isCurrentMonth: boolean }[] =
      [];

    // 上个月补位
    const prevMonthDays = getDaysInMonth(year, month === 1 ? 12 : month - 1);
    for (let i = firstDayOffset - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 1 ? 12 : month - 1;
      const y = month === 1 ? year - 1 : year;
      result.push({
        day: d,
        dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        isCurrentMonth: false,
      });
    }

    // 当月
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({
        day: d,
        dateStr: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        isCurrentMonth: true,
      });
    }

    // 下个月补位（补齐到 6 行 = 42 格）
    const remaining = 42 - result.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 12 ? 1 : month + 1;
      const y = month === 12 ? year + 1 : year;
      result.push({
        day: d,
        dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        isCurrentMonth: false,
      });
    }

    return result;
  }, [year, month]);

  return (
    <div className="h-full flex flex-col">
      {/* 星期头 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium py-1"
            style={{ color: "#555" }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {cells.map((cell, i) => {
          const stats = dataMap.get(cell.dateStr);
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === today;
          const hasData = !!stats;

          return (
            <motion.button
              key={cell.dateStr}
              onClick={() => cell.isCurrentMonth && onSelectDate(cell.dateStr)}
              className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-colors ${cell.isCurrentMonth ? "hover:bg-[#222222]" : ""}`}
              style={{
                background: isSelected
                  ? "#282828"
                  : hasData
                    ? "#1a1a1a"
                    : "transparent",
                border: isToday
                  ? "1.5px solid #1ed760"
                  : isSelected
                    ? "1.5px solid #1ed760"
                    : "1.5px solid transparent",
                opacity: cell.isCurrentMonth ? 1 : 0.25,
                cursor: cell.isCurrentMonth ? "pointer" : "default",
                boxShadow: isToday
                  ? "0 0 12px rgba(30, 215, 96, 0.15)"
                  : "none",
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: cell.isCurrentMonth ? 1 : 0.25,
                scale: 1,
              }}
              transition={{ duration: 0.2, delay: i * 0.008 }}
            >
              <span
                className="text-sm"
                style={{
                  color: isSelected
                    ? "#1ed760"
                    : isToday
                      ? "#1ed760"
                      : cell.isCurrentMonth
                        ? "#b3b3b3"
                        : "#555",
                  fontWeight: isToday || isSelected ? 600 : 400,
                }}
              >
                {cell.day}
              </span>

              {/* 有数据的小圆点 */}
              {hasData && cell.isCurrentMonth && (
                <div
                  className="absolute bottom-1.5 w-1 h-1 rounded-full"
                  style={{ background: "#1ed760" }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
