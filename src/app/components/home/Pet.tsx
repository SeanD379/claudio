"use client";

import { motion, type TargetAndTransition } from "framer-motion";
import { useStatus } from "@/hooks/useStatus";

// 根据状态返回不同的动画参数
function getStatusAnimation(status: string): TargetAndTransition {
  const animations: Record<string, TargetAndTransition> = {
    happy: {
      y: [0, -8, 0],
      rotate: [0, 5, -5, 0],
      transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const },
    },
    sad: {
      y: [0, 2, 0],
      scale: [1, 0.95, 1],
      transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
    },
    sleepy: {
      y: [0, 3, 0],
      scale: [1, 0.98, 1],
      rotate: [0, -2, 2, 0],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
    },
    excited: {
      y: [0, -12, 0],
      rotate: [0, 10, -10, 0],
      scale: [1, 1.1, 1],
      transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" as const },
    },
    calm: {
      scale: [1, 1.02, 1],
      transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const },
    },
    daydreaming: {
      y: [0, -5, 0],
      x: [0, 3, -3, 0],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
    },
    music: {
      rotate: [0, 5, -5, 5, 0],
      y: [0, -3, 0],
      transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
    },
    coffee: {
      y: [0, -2, 0],
      rotate: [0, -3, 0],
      transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
    },
    night: {
      y: [0, 4, 0],
      scale: [1, 0.95, 1],
      transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" as const },
    },
    exercise: {
      y: [0, -15, 0],
      scale: [1, 0.9, 1.1, 1],
      transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" as const },
    },
    reading: {
      rotate: [0, -2, 2, 0],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
    },
    eating: {
      y: [0, -3, 0],
      scale: [1, 1.05, 1],
      transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" as const },
    },
    gaming: {
      y: [0, -5, 0],
      rotate: [0, 3, -3, 0],
      transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" as const },
    },
    working: {
      y: [0, -2, 0],
      rotate: [0, -1, 1, 0],
      transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const },
    },
    "social-tired": {
      scale: [1, 0.95, 1],
      y: [0, 2, 0],
      transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const },
    },
  };

  return animations[status] || animations.calm;
}

// 根据状态返回表情
function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    happy: "^_^",
    sad: "T_T",
    sleepy: "-_-",
    excited: "★_★",
    calm: "._.",
    daydreaming: "@_@",
    music: "♪_♪",
    coffee: "☕_☕",
    night: "☽_☽",
    exercise: "💪_💪",
    reading: "📖_📖",
    eating: "😋_😋",
    gaming: "🎮_🎮",
    working: "💼_💼",
    "social-tired": "..._...",
  };
  return emojis[status] || "._.";
}

export function Pet() {
  const { currentStatus } = useStatus();
  const animation = getStatusAnimation(currentStatus);

  return (
    <motion.div
      className="relative w-16 h-16 cursor-pointer select-none"
      animate={animation}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      {/* 主体 - 圆润光球 */}
      <svg
        viewBox="0 0 64 64"
        className="w-full h-full"
        style={{ filter: "drop-shadow(0 4px 12px rgba(139, 156, 247, 0.3))" }}
      >
        {/* 外发光 */}
        <defs>
          <radialGradient id="pet-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(139, 156, 247, 0.4)" />
            <stop offset="100%" stopColor="rgba(139, 156, 247, 0)" />
          </radialGradient>
          <radialGradient id="pet-body" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#a8b4fc" />
            <stop offset="100%" stopColor="#7b8cf7" />
          </radialGradient>
        </defs>

        {/* 光晕 */}
        <circle cx="32" cy="32" r="30" fill="url(#pet-glow)" opacity="0.5" />

        {/* 身体 */}
        <ellipse
          cx="32"
          cy="36"
          rx="20"
          ry="18"
          fill="url(#pet-body)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />

        {/* 左眼 */}
        <ellipse cx="25" cy="32" rx="3" ry="3.5" fill="#1a1e2e" />
        <circle cx="24" cy="31" r="1" fill="white" opacity="0.8" />

        {/* 右眼 */}
        <ellipse cx="39" cy="32" rx="3" ry="3.5" fill="#1a1e2e" />
        <circle cx="38" cy="31" r="1" fill="white" opacity="0.8" />

        {/* 嘴巴 - 根据状态变化 */}
        {currentStatus === "happy" || currentStatus === "excited" ? (
          <path
            d="M28 40 Q32 44 36 40"
            fill="none"
            stroke="#1a1e2e"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ) : currentStatus === "sad" ? (
          <path
            d="M28 42 Q32 38 36 42"
            fill="none"
            stroke="#1a1e2e"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ) : (
          <line
            x1="29"
            y1="41"
            x2="35"
            y2="41"
            stroke="#1a1e2e"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}

        {/* 腮红 */}
        <circle cx="20" cy="38" r="3" fill="rgba(255, 150, 150, 0.3)" />
        <circle cx="44" cy="38" r="3" fill="rgba(255, 150, 150, 0.3)" />

        {/* 小耳朵 */}
        <ellipse cx="18" cy="22" rx="5" ry="6" fill="#8b9cf7" opacity="0.8" />
        <ellipse cx="46" cy="22" rx="5" ry="6" fill="#8b9cf7" opacity="0.8" />
      </svg>

      {/* 状态文字气泡 */}
      <motion.div
        className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        key={currentStatus}
      >
        {getStatusEmoji(currentStatus)}
      </motion.div>
    </motion.div>
  );
}
