"use client";

import { useEffect, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Repeat,
  Repeat1,
  Shuffle,
  Heart,
  Loader2,
} from "lucide-react";
import { usePlayer } from "@/hooks/usePlayer";
import { useFavorites } from "@/hooks/useFavorites";
import { useTranslation } from "@/hooks/useTranslation";
import { useTheme } from "@/hooks/useTheme";

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// 进度条子组件 — 只订阅 progress + currentTime
const ProgressBar = memo(function ProgressBar() {
  const progress = usePlayer((s) => s.progress);
  const currentTime = usePlayer((s) => s.currentTime);
  const totalDuration = usePlayer((s) => s.currentSong?.duration || 0);
  const seekTo = usePlayer((s) => s.seekTo);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  return (
    <>
      {/* 进度条 */}
      <div
        className="relative h-1.5 rounded-full cursor-pointer group mb-2.5 mx-1"
        style={{ backgroundColor: "color-mix(in srgb, var(--surface-elevated) 60%, transparent)" }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          seekTo(Math.min(100, Math.max(0, (x / rect.width) * 100)));
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const pct = (x / rect.width) * 100;
          setHoverProgress(Math.min(100, Math.max(0, pct)));
          setHoverTime((totalDuration * pct) / 100);
        }}
        onMouseLeave={() => { setHoverProgress(null); setHoverTime(null); }}
      >
        <div
          className="absolute h-full rounded-full transition-[width] duration-100"
          style={{ width: `${progress}%`, background: `linear-gradient(90deg, var(--accent), var(--accent-hover))` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%`, transform: "translate(-50%, -50%)", backgroundColor: "var(--accent)", boxShadow: `0 0 8px var(--accent-glow)` }}
        />
        {hoverProgress !== null && hoverTime !== null && (
          <div
            className="absolute -top-6 px-1.5 py-0.5 rounded bg-surface/90 text-[9px] text-text-muted pointer-events-none"
            style={{ left: `${hoverProgress}%`, transform: "translateX(-50%)" }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>

      {/* 时间显示 */}
      <div className="flex items-center justify-between mb-0">
        <span className="text-[10px] text-text-muted w-9">{formatTime(currentTime)}</span>
        <span className="text-[10px] text-text-muted w-9 text-right">{formatTime(totalDuration)}</span>
      </div>
    </>
  );
});

// 播放控制子组件 — 只订阅 isPlaying + isLoading + playMode + volume
const PlayControls = memo(function PlayControls() {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const isLoading = usePlayer((s) => s.isLoading);
  const playMode = usePlayer((s) => s.playMode);
  const volume = usePlayer((s) => s.volume);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const nextSong = usePlayer((s) => s.nextSong);
  const prevSong = usePlayer((s) => s.prevSong);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const setVolume = usePlayer((s) => s.setVolume);

  return (
    <div className="flex items-center justify-between relative z-10">
      {/* 左侧：功能按钮 */}
      <div className="flex items-center gap-2">
        <button
          onClick={cycleRepeat}
          className={`transition-colors p-1 ${playMode !== "sequential" ? "text-accent" : "text-text-muted hover:text-text-secondary"}`}
          title={playMode === "sequential" ? "顺序播放" : playMode === "repeat-all" ? "列表循环" : playMode === "repeat-one" ? "单曲循环" : "随机播放"}
        >
          {playMode === "shuffle" ? <Shuffle className="w-3.5 h-3.5" /> : playMode === "repeat-one" ? <Repeat1 className="w-3.5 h-3.5" /> : playMode === "repeat-all" ? <Repeat className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 中间：播放控制 */}
      <div className="flex items-center gap-2.5">
        <button onClick={prevSong} className="text-text-secondary hover:text-text-primary transition-colors p-1">
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-on-accent)", boxShadow: `0 2px 12px var(--accent-glow)` }}
        >
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div key="loading" initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} exit={{ scale: 0 }} transition={{ rotate: { duration: 1, repeat: Infinity, ease: "linear" } }}>
                <Loader2 className="w-4.5 h-4.5" />
              </motion.div>
            ) : isPlaying ? (
              <motion.div key="pause" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Pause className="w-4.5 h-4.5" />
              </motion.div>
            ) : (
              <motion.div key="play" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Play className="w-4.5 h-4.5 ml-0.5" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        <button onClick={nextSong} className="text-text-secondary hover:text-text-primary transition-colors p-1">
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* 右侧：音量 */}
      <div className="flex items-center gap-2">
        <Volume2 className="w-3.5 h-3.5 text-text-muted" />
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-14 h-1 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, var(--accent) ${volume}%, color-mix(in srgb, var(--surface-elevated) 60%, transparent) ${volume}%)` }}
        />
      </div>
    </div>
  );
});

export function Player() {
  const currentSong = usePlayer((s) => s.currentSong);
  const initAudio = usePlayer((s) => s.initAudio);
  const fetchFavorites = useFavorites((s) => s.fetchFavorites);
  const favorites = useFavorites((s) => s.favorites);
  const addFavorite = useFavorites((s) => s.addFavorite);
  const removeFavorite = useFavorites((s) => s.removeFavorite);
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [coverGlow, setCoverGlow] = useState("rgba(139, 156, 247, 0.15)");

  useEffect(() => {
    initAudio();
    fetchFavorites();
    usePlayer.getState().restorePlayMode();
  }, [initAudio, fetchFavorites]);

  const isFavorite = currentSong ? favorites.some((f) => f.neteaseId === currentSong.neteaseId) : false;

  const handleToggleFavorite = () => {
    if (!currentSong) return;
    isFavorite ? removeFavorite(currentSong.neteaseId) : addFavorite(currentSong);
  };

  // 提取封面主色调
  useEffect(() => {
    if (!currentSong?.coverUrl) {
      setCoverGlow("rgba(139, 156, 247, 0.15)");
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentSong.coverUrl;
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          setCoverGlow(`rgba(${r}, ${g}, ${b}, 0.25)`);
        }
      } catch {
        if (!cancelled) setCoverGlow("rgba(139, 156, 247, 0.15)");
      }
    };
    return () => { cancelled = true; };
  }, [currentSong?.coverUrl]);

  return (
    <motion.div
      className="w-full max-w-md mx-auto relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* 播放器主体 — 玻璃羽化 */}
      <div
        className="rounded-2xl px-5 py-3.5 relative overflow-hidden"
        style={{
          background: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* 羽化光晕背景 */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 20% 50%, ${coverGlow}, transparent 70%)`,
          }}
        />

        {/* 上层：封面 + 歌曲信息 */}
        <div className="flex items-center gap-3 mb-2.5 relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSong?.neteaseId || "empty"}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
              style={{ boxShadow: `0 2px 12px ${coverGlow}` }}
            >
              {currentSong?.coverUrl ? (
                <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-surface-elevated flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border border-text-muted flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.h3
                key={currentSong?.neteaseId || "title"}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="text-sm font-semibold text-text-primary truncate leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {currentSong?.title || t("player.notPlaying")}
              </motion.h3>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.p
                key={currentSong?.artist || "artist"}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.2, delay: 0.03 }}
                className="text-[11px] text-text-secondary truncate"
              >
                {currentSong?.artist || t("player.selectSong")}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* 收藏按钮 */}
          <button
            onClick={handleToggleFavorite}
            className={`transition-colors p-1 flex-shrink-0 ${isFavorite ? "text-accent" : "text-text-muted hover:text-text-secondary"}`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* 进度条 — 独立订阅，不触发其他部分重渲染 */}
        <ProgressBar />

        {/* 底部控制栏 */}
        <PlayControls />
      </div>
    </motion.div>
  );
}
