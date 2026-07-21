"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayer, Song } from "@/hooks/usePlayer";
import { useAuthContext } from "@/app/components/auth/AuthProvider";

const CARD_H = 80;
const CARD_GAP = 12;
const CARD_W = 320;

function SongCard({
  song,
  index,
  isActive,
  onClick,
}: {
  song: Song;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const isPlaying = usePlayer((s) => s.isPlaying);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 rounded-xl transition-all duration-300 cursor-pointer border border-transparent"
      style={{
        width: CARD_W,
        height: CARD_H,
        background: isActive
          ? "rgba(255,255,255,0.15)"
          : "rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderColor: isActive ? "rgba(139,156,247,0.4)" : "transparent",
        boxShadow: isActive
          ? "0 0 20px rgba(139,156,247,0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
          : "inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* 序号 */}
      <span
        className="w-6 text-center flex-shrink-0 text-[13px]"
        style={{
          color: isActive
            ? "var(--accent)"
            : "rgba(255,255,255,0.35)",
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {isActive && isPlaying ? (
          <span className="inline-flex gap-px items-end h-3">
            <span
              className="w-0.5 bg-accent rounded-full animate-pulse"
              style={{ height: "8px", animationDelay: "0ms" }}
            />
            <span
              className="w-0.5 bg-accent rounded-full animate-pulse"
              style={{ height: "12px", animationDelay: "150ms" }}
            />
            <span
              className="w-0.5 bg-accent rounded-full animate-pulse"
              style={{ height: "6px", animationDelay: "300ms" }}
            />
          </span>
        ) : (
          index + 1
        )}
      </span>

      {/* 封面 */}
      <div
        className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
        style={{
          boxShadow: isActive
            ? "0 2px 8px rgba(0,0,0,0.3)"
            : "0 1px 4px rgba(0,0,0,0.2)",
        }}
      >
        {song.coverUrl ? (
          <img
            src={song.coverUrl}
            alt={song.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-white/10 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            </div>
          </div>
        )}
      </div>

      {/* 歌曲信息 */}
      <div className="flex-1 min-w-0 text-left">
        <p
          className="text-[14px] truncate leading-tight"
          style={{
            color: isActive
              ? "#fff"
              : "rgba(255,255,255,0.75)",
            fontWeight: isActive ? 600 : 400,
          }}
        >
          {song.title}
        </p>
        <p
          className="text-[12px] truncate mt-0.5"
          style={{
            color: isActive
              ? "rgba(139,156,247,0.9)"
              : "rgba(255,255,255,0.35)",
          }}
        >
          {song.artist}
        </p>
      </div>
    </button>
  );
}

export function CircularPlaylist() {
  const playlist = usePlayer((s) => s.playlist);
  const currentSong = usePlayer((s) => s.currentSong);
  const playSong = usePlayer((s) => s.playSong);
  const { isLoggedIn, showLoginModal } = useAuthContext();

  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const animatingRef = useRef(false);

  const hideTimer = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 当前歌曲在播放列表中的索引
  const currentIndex = currentSong
    ? playlist.findIndex((s) => s.neteaseId === currentSong.neteaseId)
    : -1;

  // 歌曲切换时重置滚动偏移（回到当前歌曲居中）
  useEffect(() => {
    setScrollOffset(0);
  }, [currentIndex]);

  // 平滑滚动动画（回到当前）
  const scrollTo = useCallback((target: number) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    const start = scrollOffset;
    const diff = target - start;
    const duration = 400;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setScrollOffset(Math.round(start + diff * eased));
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        animatingRef.current = false;
      }
    };
    requestAnimationFrame(animate);
  }, [scrollOffset]);

  // 鼠标进入右侧热区 → 显示
  const handleEdgeEnter = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    setVisible(true);
    setHovering(true);
  }, []);

  // 鼠标离开容器 → 延迟隐藏
  const handleContainerLeave = useCallback(() => {
    setHovering(false);
    hideTimer.current = window.setTimeout(() => setVisible(false), 400);
  }, []);

  // 鼠标进入容器 → 取消隐藏
  const handleContainerEnter = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    setHovering(true);
  }, []);

  // 滚轮滚动 — 第一首/最后一首停在中间位置（和当前播放歌曲同位置）
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      setScrollOffset((prev) => {
        const step = e.deltaY > 0 ? 1 : -1;
        const next = prev + step;
        // 上限：第一首在中间 → centerIdx=0 → scrollOffset = -currentIndex
        // 下限：最后一首在中间 → centerIdx=length-1 → scrollOffset = length-1-currentIndex
        const minOffset = -currentIndex;
        const maxOffset = playlist.length - 1 - currentIndex;
        return Math.max(minOffset, Math.min(maxOffset, next));
      });
    },
    [playlist.length, currentIndex]
  );

  // 点击播放
  const handlePlay = useCallback(
    (song: Song) => {
      const player = usePlayer.getState();
      if (player.playlist.length === 0) {
        player.setAndPlay(playlist, song);
      } else {
        player.playSong(song);
      }
    },
    [playlist]
  );

  // 未登录时也显示（登录提示），playlist为空时只在已登录时隐藏
  if (isLoggedIn && playlist.length === 0) return null;

  // ── 弧形几何 ──
  const VISIBLE_COUNT = Math.min(11, playlist.length);
  const halfVisible = Math.floor(VISIBLE_COUNT / 2);

  // 以当前播放歌曲为中心，滚动偏移为相对偏移
  const centerIdx = currentIndex >= 0 ? currentIndex + scrollOffset : scrollOffset;

  // 计算可见范围
  let startIdx = centerIdx - halfVisible;
  let endIdx = centerIdx + halfVisible;
  if (startIdx < 0) { startIdx = 0; endIdx = Math.min(VISIBLE_COUNT - 1, playlist.length - 1); }
  if (endIdx >= playlist.length) { endIdx = playlist.length - 1; startIdx = Math.max(0, endIdx - VISIBLE_COUNT + 1); }

  const visibleSongs = playlist.slice(startIdx, endIdx + 1);
  const totalVisible = visibleSongs.length;

  // 弧形参数 — 弧度稍大，顶部让出模式切换器位置
  const containerH = typeof window !== "undefined" ? window.innerHeight - 80 : 800;
  const componentW = 440;
  const cardBaseX = 200;
  const arcBulge = 70;
  const containerCenterY = containerH / 2 + 40; // 整体下移，避开顶部模式切换器
  const cardSpacing = CARD_H + CARD_GAP;

  // 生成每张卡片的位置
  const cards = visibleSongs.map((song, i) => {
    const relativeIdx = startIdx + i - centerIdx;
    const hasValidCenter = currentIndex >= 0;
    const t = hasValidCenter
      ? relativeIdx / Math.max(halfVisible, 1)
      : (i - (totalVisible - 1) / 2) / Math.max((totalVisible - 1) / 2, 1);

    // Y：均匀分布
    const y = containerCenterY + relativeIdx * cardSpacing;

    // X：抛物线弧度，中间(t=0)最左，越往上下越右
    const x = cardBaseX + t * t * arcBulge;

    // 轻微旋转跟随弧度
    const rotationDeg = t * 4;

    // 透视：越靠近两端越小越透明
    const absNorm = Math.abs(t);
    const scale = 1 - absNorm * 0.18;
    const opacity = 1 - absNorm * 0.5;

    return {
      song,
      index: startIdx + i,
      x,
      y,
      rotation: rotationDeg,
      scale,
      opacity,
      isActive: currentSong?.neteaseId === song.neteaseId,
    };
  });

  return (
    <>
      {/* 右侧热区 — 永远存在，不可见 */}
      <div
        className="fixed top-0 right-0 z-[55]"
        style={{ width: 50, height: "100vh" }}
        onMouseEnter={handleEdgeEnter}
      />

      {/* 弧形歌单主体 */}
      <AnimatePresence>
        {visible && (
          <motion.div
            ref={containerRef}
            className="fixed top-0 right-0 z-[58] pointer-events-auto"
            style={{ width: componentW, height: "100vh" }}
            initial={{ x: componentW, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: componentW, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            onMouseEnter={handleContainerEnter}
            onMouseLeave={handleContainerLeave}
            onWheel={handleWheel}
          >
            {/* 未登录时显示登录提示 */}
            {!isLoggedIn ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-16 h-16 mb-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-blue-400"
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
                <h3 className="text-lg font-semibold text-white mb-2">
                  登录后解锁你的专属歌单
                </h3>
                <p className="text-white/60 mb-4 text-sm">
                  登录网易云音乐，享受完整体验
                </p>
                <button
                  onClick={showLoginModal}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-2 rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  立即登录
                </button>
              </div>
            ) : (
              <>
                {/* 已登录：歌曲卡片 */}
                <div className="absolute inset-0" style={{ overflow: "hidden" }}>
                  {cards.map((card) => (
                    <div
                      key={`${card.song.neteaseId}-${card.index}`}
                      className="absolute"
                      style={{
                        left: card.x,
                        top: card.y,
                        transform: `translate(-50%, -50%) rotate(${card.rotation}deg) scale(${card.scale})`,
                        opacity: card.opacity,
                        transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                        zIndex: card.isActive ? 10 : 1,
                      }}
                    >
                      <SongCard
                        song={card.song}
                        index={card.index}
                        isActive={card.isActive}
                        onClick={() => handlePlay(card.song)}
                      />
                    </div>
                  ))}
                </div>

                {/* 歌单信息 */}
                <div
                  className="absolute top-8 text-right pr-4 pointer-events-none"
                  style={{ right: 0 }}
                >
                  <p
                    className="text-[11px] tracking-wide"
                    style={{ color: "rgba(139,156,247,0.5)" }}
                  >
                    {currentIndex >= 0 ? `${currentIndex + 1} / ${playlist.length}` : `${playlist.length} 首`}
                  </p>
                </div>

                {/* 回到当前 — 竖行文字按钮 */}
                {scrollOffset !== 0 && currentIndex >= 0 && (
                  <motion.button
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    onClick={() => scrollTo(0)}
                    className="absolute flex items-center justify-center transition-all hover:scale-105"
                    style={{
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                      padding: "10px 6px",
                      borderRadius: 8,
                      background: "rgba(139,156,247,0.12)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(139,156,247,0.2)",
                      color: "rgba(255,255,255,0.85)",
                      fontSize: 11,
                      letterSpacing: "0.15em",
                    }}
                  >
                    回到当前
                  </motion.button>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
