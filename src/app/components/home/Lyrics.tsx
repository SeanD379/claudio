"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayer } from "@/hooks/usePlayer";
import { useLyrics } from "@/hooks/useLyrics";

export function Lyrics() {
  const currentSong = usePlayer((s) => s.currentSong);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const { lyrics, currentIndex, hasLyrics, isLoading, fetchLyrics, reset } = useLyrics();

  const [displayLyric, setDisplayLyric] = useState<string>("");
  const prevIndexRef = useRef(-1);
  const currentTimeRef = useRef(0);

  // 用 subscribe 跟踪 currentTime（不触发重渲染）
  useEffect(() => {
    const unsub = usePlayer.subscribe((state) => {
      currentTimeRef.current = state.currentTime;
    });
    return unsub;
  }, []);

  // 定时用 currentTime 更新歌词索引（~60fps，但只在 index 变化时 setState）
  useEffect(() => {
    if (lyrics.length === 0) return;
    let raf = 0;
    const tick = () => {
      useLyrics.getState().updateCurrentIndex(currentTimeRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lyrics]);

  // 当歌曲变化时获取歌词
  useEffect(() => {
    if (currentSong?.neteaseId) {
      fetchLyrics(currentSong.neteaseId);
    } else {
      reset();
    }
  }, [currentSong?.neteaseId, fetchLyrics, reset]);

  // 歌词变化时触发过渡动画
  useEffect(() => {
    if (currentIndex !== prevIndexRef.current && currentIndex >= 0) {
      const text = lyrics[currentIndex]?.text || "";
      const timer = setTimeout(() => {
        setDisplayLyric(text);
      }, 150);
      prevIndexRef.current = currentIndex;
      return () => clearTimeout(timer);
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex, lyrics]);

  // 没有歌曲时显示提示
  if (!currentSong) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.p
          className="text-4xl md:text-5xl lg:text-6xl font-light text-center"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--text-muted)",
            letterSpacing: "-0.02em",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 1 }}
        >
          选择一首歌，开始你的旅程
        </motion.p>
      </div>
    );
  }

  // 加载中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  // 纯音乐（无歌词）
  if (!hasLyrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <motion.p
          className="text-3xl md:text-4xl font-light text-center"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--text-secondary)",
            letterSpacing: "-0.02em",
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          纯音乐，请欣赏
        </motion.p>
        <motion.div
          className="flex gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "var(--text-muted)" }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>
      </div>
    );
  }

  // 有歌词时显示当前行
  return (
    <div className="flex items-center justify-center h-full px-8">
      <div className="relative w-full max-w-5xl flex items-center justify-center" style={{ minHeight: "120px" }}>
        {/* Gooey SVG Filter */}
        <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
          <defs>
            <filter id="gooey-filter">
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        0 0 0 255 -140"
              />
            </filter>
          </defs>
        </svg>

        {/* 歌词显示区域 - 整体居中 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            className="text-center w-full"
            style={{ filter: "url(#gooey-filter)" }}
            initial={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
            transition={{
              duration: 0.5,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <p
              className="font-bold leading-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--text-primary)",
                fontSize: "clamp(36px, 6vw, 80px)",
                letterSpacing: "-0.03em",
                textShadow: isPlaying
                  ? "0 0 60px var(--accent-glow)"
                  : "none",
                wordBreak: "break-word",
              }}
            >
              {displayLyric || "..."}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* 呼吸光效背景 */}
        {isPlaying && displayLyric && (
          <motion.div
            className="absolute inset-0 -z-10 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2 }}
          >
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background: "radial-gradient(ellipse at center, rgba(139, 156, 247, 0.08) 0%, transparent 70%)",
                animation: "breathe 4s ease-in-out infinite",
              }}
            />
          </motion.div>
        )}
      </div>

      <style jsx>{`
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
