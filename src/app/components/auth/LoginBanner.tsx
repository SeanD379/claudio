"use client";

import { motion } from "framer-motion";

interface LoginBannerProps {
  onLoginClick: () => void;
  position?: "top" | "bottom";
}

export function LoginBanner({ onLoginClick, position = "top" }: LoginBannerProps) {
  return (
    <motion.div
      className={`fixed z-40 left-1/2 -translate-x-1/2 ${
        position === "top" ? "top-4" : "bottom-4"
      }`}
      initial={{ opacity: 0, y: position === "top" ? -20 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="bg-gradient-to-r from-blue-500/90 to-purple-500/90 backdrop-blur-md shadow-lg rounded-full">
        <div className="px-5 py-2.5 flex items-center space-x-4">
          {/* 提示文字 */}
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-white/80"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-white text-sm font-medium whitespace-nowrap">
              登录网易云音乐，享受完整体验
            </span>
          </div>

          {/* 登录按钮 */}
          <button
            onClick={onLoginClick}
            className="bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-1.5 rounded-full transition-all duration-200 hover:shadow-md active:scale-95 whitespace-nowrap"
          >
            立即登录
          </button>
        </div>
      </div>
    </motion.div>
  );
}
