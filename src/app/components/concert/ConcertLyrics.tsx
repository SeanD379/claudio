"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayer } from "@/hooks/usePlayer";
import { useLyrics } from "@/hooks/useLyrics";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";

// 计算上方环形电子屏的 CSS 定位（与参考舞台画面一致）
function useLyricsPosition() {
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0, height: 0 });

  useEffect(() => {
    const calc = () => {
      const sw = window.innerWidth, sh = window.innerHeight;
      setPos({
        left: sw * 0.14,
        top: sh * 0.07,
        width: sw * 0.72,
        height: sh * 0.16,
      });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  return pos;
}

export function ConcertLyrics() {
  const currentSong = usePlayer((s) => s.currentSong);
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
      setDisplayLyric(text);
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
            className="w-full"
            initial={{ opacity: 0, y: 5, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <RingLyricText text={displayLyric} />
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

    </div>
  );
}

function RingLyricText({ text }: { text: string }) {
  const audio = useAudioAnalyzer.getState();
  const energy = audio.isPlaying ? audio.energy : 0.3;
  const fontSize = 58;
  const isCjk = /[\u3400-\u9fff]/.test(text);
  const textLength = Math.min(920, Math.max(360, text.length * fontSize * (isCjk ? 0.94 : 0.54)));

  return (
    <svg viewBox="0 0 1000 180" className="block h-full w-full overflow-visible" aria-label={text} role="img">
      <defs>
        <path id="concert-ring-lyric-path" d="M 45 117 Q 500 57 955 117" fill="none" />
      </defs>
      <text
        fontFamily="Inter, 'Helvetica Neue', Arial, sans-serif"
        fontSize={fontSize}
        fontWeight="700"
        fill="rgba(255, 255, 255, 0.94)"
        stroke="rgba(255, 214, 166, 0.17)"
        strokeWidth="0.65"
        style={{ filter: `drop-shadow(0 0 7px rgba(255,255,255,${0.2 + energy * 0.16})) drop-shadow(0 0 16px rgba(255,180,100,${0.09 + energy * 0.1}))` }}
      >
        <textPath href="#concert-ring-lyric-path" startOffset="50%" textAnchor="middle" textLength={textLength} lengthAdjust="spacingAndGlyphs">
          {text}
        </textPath>
      </text>
    </svg>
  );
}
