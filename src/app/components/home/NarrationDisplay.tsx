"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTTS } from "@/hooks/useTTS";

interface NarrationDisplayProps {
  narration: string | null;
  onDismiss: () => void;
}

export function NarrationDisplay({ narration, onDismiss }: NarrationDisplayProps) {
  const isSpeaking = useTTS((s) => s.isPlaying);
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(-1);
  const [keepShowing, setKeepShowing] = useState(false);
  const hasSpoken = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 新旁白来了，显示并重置
  useEffect(() => {
    if (narration) {
      setVisible(true);
      setCountdown(-1);
      hasSpoken.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [narration]);

  // 记录 TTS 是否播放过
  useEffect(() => {
    if (isSpeaking) {
      hasSpoken.current = true;
    }
  }, [isSpeaking]);

  // 监听 TTS 结束，开始倒计时（如果没选保持显示）
  useEffect(() => {
    if (visible && narration && !isSpeaking && hasSpoken.current && countdown === -1 && !keepShowing) {
      let remaining = 5;
      setCountdown(remaining);

      intervalRef.current = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setVisible(false);
          setTimeout(() => onDismiss(), 300);
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    }
  }, [visible, narration, isSpeaking, countdown, keepShowing, onDismiss]);

  // 清理
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // 切换保持显示
  const toggleKeep = useCallback(() => {
    const newVal = !keepShowing;
    setKeepShowing(newVal);
    if (newVal) {
      // 选上保持显示，取消倒计时
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCountdown(-1);
    }
  }, [keepShowing]);

  return (
    <AnimatePresence>
      {visible && narration && (
        <motion.div
          className="fixed bottom-24 right-6 z-50 max-w-xs"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* 聊天气泡 - 头像在右边 */}
          <div className="relative">
            {/* 头像和名称 - 右对齐 */}
            <div className="flex items-end gap-2 mb-1 justify-end">
              <span className="text-xs text-text-muted">Claudio</span>
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🎵</span>
              </div>
            </div>

            {/* 消息气泡 */}
            <div className="relative">
              <div className="px-4 py-3 rounded-2xl rounded-tr-md bg-surface/90 backdrop-blur-xl border border-white/10 shadow-lg">
                {/* 说话指示器 */}
                {isSpeaking && (
                  <div className="flex gap-1 mb-2">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-accent"
                        animate={{
                          scale: [1, 1.4, 1],
                          opacity: [0.4, 1, 0.4],
                        }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* 旁白文字 - 左对齐 */}
                <p className="text-sm text-text-primary leading-relaxed text-left">
                  {narration}
                </p>

                {/* 倒计时和保持显示 */}
                {countdown > 0 && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                    <button
                      onClick={toggleKeep}
                      className="flex items-center gap-1.5"
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                        keepShowing
                          ? "bg-accent border-accent"
                          : "border-text-muted bg-transparent"
                      }`} />
                      <span className="text-[10px] text-text-secondary">
                        保持显示
                      </span>
                    </button>
                    <span className="text-[10px] text-text-muted ml-auto">
                      {countdown}秒后自动消失
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
