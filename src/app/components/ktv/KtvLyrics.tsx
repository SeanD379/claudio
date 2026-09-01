"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayer } from "@/hooks/usePlayer";
import { useLyrics } from "@/hooks/useLyrics";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";

// 计算中央 LED 大屏在屏幕上的 CSS 定位（与 Canvas 绘制坐标一致）
function useLyricsPosition() {
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0, height: 0 });

  useEffect(() => {
    const calc = () => {
      const sw = window.innerWidth, sh = window.innerHeight;
      setPos({
        left: sw * 0.23,
        top: sh * 0.14,
        width: sw * 0.54,
        height: sh * 0.18,
      });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  return pos;
}

export function KtvLyrics() {
  const currentSong = usePlayer((s) => s.currentSong);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const { lyrics, currentIndex, hasLyrics, isLoading, fetchLyrics, reset } = useLyrics();
  const [displayLyric, setDisplayLyric] = useState("");
  const prevIndexRef = useRef(-1);
  const currentTimeRef = useRef(0);

  // 跟踪 currentTime
  useEffect(() => {
    const unsub = usePlayer.subscribe((state) => {
      currentTimeRef.current = state.currentTime;
    });
    return unsub;
  }, []);

  // 定时更新歌词索引
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

  // 歌曲变化时获取歌词
  useEffect(() => {
    if (currentSong?.neteaseId) {
      fetchLyrics(currentSong.neteaseId);
    } else {
      reset();
    }
  }, [currentSong?.neteaseId, fetchLyrics, reset]);

  // 歌词变化时更新
  useEffect(() => {
    if (currentIndex !== prevIndexRef.current && currentIndex >= 0) {
      const text = lyrics[currentIndex]?.text || "";
      setTimeout(() => setDisplayLyric(text), 150);
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex, lyrics]);

  const lyricsPos = useLyricsPosition();

  if (!currentSong) return null;

  return (
    <div
      className="fixed z-20 flex items-center justify-center"
      style={{
        left: lyricsPos.left,
        top: lyricsPos.top,
        width: lyricsPos.width,
        height: lyricsPos.height,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence mode="wait">
        {hasLyrics && displayLyric ? (
          <motion.div
            key={currentIndex}
            className="text-center mx-auto w-full px-6 sm:px-10"
            style={{ maxWidth: "900px" }}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <LedLyricText text={displayLyric} />
          </motion.div>
        ) : isLoading ? (
          <motion.div
            key="loading"
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin mx-auto"
            />
          </motion.div>
        ) : !hasLyrics ? (
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-white/30 text-lg tracking-widest">
              纯音乐，请欣赏
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 歌曲信息（左下角） */}
      <div className="absolute bottom-2 left-4">
        <p className="text-white/20 text-xs tracking-wide">
          {currentSong.title} - {currentSong.artist}
        </p>
      </div>
    </div>
  );
}

// LED屏幕风格的歌词文字
function LedLyricText({ text }: { text: string }) {
  const audio = useAudioAnalyzer.getState();
  const energy = audio.isPlaying ? audio.energy : 0.3;

  return (
    <p
      className="font-bold leading-tight"
      style={{
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        fontSize: "clamp(24px, 3.8vw, 52px)",
        letterSpacing: "-0.02em",
        color: "rgba(255, 255, 255, 0.95)",
        textShadow: `
          0 0 20px rgba(255, 255, 255, ${0.3 + energy * 0.3}),
          0 0 40px rgba(${audio.mood === "tech" ? "100, 150, 255" : "255, 200, 100"}, ${0.2 + energy * 0.2}),
          0 0 80px rgba(${audio.mood === "tech" ? "100, 150, 255" : "255, 200, 100"}, ${0.1 + energy * 0.1})
        `,
        wordBreak: "break-word",
        WebkitTextStroke: "0.5px rgba(255, 255, 255, 0.1)",
      }}
    >
      {text}
    </p>
  );
}
