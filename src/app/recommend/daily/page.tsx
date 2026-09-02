"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Music, Loader2 } from "lucide-react";
import { usePlayer, Song } from "@/hooks/usePlayer";
import { useNavigation } from "@/hooks/useNavigation";
import { useAuthContext } from "@/app/components/auth/AuthProvider";

export default function DailyRecommendPage() {
  const router = useRouter();
  const { isLoggedIn, showLoginModal } = useAuthContext();
  const { playSong, currentSong, isPlaying, setPlaylist, setAndPlay, playHistory } = usePlayer();
  const { setReturnPath } = useNavigation();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    setReturnPath("/recommend/daily");
    setAndPlay(songs, songs[0]);
    router.push("/");
  };

  const handlePlaySong = (song: Song) => {
    setReturnPath("/recommend/daily");
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
  const heroCover = songs[0]?.coverUrl;

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
            <motion.section className="relative mb-8 overflow-hidden rounded-3xl border p-5 sm:p-7" style={{ background: "linear-gradient(118deg, #18322a 0%, #13211d 48%, #101314 100%)", borderColor: "rgba(30,215,96,0.16)" }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="absolute -right-12 -top-20 h-72 w-72 rounded-full bg-[#1ed760]/15 blur-3xl" />
              <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end">
                <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-2xl shadow-2xl sm:h-44 sm:w-44" style={{ background: "linear-gradient(145deg, #1ed760, #143a28)" }}>
                  {heroCover ? <img src={heroCover} alt="今日推荐封面" className="h-full w-full object-cover" /> : <Music className="absolute inset-0 m-auto h-10 w-10 text-black/50" />}
                  <span className="absolute inset-x-0 bottom-0 bg-black/45 px-3 py-2 text-xs font-semibold tracking-[0.16em] text-white backdrop-blur-sm">DAILY MIX</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-[11px] font-semibold tracking-[0.24em] text-[#1ed760]">FOR YOU · {dateStr}</p>
                  <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">每日推荐</h2>
                  <p className="mt-2 text-sm text-[#b8c5be]">{playHistory.length > 0 ? "根据你最近的听歌习惯，为你编排今天的声音。" : "一份适合今天开始播放的精选歌单。"}</p>
                  <p className="mt-1 text-xs text-[#7f9388]">{songs.length} 首歌曲 · 每天更新</p>
                  <motion.button onClick={handlePlayAll} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1ed760] px-5 text-sm font-semibold text-[#07150c] shadow-[0_10px_24px_rgba(30,215,96,0.22)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" whileTap={{ scale: 0.96 }}>
                    <Play className="h-4 w-4 fill-current" /> 播放全部
                  </motion.button>
                </div>
                <div className="hidden self-start text-right sm:block"><p className="text-5xl font-semibold tracking-tighter text-white/15">{dateStr}</p><p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-white/35">TODAY&apos;S SELECTION</p></div>
              </div>
            </motion.section>

            <h3 className="mb-3 text-base font-semibold text-white">推荐歌曲</h3>
            <div className="overflow-hidden rounded-2xl border" style={{ background: "#151617", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="hidden grid-cols-[52px_minmax(0,1.4fr)_minmax(120px,0.8fr)_60px] items-center gap-4 border-b px-5 py-3 text-[11px] font-medium text-[#767b78] sm:grid" style={{ borderColor: "rgba(255,255,255,0.07)" }}><span>#</span><span>歌曲</span><span>歌手</span><span className="text-right">时长</span></div>
              {songs.map((song, index) => {
                const isCurrent = currentSong?.neteaseId === song.neteaseId;
                return (
                  <motion.div
                    key={song.neteaseId}
                    className="group grid cursor-pointer grid-cols-[32px_48px_minmax(0,1fr)_52px] items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-0 sm:grid-cols-[40px_48px_minmax(0,1.4fr)_minmax(120px,0.8fr)_60px] sm:px-5"
                    style={{ background: isCurrent ? "rgba(30,215,96,0.10)" : "transparent", borderColor: "rgba(255,255,255,0.06)" }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.3) }}
                    whileHover={{ backgroundColor: isCurrent ? "rgba(30,215,96,0.14)" : "#202220" }}
                    onClick={() => handlePlaySong(song)}
                  >
                    <div className="text-center">
                      {isCurrent && isPlaying ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <div className="w-1 h-3 rounded-full animate-pulse" style={{ background: "#1ed760" }} />
                          <div className="w-1 h-4 rounded-full animate-pulse" style={{ background: "#1ed760", animationDelay: "0.15s" }} />
                          <div className="w-1 h-2 rounded-full animate-pulse" style={{ background: "#1ed760", animationDelay: "0.3s" }} />
                        </div>
                      ) : (
                        <span className="text-sm tabular-nums" style={{ color: isCurrent ? "#1ed760" : "#8d928f" }}>
                          {index + 1}
                        </span>
                      )}
                    </div>

                    <div className="h-12 w-12 overflow-hidden rounded-lg" style={{ background: "#282828" }}>
                      {song.coverUrl ? (
                        <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-4 h-4" style={{ color: "#b3b3b3" }} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: isCurrent ? "#1ed760" : "#ffffff" }}
                      >
                        {song.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[#8d928f] sm:hidden">{song.artist}</p>
                    </div>
                    <p className="hidden truncate text-sm text-[#a5aaa7] sm:block">{song.artist}</p>
                    <span className="text-right text-xs tabular-nums text-[#8d928f]">{formatDuration(song.duration)}</span>
                  </motion.div>
                );
              })}
            </div>
            <div className="h-10" />
          </>
        )}
      </div>
    </div>
  );
}
