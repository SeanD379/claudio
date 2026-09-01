"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { usePlayer } from "@/hooks/usePlayer";
import { useKtvQueue } from "@/hooks/useKtvQueue";

interface KtvPlayerProps {
  onSongSelect?: () => void;
  onQueueToggle?: () => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function KtvPlayer({ onSongSelect, onQueueToggle }: KtvPlayerProps) {
  const [visible, setVisible] = useState(false);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(true);

  const currentSong = usePlayer((s) => s.currentSong);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const isLoading = usePlayer((s) => s.isLoading);
  const progress = usePlayer((s) => s.progress);
  const currentTime = usePlayer((s) => s.currentTime);
  const volume = usePlayer((s) => s.volume);
  const totalDuration = usePlayer((s) => s.currentSong?.duration || 0);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const nextSong = usePlayer((s) => s.nextSong);
  const prevSong = usePlayer((s) => s.prevSong);
  const setVolume = usePlayer((s) => s.setVolume);
  const seekTo = usePlayer((s) => s.seekTo);

  const queueCount = useKtvQueue((s) => s.queue.length);

  const show = useCallback(() => {
    clearTimeout(hideTimer.current);
    setVisible(true);
    hideTimer.current = setTimeout(() => {
      if (mountedRef.current) setVisible(false);
    }, 3000);
  }, []);

  // 窗口底部区域触发显示
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (e.clientY > window.innerHeight * 0.88) show();
    };
    const handleClick = () => show();

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("click", handleClick);
    };
  }, [show]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(hideTimer.current);
    };
  }, []);

  if (!currentSong) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.35s ease, transform 0.35s ease",
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        <div
          className="w-full max-w-3xl mx-auto rounded-t-xl px-4 py-3 flex items-center justify-between"
          style={{
            background: "rgba(12, 12, 18, 0.55)",
            backdropFilter: "blur(28px) saturate(150%)",
            WebkitBackdropFilter: "blur(28px) saturate(150%)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <span className="text-white/40 text-xs">未在播放</span>
          <motion.button
            onClick={onSongSelect}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
            style={{ color: "var(--accent)" }}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.08 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            点歌
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* 控制条主体 */}
      <div
        className="w-full max-w-3xl mx-auto rounded-t-xl px-4 pt-2.5 pb-3 relative"
        style={{
          background: "rgba(12, 12, 18, 0.55)",
          backdropFilter: "blur(28px) saturate(150%)",
          WebkitBackdropFilter: "blur(28px) saturate(150%)",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        {/* 进度条 */}
        <div
          className="relative h-1.5 rounded-full cursor-pointer group mb-2 mx-0.5"
          style={{ background: "rgba(255,255,255,0.12)" }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
            setHoverPct(pct);
            setHoverTime((totalDuration * pct) / 100);
          }}
          onMouseLeave={() => { setHoverPct(null); setHoverTime(null); }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
            seekTo(pct);
          }}
        >
          {/* 已播放 */}
          <div
            className="absolute h-full rounded-full"
            style={{ width: `${progress}%`, background: "rgba(255, 255, 255, 0.7)" }}
          />
          {/* 拖拽指示点 */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: "translate(-50%, -50%)", background: "#fff", boxShadow: "0 0 8px rgba(255,255,255,0.5)" }}
          />
          {/* 悬浮时间 */}
          {hoverPct !== null && hoverTime !== null && (
            <div
              className="absolute -top-7 px-1.5 py-0.5 rounded text-[10px] text-white/80 pointer-events-none"
              style={{ left: `${hoverPct}%`, transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)" }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* 控制栏 */}
        <div className="flex items-center justify-between">
          {/* 左：歌曲信息 */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {currentSong?.coverUrl && (
              <img
                src={currentSong.coverUrl}
                alt=""
                className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                style={{ boxShadow: "0 0 12px rgba(0,0,0,0.4)" }}
              />
            )}
            <div className="min-w-0">
              <p className="text-white/90 text-xs font-medium truncate max-w-[180px]">
                {currentSong.title}
              </p>
              <p className="text-white/40 text-[10px] truncate max-w-[180px]">
                {currentSong.artist}
              </p>
            </div>
          </div>

          {/* 中：播放控制 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={prevSong}
              className="text-white/50 hover:text-white/90 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
            </button>

            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white/90 rounded-full animate-spin" />
              ) : isPlaying ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            <button
              onClick={nextSong}
              className="text-white/50 hover:text-white/90 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18 14.5 12 6 6zm10-12h2v12h-2z"/></svg>
            </button>
          </div>

          {/* 右：时间 + 音量 + 点歌 + 队列 */}
          <div className="flex items-center gap-2.5 flex-1 justify-end">
            <span className="text-white/40 text-[10px] tabular-nums w-18 text-right">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.49 4.49 0 0 0 2.5-3.5zM14 3.23v2.06a7.007 7.007 0 0 1 0 13.42v2.06A9.013 9.013 0 0 0 14 3.23z"/></svg>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-14 h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgba(255,255,255,0.7) ${volume}%, rgba(255,255,255,0.12) ${volume}%)`,
                  accentColor: "rgba(255,255,255,0.8)",
                }}
              />
            </div>
            {/* 点歌按钮 */}
            <motion.button
              onClick={onSongSelect}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium hover:bg-white/10 transition-colors"
              style={{ color: "var(--accent)" }}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.08 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              点歌
            </motion.button>
            {/* 队列按钮 */}
            <motion.button
              onClick={onQueueToggle}
              className="relative p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15V6" /><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path d="M12 12H3" /><path d="M16 6H3" /><path d="M12 18H3" />
              </svg>
              {queueCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-[9px] text-white flex items-center justify-center">
                  {queueCount > 9 ? "9+" : queueCount}
                </span>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
