"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useCalendar } from "@/hooks/useCalendar";
import { CalendarGrid } from "@/app/components/calendar/CalendarGrid";
import { DayDetail } from "@/app/components/calendar/DayDetail";

const MONTH_NAMES = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];

export default function CalendarPage() {
  const router = useRouter();
  const {
    year,
    month,
    selectedDate,
    setSelectedDate,
    monthlyData,
    dayDetail,
    historyEvents,
    loading,
    prevMonth,
    nextMonth,
    goToday,
    formatDuration,
  } = useCalendar();

  return (
    <div className="h-full overflow-hidden" style={{ background: "#121212" }}>
      <div className="max-w-[1400px] mx-auto px-8 py-4 h-full flex flex-col">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => {
                sessionStorage.setItem("claudio-go-home", "1");
                router.push("/");
              }}
              className="p-2 rounded-full transition-colors"
              style={{ background: "#282828", color: "#ffffff" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>
            <div>
              <p
                className="text-xs font-semibold tracking-widest uppercase mb-1"
                style={{ color: "#b3b3b3" }}
              >
                CALENDAR
              </p>
              <h1 className="text-2xl font-bold" style={{ color: "#ffffff" }}>
                音乐日历
              </h1>
            </div>
          </div>

          {/* 回到今天 */}
          <motion.button
            onClick={goToday}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{ background: "#282828", color: "#b3b3b3" }}
            whileHover={{ scale: 1.05, color: "#ffffff" }}
            whileTap={{ scale: 0.95 }}
          >
            今天
          </motion.button>
        </div>

        {/* 月份切换 */}
        <div className="flex items-center justify-between mb-3">
          <motion.button
            onClick={prevMonth}
            className="p-2 rounded-full transition-colors"
            style={{ background: "#181818", color: "#b3b3b3" }}
            whileHover={{ scale: 1.1, color: "#ffffff" }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>

          <h2 className="text-xl font-bold" style={{ color: "#ffffff" }}>
            {year} 年 {MONTH_NAMES[month - 1]}
          </h2>

          <motion.button
            onClick={nextMonth}
            className="p-2 rounded-full transition-colors"
            style={{ background: "#181818", color: "#b3b3b3" }}
            whileHover={{ scale: 1.1, color: "#ffffff" }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>

        {/* 主体：日历 + 详情 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 flex-1 min-h-0">
          {/* 左侧：月历网格 */}
          <motion.div
            className="rounded-2xl p-4 overflow-hidden flex flex-col"
            style={{ background: "#181818" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <CalendarGrid
              year={year}
              month={month}
              selectedDate={selectedDate}
              monthlyData={monthlyData}
              onSelectDate={setSelectedDate}
            />
          </motion.div>

          {/* 右侧：选中日期详情 */}
          <motion.div
            className="h-full flex flex-col overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <DayDetail
              date={selectedDate}
              summary={dayDetail?.summary ?? null}
              historyEvents={historyEvents}
              loading={loading}
              formatDuration={formatDuration}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
