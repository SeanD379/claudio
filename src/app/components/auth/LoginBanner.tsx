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
      <div className="bg-[#1ed760]/95 backdrop-blur-md shadow-[0_8px_30px_rgba(30,215,96,0.24)] rounded-full">
        <div className="px-5 py-2.5 flex items-center space-x-4">
          {/* 提示文字 */}
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-[#07150c]/75"
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
            <span className="text-[#07150c] text-sm font-medium whitespace-nowrap">
              登录网易云音乐，享受完整体验
            </span>
          </div>

          {/* 登录按钮 */}
          <button
            onClick={onLoginClick}
            className="bg-[#07150c]/15 hover:bg-[#07150c]/25 text-[#07150c] text-sm font-medium px-4 py-1.5 rounded-full transition-all duration-200 hover:shadow-md active:scale-95 whitespace-nowrap"
          >
            立即登录
          </button>
        </div>
      </div>
    </motion.div>
  );
}
