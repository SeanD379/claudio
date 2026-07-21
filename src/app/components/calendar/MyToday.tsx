"use client";

import { motion } from "framer-motion";

interface TimeSlots {
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
}

interface Summary {
  playCount: number;
  uniqueSongCount: number;
  totalDuration: number;
  topArtist: string | null;
  topSong: string | null;
  timeSlots: TimeSlots;
}

interface MyTodayProps {
  summary: Summary | null;
  formatDuration: (seconds: number) => string;
}

// 时段配置 - 情绪色彩
const SLOT_COLORS = {
  morning: { from: "#f59e0b", to: "#fbbf24" },   // 暖黄
  afternoon: { from: "#3b82f6", to: "#60a5fa" },  // 活力蓝
  evening: { from: "#ec4899", to: "#f472b6" },    // 玫瑰
  night: { from: "#6366f1", to: "#818cf8" },       // 靛蓝
};

// 生成情绪曲线路径
function generateCurvePath(values: number[], width: number, height: number): string {
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - (v / max) * (height * 0.7) - height * 0.15,
  }));

  // 用贝塞尔曲线平滑连接
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    path += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return path;
}

// 生成文案（基于真实数据）
function generateCaption(summary: Summary): { main: string; sub: string } {
  const { playCount, uniqueSongCount, topArtist, topSong, totalDuration } = summary;
  const mins = Math.floor(totalDuration / 60);

  // 有明确的单曲循环（同一首歌听了多次）
  if (topSong && playCount > uniqueSongCount && playCount >= 3) {
    return {
      main: `单曲循环 ${topSong}`,
      sub: `听了 ${playCount} 次，共 ${mins} 分钟`,
    };
  }

  // 听了很多不同的歌
  if (uniqueSongCount >= 5) {
    return {
      main: `今天听了 ${uniqueSongCount} 首歌`,
      sub: topArtist ? `最爱 ${topArtist}` : `共计 ${mins} 分钟`,
    };
  }

  // 播放次数较多但歌曲不多
  if (playCount >= 5) {
    return {
      main: `播放了 ${playCount} 次`,
      sub: uniqueSongCount > 1 ? `${uniqueSongCount} 首不同的歌` : "单曲循环中",
    };
  }

  // 少量播放
  if (playCount > 0) {
    return {
      main: `听了 ${playCount} 首`,
      sub: mins > 0 ? `共 ${mins} 分钟` : "刚刚开始",
    };
  }

  return { main: "今天还没有听歌", sub: "去发现一首好歌吧" };
}

export function MyToday({ summary, formatDuration }: MyTodayProps) {
  if (!summary || summary.playCount === 0) {
    return (
      <motion.div
        className="flex-1 rounded-2xl p-5"
        style={{ background: "#181818" }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">🎵</span>
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: "#b3b3b3" }}>
            我的今天
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <div className="text-3xl">🌙</div>
          <p className="text-sm" style={{ color: "#666" }}>
            今天还没有听歌
          </p>
          <p className="text-xs" style={{ color: "#444" }}>
            去发现一首好歌吧
          </p>
        </div>
      </motion.div>
    );
  }

  const { playCount, uniqueSongCount, totalDuration, timeSlots } = summary;
  const slotValues = [timeSlots.morning, timeSlots.afternoon, timeSlots.evening, timeSlots.night];
  const totalSlotPlays = slotValues.reduce((a, b) => a + b, 0);
  const caption = generateCaption(summary);

  // 曲线尺寸
  const curveWidth = 320;
  const curveHeight = 120;
  const curvePath = generateCurvePath(slotValues, curveWidth, curveHeight);

  // 生成渐变ID
  const gradientId = "mood-gradient-" + Math.random().toString(36).slice(2, 8);

  return (
    <motion.div
      className="flex-1 rounded-2xl overflow-hidden"
      style={{ background: "#181818" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* 标签 */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <span className="text-sm">🎵</span>
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: "#b3b3b3" }}>
          我的今天
        </span>
      </div>

      {/* 情绪曲线 */}
      {totalSlotPlays > 0 && (
        <div className="px-5 py-2">
          <svg
            width="100%"
            height={curveHeight}
            viewBox={`0 0 ${curveWidth} ${curveHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              {/* 渐变色 */}
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={SLOT_COLORS.morning.from} />
                <stop offset="33%" stopColor={SLOT_COLORS.afternoon.from} />
                <stop offset="66%" stopColor={SLOT_COLORS.evening.from} />
                <stop offset="100%" stopColor={SLOT_COLORS.night.from} />
              </linearGradient>
              {/* 发光效果 */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 底部填充区域 */}
            <motion.path
              d={`${curvePath} L ${curveWidth} ${curveHeight} L 0 ${curveHeight} Z`}
              fill={`url(#${gradientId})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />

            {/* 主曲线 */}
            <motion.path
              d={curvePath}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="3"
              strokeLinecap="round"
              filter="url(#glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
            />

            {/* 时段节点 */}
            {slotValues.map((v, i) => {
              const max = Math.max(...slotValues, 1);
              const x = (i / (slotValues.length - 1)) * curveWidth;
              const y = curveHeight - (v / max) * (curveHeight * 0.7) - curveHeight * 0.15;
              const colors = Object.values(SLOT_COLORS);
              return v > 0 ? (
                <motion.circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="4"
                  fill={colors[i].from}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.8 + i * 0.1 }}
                />
              ) : null;
            })}
          </svg>

          {/* 时段标签 */}
          <div className="flex justify-between px-1 mt-1">
            {[
              { label: "上午", range: "6-12点", icon: "🌅" },
              { label: "下午", range: "12-18点", icon: "☀️" },
              { label: "晚上", range: "18-24点", icon: "🌆" },
              { label: "凌晨", range: "0-6点", icon: "🌙" },
            ].map((slot, i) => (
              <div key={i} className="text-center">
                <span className="text-xs">{slot.icon}</span>
                <p className="text-[10px] mt-0.5" style={{ color: "#666" }}>{slot.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 个性化文案 */}
      <div className="text-center px-5 py-3">
        <motion.p
          className="text-lg font-semibold"
          style={{ color: "#ffffff" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          {caption.main}
        </motion.p>
        <motion.p
          className="text-xs mt-1"
          style={{ color: "#888" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
        >
          {caption.sub}
        </motion.p>
      </div>

      {/* 底部数字概览 */}
      <motion.div
        className="flex items-center justify-center gap-6 px-5 pb-4 pt-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1 }}
      >
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: "#b3b3b3" }}>{playCount}</p>
          <p className="text-[10px]" style={{ color: "#555" }}>播放</p>
        </div>
        <div className="w-px h-4" style={{ background: "#333" }} />
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: "#b3b3b3" }}>{uniqueSongCount}</p>
          <p className="text-[10px]" style={{ color: "#555" }}>首歌</p>
        </div>
        <div className="w-px h-4" style={{ background: "#333" }} />
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: "#b3b3b3" }}>
            {totalDuration > 0 ? formatDuration(totalDuration) : "—"}
          </p>
          <p className="text-[10px]" style={{ color: "#555" }}>时长</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
