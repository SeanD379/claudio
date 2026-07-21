"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ListMusic, Plus, Music, ArrowLeft, Play, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useTranslation } from "@/hooks/useTranslation";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/app/components/auth/AuthProvider";
import ImportPlaylistModal from "@/app/components/settings/ImportPlaylistModal";

type View = "collections" | "imported";

export default function PlaylistsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { isLoggedIn, isLoading, showLoginModal } = useAuthContext();
  const { favorites, fetchFavorites } = useFavorites();
  const {
    playlists,
    isLoading: playlistsLoading,
    syncLoading,
    syncResults,
    fetchPlaylists,
    deletePlaylist,
    syncPlaylist,
    playPlaylist,
  } = usePlaylists();

  const [view, setView] = useState<View>("collections");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      fetchFavorites();
      fetchPlaylists();
    }
  }, [isLoggedIn, fetchFavorites, fetchPlaylists]);

  // 获取前4个封面作为马赛克
  const getMosaicCovers = (songs: { coverUrl?: string | null }[]) => {
    const covers = songs.filter(s => s.coverUrl).slice(0, 4).map(s => s.coverUrl!);
    while (covers.length < 4) covers.push("");
    return covers;
  };

  const likedCovers = getMosaicCovers(favorites);
  const playlistCovers = getMosaicCovers(
    playlists.map(pl => ({ coverUrl: pl.coverUrl })).filter(Boolean)
  );

  // 如果未登录，显示登录提示
  if (!isLoading && !isLoggedIn) {
    return (
      <div className="h-full overflow-y-auto" style={{ background: "#121212" }}>
        <div className="max-w-[1400px] mx-auto px-8 py-8">
          {/* 标题 */}
          <h1
            className="text-3xl font-normal mb-8 tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: isLight ? "#1a1d26" : "var(--text-primary)" }}
          >
            {t("playlists.title")}
          </h1>

          {/* 登录提示 */}
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-blue-400"
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
            <h3 className="text-lg font-semibold mb-2" style={{ color: isLight ? "#1a1d26" : "var(--text-primary)" }}>
              登录后查看完整歌单
            </h3>
            <p className="text-sm mb-6" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }}>
              登录网易云音乐，解锁你的专属歌单
            </p>
            <button
              onClick={showLoginModal}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2.5 rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              立即登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#121212" }}>
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <AnimatePresence mode="wait">
          {view === "collections" ? (
            <motion.div
              key="collections"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* 标题 */}
              <h1
                className="text-3xl font-normal mb-8 tracking-tight"
                style={{ fontFamily: "var(--font-display)", color: isLight ? "#1a1d26" : "var(--text-primary)" }}
              >
                {t("playlists.title")}
              </h1>

              {/* 合集网格 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {/* 我喜欢的音乐 */}
                <CollectionCard
                  title={t("playlists.liked")}
                  count={favorites.length}
                  covers={likedCovers}
                  gradient="from-pink-500/30 to-purple-500/30"
                  icon={<Heart className="w-8 h-8 text-white/80 fill-current" />}
                  onClick={() => router.push("/favorites")}
                  isLight={isLight}
                />

                {/* 导入歌单 */}
                <CollectionCard
                  title={t("playlists.imported")}
                  count={playlists.length}
                  covers={playlistCovers}
                  gradient="from-accent/30 to-blue-500/30"
                  icon={<ListMusic className="w-8 h-8 text-white/80" />}
                  onClick={() => setView("imported")}
                  isLight={isLight}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="imported"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* 返回 + 标题 */}
              <div className="flex items-center gap-3 mb-8">
                <motion.button
                  onClick={() => setView("collections")}
                  className="p-2 rounded-xl hover:bg-surface-elevated transition-colors"
                  style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
                <h1
                  className="text-3xl font-normal tracking-tight"
                  style={{ fontFamily: "var(--font-display)", color: isLight ? "#1a1d26" : "var(--text-primary)" }}
                >
                  {t("playlists.imported")}
                </h1>
                <button
                  onClick={() => setModalOpen(true)}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-accent text-text-on-accent hover:bg-accent-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t("settings.importPlaylist")}
                </button>
              </div>

              {/* 歌单列表 */}
              {playlistsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }} />
                </div>
              ) : playlists.length === 0 ? (
                <div className="text-center py-16" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }}>
                  <Music className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg mb-2">{t("settings.noPlaylists")}</p>
                  <p className="text-sm">{t("settings.noPlaylistsHint")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  {playlists.map((pl, i) => (
                    <motion.div
                      key={pl.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      className="group cursor-pointer"
                      onClick={() => router.push(`/playlists/${pl.id}`)}
                    >
                      {/* 封面卡片 */}
                      <div
                        className="aspect-square rounded-2xl overflow-hidden relative mb-3"
                        style={{
                          background: "color-mix(in srgb, var(--surface-elevated) 80%, transparent)",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                        }}
                      >
                        {pl.coverUrl ? (
                          <img
                            src={pl.coverUrl}
                            alt={pl.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
                            <Music className="w-10 h-10 text-text-muted opacity-40" />
                          </div>
                        )}

                        {/* Hover 播放按钮 */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <motion.div
                            className="w-12 h-12 rounded-full bg-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              playPlaylist(pl.id);
                            }}
                          >
                            <Play className="w-5 h-5 text-text-on-accent ml-0.5" />
                          </motion.div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              syncPlaylist(pl.id);
                            }}
                            disabled={syncLoading[pl.id] || !pl.neteaseId}
                            className="p-1.5 rounded-lg bg-black/40 backdrop-blur text-white/80 hover:text-white disabled:opacity-40"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${syncLoading[pl.id] ? "animate-spin" : ""}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(t("playlists.deleteConfirm"))) {
                                deletePlaylist(pl.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-black/40 backdrop-blur text-white/80 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 歌单信息 */}
                      <h3 className="text-sm font-medium truncate group-hover:text-accent transition-colors" style={{ color: isLight ? "#1a1d26" : "var(--text-primary)" }}>
                        {pl.name}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }}>
                        {pl.songCount} {t("playlists.songCount")}
                        {syncResults[pl.id] && (syncResults[pl.id]!.added > 0 || syncResults[pl.id]!.removed > 0) && (
                          <span className="text-accent ml-2">
                            +{syncResults[pl.id]!.added} -{syncResults[pl.id]!.removed}
                          </span>
                        )}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <ImportPlaylistModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      </div>
    </div>
  );
}

// 合集卡片组件
function CollectionCard({
  title,
  count,
  covers,
  gradient,
  icon,
  onClick,
  isLight,
}: {
  title: string;
  count: number;
  covers: string[];
  gradient: string;
  icon: React.ReactNode;
  onClick: () => void;
  isLight?: boolean;
}) {
  const { lang } = useTranslation();
  return (
    <motion.div
      className="group cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        className="aspect-square rounded-2xl overflow-hidden relative mb-3"
        style={{
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}
      >
        {/* 马赛克封面 */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {covers.map((cover, i) => (
            <div key={i} className="overflow-hidden">
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  style={{ transitionDelay: `${i * 50}ms` }}
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradient}`} />
              )}
            </div>
          ))}
        </div>

        {/* 渐变遮罩 */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60`} />

        {/* 图标 */}
        <div className="absolute inset-0 flex items-center justify-center">
          {icon}
        </div>

        {/* Hover 效果 */}
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
      </div>

      {/* 文字信息 */}
      <h3 className="text-sm font-medium group-hover:text-accent transition-colors" style={{ color: isLight ? "#1a1d26" : "var(--text-primary)" }}>
        {title}
      </h3>
      <p className="text-xs mt-0.5" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }}>
        {count} {lang === "en" ? "songs" : "首歌"}
      </p>
    </motion.div>
  );
}
