"use client";

import { motion } from "framer-motion";

interface LoginOverlayProps {
  onLoginClick: () => void;
}

export function LoginOverlay({ onLoginClick }: LoginOverlayProps) {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />

      {/* 中心内容 */}
      <div className="relative text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          登录后查看完整内容
        </h3>
        <p className="text-gray-500 mb-4 text-sm">
          登录网易云音乐，解锁你的专属歌单
        </p>
        <button
          onClick={onLoginClick}
          className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2.5 rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
        >
          立即登录
        </button>
      </div>
    </motion.div>
  );
}
