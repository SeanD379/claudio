"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Heart, Music, Loader2 } from "lucide-react";
import { usePlayer, Song } from "@/hooks/usePlayer";
import { useNavigation } from "@/hooks/useNavigation";
import { useAuthContext } from "@/app/components/auth/AuthProvider";

export default function DailyRecommendPage() {
  const router = useRouter();
  const { isLoggedIn, showLoginModal } = useAuthContext();
  const { playSong, currentSong, isPlaying, setPlaylist, setAndPlay, playHistory } = usePlayer();
  const { setSourceModule } = useNavigation();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSourceModule("daily");
    // 未登录时显示登录弹窗
    if (!isLoggedIn) {
      showLoginModal();
      setLoading(false);
      return;
    }
    fetchDailySongs();
  }, [isLoggedIn]);

  const fetchDailySongs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/music/recommend/daily");
      if (res.ok) {
        const data = await res.json();
        setSongs(data.songs || []);
      } else if (res.status === 401) {
        setError("请先登录");
      } else {
        throw new Error("获取推荐失败");
      }
    } catch (err) {
      setError("获取每日推荐失败，请稍后重试");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    setAndPlay(songs, songs[0]);
    router.push("/");
  };

  const handlePlaySong = (song: Song) => {
    setAndPlay(songs, song);
    router.push("/");
  };

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}.${today.getDate()}`;

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#121212" }}>
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        {/* 顶部导航 */}
        <div className="flex items-center gap-3 mb-6">
          <motion.button
            onClick={() => { sessionStorage.setItem("claudio-go-home", "1"); router.push("/"); }}
            className="p-2 rounded-full transition-colors"
            style={{ background: "#282828", color: "#ffffff" }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "#b3b3b3" }}>DAILY</p>
            <h1 className="text-2xl font-bold" style={{ color: "#ffffff" }}>每日推荐</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1ed760" }} />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <Music className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: "#b3b3b3" }} />
            <p className="text-sm mb-4" style={{ color: "#b3b3b3" }}>{error}</p>
            <button
              onClick={fetchDailySongs}
              className="px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: "#1ed760", color: "#000000" }}
            >
              重试
            </button>
          </div>
        ) : (
          <>
            {/* 封面卡片 */}
            <motion.div
              className="rounded-2xl p-8 mb-6 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="relative z-10">
                <div className="text-7xl font-bold mb-4" style={{ color: "rgba(255,255,255,0.15)" }}>
                  {dateStr}
                </div>
                <h2 className="text-3xl font-bold mb-2" style={{ color: "#ffffff" }}>每日推荐</h2>
                <p className="text-sm mb-1" style={{ color: "#b3b3b3" }}>
                  {songs.length} 首歌曲为你精心准备
                </p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {playHistory.length > 0
                    ? "根据你最近的听歌习惯推荐"
                    : "为你精选的今日好歌"
                  }
                </p>
              </div>
              {/* 装饰性背景元素 */}
              <div
                className="absolute top-4 right-4 w-32 h-32 rounded-full opacity-10"
                style={{ background: "#1ed760", filter: "blur(40px)" }}
              />
            </motion.div>

            {/* 操作按钮 */}
            <div className="flex gap-3 mb-6">
              <motion.button
                onClick={handlePlayAll}
                className="flex items-center gap-2 px-6 py-3 rounded-full transition-all"
                style={{ background: "#1ed760", color: "#000000" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <Play className="w-5 h-5 fill-current" />
                <span className="text-sm font-semibold uppercase tracking-wider">播放全部</span>
              </motion.button>
            </div>

            {/* 歌曲列表 */}
            <div className="space-y-1">
              {songs.map((song, index) => {
                const isCurrent = currentSong?.neteaseId === song.neteaseId;
                return (
                  <motion.div
                    key={song.neteaseId}
                    className="flex items-center gap-4 p-3 rounded-xl cursor-pointer group transition-colors"
                    style={{
                      background: isCurrent ? "rgba(30, 215, 96, 0.1)" : "transparent",
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 * index }}
                    whileHover={{ backgroundColor: "#181818" }}
                    onClick={() => handlePlaySong(song)}
                  >
                    {/* 序号 */}
                    <div className="w-8 text-center flex-shrink-0">
                      {isCurrent && isPlaying ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <div className="w-1 h-3 rounded-full animate-pulse" style={{ background: "#1ed760" }} />
                          <div className="w-1 h-4 rounded-full animate-pulse" style={{ background: "#1ed760", animationDelay: "0.15s" }} />
                          <div className="w-1 h-2 rounded-full animate-pulse" style={{ background: "#1ed760", animationDelay: "0.3s" }} />
                        </div>
                      ) : (
                        <span className="text-sm" style={{ color: isCurrent ? "#1ed760" : "#b3b3b3" }}>
                          {index + 1}
                        </span>
                      )}
                    </div>

                    {/* 封面 */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "#282828" }}>
                      {song.coverUrl ? (
                        <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-4 h-4" style={{ color: "#b3b3b3" }} />
                        </div>
                      )}
                    </div>

                    {/* 歌曲信息 */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: isCurrent ? "#1ed760" : "#ffffff" }}
                      >
                        {song.title}
                      </p>
                      <p className="text-xs truncate" style={{ color: "#b3b3b3" }}>
                        {song.artist}
                      </p>
                    </div>

                    {/* 时长 */}
                    <span className="text-xs flex-shrink-0" style={{ color: "#b3b3b3" }}>
                      {formatDuration(song.duration)}
                    </span>

                    {/* 收藏按钮 */}
                    <motion.button
                      className="p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      style={{ color: "#b3b3b3" }}
                      whileHover={{ scale: 1.1, color: "#1ed760" }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: 实现收藏功能
                      }}
                    >
                      <Heart className="w-4 h-4" />
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>

            {/* 底部留白 */}
            <div className="h-8" />
          </>
        )}
      </div>
    </div>
  );
}
