"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { useStatus, ALL_STATUSES } from "@/hooks/useStatus";

export function StatusPicker() {
  const { currentStatus, setStatus } = useStatus();
  const [isOpen, setIsOpen] = useState(false);

  const current = ALL_STATUSES.find((s) => s.id === currentStatus);

  return (
    <div className="relative">
      {/* 触发按钮 */}
      <motion.button
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface/60 backdrop-blur-md border border-white/5 hover:bg-surface-elevated/60 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="text-lg">{current?.emoji}</span>
        <span className="text-xs text-text-secondary">{current?.label}</span>
        <ChevronUp
          className={`w-3 h-3 text-text-muted transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </motion.button>

      {/* 下拉面板 */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* 状态列表 */}
            <motion.div
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-64 p-2 rounded-2xl bg-surface/90 backdrop-blur-xl border border-white/10 shadow-2xl"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-xs text-text-muted px-2 py-1 mb-1">
                你现在的心情是...
              </p>
              <div className="grid grid-cols-3 gap-1">
                {ALL_STATUSES.map((status) => (
                  <motion.button
                    key={status.id}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      currentStatus === status.id
                        ? "bg-accent/20 border border-accent/30"
                        : "hover:bg-surface-elevated/60 border border-transparent"
                    }`}
                    onClick={() => {
                      setStatus(status.id);
                      setIsOpen(false);
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title={status.description}
                  >
                    <span className="text-xl">{status.emoji}</span>
                    <span className="text-[10px] text-text-secondary">
                      {status.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
