"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaylists, ImportablePlaylist } from "@/hooks/usePlaylists";
import { usePlayer } from "@/hooks/usePlayer";
import { useFavorites } from "@/hooks/useFavorites";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthContext } from "@/app/components/auth/AuthProvider";
import { Play, ArrowRight, Disc3, Radio, Clock, Shuffle, ListMusic, ArrowLeft, Music, Heart, ChevronRight, RefreshCw, Trash2, Loader2, Link, Check, Settings, Globe, MessageCircle, Volume2, Zap, Sparkles, Info, Calendar, Search } from "lucide-react";
import NeteaseQrLogin from "@/app/components/settings/NeteaseQrLogin";
import UserProfileCard from "@/app/components/settings/UserProfileCard";

interface MusicHallProps {
  onEnterPlayer: () => void;
  onStartPlay?: () => Promise<void>;
}

export function MusicHall({ onEnterPlayer, onStartPlay }: MusicHallProps) {
  const router = useRouter();
  const { isLoggedIn } = useAuthContext();
  const { playlists } = usePlaylists();
  const { playSong, playHistory, currentSong } = usePlayer();
  const { favorites, fetchFavorites } = useFavorites();
  const {
    playlists: userPlaylists,
    isLoading: playlistsLoading,
    syncLoading,
    syncResults,
    fetchPlaylists,
    deletePlaylist,
    syncPlaylist,
    playPlaylist,
    importFromNetease,
  } = usePlaylists();

  // 查看歌单详情
  const handleViewPlaylist = (playlistId: string) => {
    router.push(`/playlists/${playlistId}`);
  };

  const {
    theme,
    language,
    isLoading: themeLoading,
    setTheme,
    setLanguage,
    fetchSettings,
    saveSettings,
    narrationEnabled,
    setNarrationEnabled,
    autoPlay,
    setAutoPlay,
    quickSwitch,
    setQuickSwitch,
    dynamicBg,
    setDynamicBg,
  } = useTheme();

  const { t } = useTranslation();
  const skipSave = useRef(true);

  const [showLibrary, setShowLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayHistory, setShowPlayHistory] = useState(false);
  const [showMoodRadio, setShowMoodRadio] = useState(false);
  const [libraryView, setLibraryView] = useState<"main" | "liked" | "imported" | "import">("main");
  const [todayStats, setTodayStats] = useState<{ songCount: number; streak: number } | null>(null);

  // 导入歌单相关状态
  const [importTab, setImportTab] = useState<"link" | "mine">("link");
  const [neteaseUrl, setNeteaseUrl] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [neteasePlaylists, setNeteasePlaylists] = useState<ImportablePlaylist[]>([]);
  const [fetchingNetease, setFetchingNetease] = useState(false);
  const [selectedNetease, setSelectedNetease] = useState<Set<number>>(new Set());
  const [needsLogin, setNeedsLogin] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [playlistSearch, setPlaylistSearch] = useState("");

  // 搜索过滤歌单
  const filteredPlaylists = playlistSearch.trim()
    ? neteasePlaylists.filter((pl) =>
        pl.name.toLowerCase().includes(playlistSearch.trim().toLowerCase())
      )
    : neteasePlaylists;

  useEffect(() => {
    setMounted(true);
    if (isLoggedIn) {
      fetchFavorites();
      fetchPlaylists();
      fetchSettings();
      // 获取今日日历统计（需要登录）
      const today = new Date().toISOString().slice(0, 10);
      fetch(`/api/calendar/day?date=${today}`)
        .then((r) => r.json())
        .then((data) => {
          setTodayStats({ songCount: data.songCount || 0, streak: 0 });
        })
        .catch(() => {});
    }
  }, [isLoggedIn, fetchFavorites, fetchPlaylists, fetchSettings]);

  // 跳过 fetchSettings 触发的首次 save
  useEffect(() => {
    const timer = setTimeout(() => { skipSave.current = false; }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // 防抖保存设置（500ms）
  useEffect(() => {
    if (skipSave.current) return;
    const timer = setTimeout(() => {
      saveSettings();
    }, 500);
    return () => clearTimeout(timer);
  }, [theme, language, narrationEnabled, autoPlay, quickSwitch, dynamicBg, saveSettings]);

  const getMosaicCovers = (songs: { coverUrl?: string | null }[]) => {
    const covers = songs.filter(s => s.coverUrl).slice(0, 4).map(s => s.coverUrl!);
    while (covers.length < 4) covers.push("");
    return covers;
  };

  // 获取我的网易云歌单
  const handleFetchNetease = async () => {
    setFetchingNetease(true);
    setNeedsLogin(false);
    try {
      const res = await fetch("/api/user/playlists/netease-mine");
      if (res.status === 401) {
        setNeedsLogin(true);
        setNeteasePlaylists([]);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setNeteasePlaylists(data.playlists || []);
        setNeedsLogin(false);
      }
    } catch {
      setNeteasePlaylists([]);
    } finally {
      setFetchingNetease(false);
    }
  };

  // 登录成功后自动加载歌单
  const handleLoginSuccess = () => {
    setTimeout(() => handleFetchNetease(), 500);
  };

  // 通过链接导入
  const handleImportFromUrl = async () => {
    setImportError("");
    if (!neteaseUrl.trim()) {
      setImportError("请输入歌单链接或 ID");
      return;
    }
    let playlistId = neteaseUrl.trim();
    const urlMatch = playlistId.match(/playlist[?&]id=(\d+)/);
    if (urlMatch) playlistId = urlMatch[1];
    if (!/^\d+$/.test(playlistId)) {
      setImportError("无效的链接或 ID，请检查后重试");
      return;
    }
    setImporting(true);
    try {
      await importFromNetease(playlistId);
      setNeteaseUrl("");
      setLibraryView("imported");
      fetchPlaylists();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "导入失败，请重试");
    } finally {
      setImporting(false);
    }
  };

  // 选择导入我的歌单
  const handleImportSelected = async () => {
    if (selectedNetease.size === 0) return;
    setImporting(true);
    setImportError("");
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    for (const id of selectedNetease) {
      try {
        await importFromNetease(id.toString());
        imported++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("already imported") || msg.includes("409")) {
          skipped++;
        } else {
          failed++;
        }
      }
    }
    setSelectedNetease(new Set());
    setImporting(false);
    if (imported > 0) {
      setLibraryView("imported");
      fetchPlaylists();
    }
    if (failed > 0 && imported === 0) {
      setImportError("导入失败，请重试");
    }
  };

  const toggleNeteaseSelect = (id: number) => {
    setSelectedNetease(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const likedCovers = getMosaicCovers(favorites);
  const playlistCovers = getMosaicCovers(
    userPlaylists.map(pl => ({ coverUrl: pl.coverUrl })).filter(Boolean)
  );

  const features = [
    { id: "daily", number: "01", label: "DAILY", title: "每日推荐", description: "让今天从一首新歌开始", icon: Radio,
      gradient: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
      glow: "rgba(124, 58, 237, 0.3)",
      action: () => router.push("/recommend/daily") },
    { id: "calendar", number: "02", label: "CALENDAR", title: "音乐日历", description: "记录每一天的声音轨迹", icon: Calendar,
      gradient: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
      glow: "rgba(16, 185, 129, 0.3)",
      subtitle: todayStats && todayStats.songCount > 0 ? `今天听了 ${todayStats.songCount} 首歌` : "记录你的音乐足迹",
      action: () => router.push("/calendar") },
    { id: "mood", number: "03", label: "MOOD", title: "心情电台", description: "让情绪决定下一首歌", icon: Disc3,
      gradient: "linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)",
      glow: "rgba(244, 63, 94, 0.3)",
      action: () => setShowMoodRadio(true) },
    { id: "settings", number: "04", label: "SETTINGS", title: "设置", description: "调整属于你的聆听方式", icon: Settings,
      gradient: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
      glow: "rgba(59, 130, 246, 0.3)",
      action: () => setShowSettings(true) },
  ];

  // 设置视图 - 重新设计，与音乐大厅风格一致
  if (showSettings) {
    const languageOptions = [
      { value: "zh" as const, label: "中文", flag: "🇨🇳" },
      { value: "en" as const, label: "English", flag: "🇺🇸" },
    ];

    return (
      <div className="h-full overflow-y-auto" style={{ background: "#121212" }}>
        <div className="max-w-[1400px] mx-auto px-8 py-8">
          {/* 返回 + 标题 */}
          <div className="flex items-center gap-3 mb-8">
            <motion.button
              onClick={() => setShowSettings(false)}
              className="p-2 rounded-full transition-colors"
              style={{ background: "#282828", color: "#ffffff" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "#b3b3b3" }}>SETTINGS</p>
              <h1 className="text-2xl font-bold" style={{ color: "#ffffff" }}>{t("settings.title")}</h1>
            </div>
          </div>

          {/* 用户资料卡和统计 - 并排布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* 用户资料卡 */}
            <motion.div
              className="rounded-2xl p-6"
              style={{ background: "#181818" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <UserProfileCard />
            </motion.div>

            {/* 用户统计卡片 */}
            <motion.div
              className="rounded-2xl p-6"
              style={{ background: "#181818" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)" }}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: "#ffffff" }}>我的数据</h3>
                  <p className="text-xs" style={{ color: "#b3b3b3" }}>使用统计</p>
                </div>
              </div>

              {/* 四方格统计 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 听歌时长 */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: "#282828", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)" }}>
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium" style={{ color: "#b3b3b3" }}>听歌时长</span>
                  </div>
                  <p className="text-xl font-bold" style={{ color: "#ffffff" }}>20小时45分</p>
                  <p className="text-xs mt-1" style={{ color: "#666" }}>1245 分钟</p>
                </div>

                {/* 听歌数量 */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: "#282828", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1ed760 0%, #1db954 100%)" }}>
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium" style={{ color: "#b3b3b3" }}>听过歌曲</span>
                  </div>
                  <p className="text-xl font-bold" style={{ color: "#ffffff" }}>86 首</p>
                  <p className="text-xs mt-1" style={{ color: "#666" }}>完整听完95%</p>
                </div>

                {/* AI互动 */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: "#282828", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)" }}>
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium" style={{ color: "#b3b3b3" }}>AI对话</span>
                  </div>
                  <p className="text-xl font-bold" style={{ color: "#ffffff" }}>23 次</p>
                  <p className="text-xs mt-1" style={{ color: "#666" }}>与Claudio交流</p>
                </div>

                {/* K歌次数 */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: "#282828", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)" }}>
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium" style={{ color: "#b3b3b3" }}>K歌次数</span>
                  </div>
                  <p className="text-xl font-bold" style={{ color: "#ffffff" }}>8 次</p>
                  <p className="text-xs mt-1" style={{ color: "#666" }}>演唱会模式演唱</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 设置卡片 - 2列布局 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* 播放设置（合并 AI 旁白） */}
            <motion.div
              className="rounded-2xl p-5"
              style={{ background: "#181818" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)" }}>
                  <Volume2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: "#ffffff" }}>{t("settings.playback")}</h3>
                  <p className="text-xs" style={{ color: "#b3b3b3" }}>播放与控制</p>
                </div>
              </div>
              <div className="space-y-3">
                <ToggleItem
                  icon={<Play className="w-4 h-4" />}
                  label={t("settings.autoPlay")}
                  desc={t("settings.autoPlayDesc")}
                  checked={autoPlay}
                  onChange={() => setAutoPlay(!autoPlay)}
                />
                <ToggleItem
                  icon={<Zap className="w-4 h-4" />}
                  label={t("settings.quickSwitch")}
                  desc={t("settings.quickSwitchDesc")}
                  checked={quickSwitch}
                  onChange={() => setQuickSwitch(!quickSwitch)}
                />
                <ToggleItem
                  icon={<Sparkles className="w-4 h-4" />}
                  label={t("settings.dynamicBg")}
                  desc={t("settings.dynamicBgDesc")}
                  checked={dynamicBg}
                  onChange={() => setDynamicBg(!dynamicBg)}
                />
                {/* AI 旁白合并到播放设置 */}
                <div className="border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <ToggleItem
                    icon={<MessageCircle className="w-4 h-4" />}
                    label={t("settings.narrationToggle")}
                    desc={t("settings.narrationDesc")}
                    checked={narrationEnabled}
                    onChange={() => setNarrationEnabled(!narrationEnabled)}
                  />
                </div>
              </div>
            </motion.div>

            {/* 显示设置 + 语言 */}
            <motion.div
              className="rounded-2xl p-5"
              style={{ background: "#181818" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)" }}>
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: "#ffffff" }}>{t("settings.display")}</h3>
                  <p className="text-xs" style={{ color: "#b3b3b3" }}>语言设置</p>
                </div>
              </div>
              <div className="space-y-4">
                {/* 语言 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4" style={{ color: "#b3b3b3" }} />
                    <p className="text-xs font-medium" style={{ color: "#b3b3b3" }}>{t("settings.language")}</p>
                  </div>
                  <div className="flex gap-2">
                    {languageOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setLanguage(opt.value)}
                        className="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all"
                        style={{
                          background: language === opt.value ? "#1ed760" : "#282828",
                          color: language === opt.value ? "#000000" : "#ffffff",
                        }}
                      >
                        {opt.flag} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 关于 - 紧凑底部条 */}
          <motion.div
            className="flex items-center justify-center gap-2.5 py-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1ed760 0%, #1db954 100%)" }}>
              <Music className="w-3.5 h-3.5 text-black/30" />
            </div>
            <span className="text-xs font-medium" style={{ color: "#b3b3b3" }}>Claudio v1.0.0</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
            <span className="text-xs" style={{ color: "#666" }}>{t("settings.tagline1")}</span>
          </motion.div>
        </div>
      </div>
    );
  }

  // 歌单展开视图 - 紧凑列表风格
  if (showLibrary) {
    // 导入歌单子视图
    if (libraryView === "import") {
      return (
        <div className="h-full overflow-y-auto" style={{ background: "#121212" }}>
          <div className="max-w-[1400px] mx-auto px-8 py-8">
            <div className="flex items-center gap-3 mb-5">
              <motion.button
                onClick={() => setLibraryView("main")}
                className="p-2 rounded-full transition-colors"
                style={{ background: "#282828", color: "#ffffff" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-4 h-4" />
              </motion.button>
              <h1 className="text-xl font-bold" style={{ color: "#ffffff" }}>导入歌单</h1>
            </div>

            <div className="max-w-4xl mx-auto">
              {/* Tab 切换 */}
              <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: "#181818" }}>
                <button
                  onClick={() => { setImportTab("link"); setImportError(""); }}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: importTab === "link" ? "#282828" : "transparent",
                    color: importTab === "link" ? "#ffffff" : "#b3b3b3",
                  }}
                >
                  <Link className="w-4 h-4 inline-block mr-1.5" />
                  链接导入
                </button>
                <button
                  onClick={() => { setImportTab("mine"); setImportError(""); handleFetchNetease(); }}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: importTab === "mine" ? "#282828" : "transparent",
                    color: importTab === "mine" ? "#ffffff" : "#b3b3b3",
                  }}
                >
                  <Music className="w-4 h-4 inline-block mr-1.5" />
                  我的歌单
                </button>
              </div>

              {importTab === "link" ? (
                <>
                  {/* 链接导入 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2" style={{ color: "#b3b3b3" }}>
                      粘贴网易云音乐歌单链接
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={neteaseUrl}
                        onChange={(e) => { setNeteaseUrl(e.target.value); setImportError(""); }}
                        placeholder="https://music.163.com/#/playlist?id=..."
                        className="w-full px-4 py-3 pr-10 rounded-xl border focus:outline-none focus:ring-1"
                        style={{
                          background: "#181818",
                          borderColor: "#333",
                          color: "#ffffff",
                        }}
                      />
                      <Link className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#666" }} />
                    </div>
                  </div>

                  {importError && (
                    <p className="text-sm mb-4" style={{ color: "#f43f5e" }}>{importError}</p>
                  )}

                  <button
                    onClick={handleImportFromUrl}
                    disabled={!neteaseUrl.trim() || importing}
                    className="w-full py-3 rounded-xl font-medium transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: "#1ed760", color: "#000000" }}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        导入中...
                      </>
                    ) : (
                      "导入歌单"
                    )}
                  </button>

                  <div className="mt-4 p-4 rounded-xl" style={{ background: "#181818" }}>
                    <p className="text-xs" style={{ color: "#666" }}>支持的链接格式：</p>
                    <ul className="text-xs mt-2 space-y-1" style={{ color: "#555" }}>
                      <li>• https://music.163.com/#/playlist?id=123456</li>
                      <li>• https://music.163.com/playlist?id=123456</li>
                      <li>• 直接输入歌单 ID：123456</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  {/* 我的网易云歌单 */}
                  {fetchingNetease ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#b3b3b3" }} />
                    </div>
                  ) : neteasePlaylists.length > 0 ? (
                    <>
                      {/* 固定在顶部：搜索 + 导入按钮 */}
                      <div className="sticky top-0 z-10 pb-3 space-y-2" style={{ background: "#121212" }}>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#666" }} />
                          <input
                            type="text"
                            value={playlistSearch}
                            onChange={(e) => setPlaylistSearch(e.target.value)}
                            placeholder="搜索歌单..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-1 text-sm"
                            style={{
                              background: "#181818",
                              borderColor: "#333",
                              color: "#ffffff",
                            }}
                          />
                        </div>
                        <button
                          onClick={handleImportSelected}
                          disabled={selectedNetease.size === 0 || importing}
                          className="w-full py-3 rounded-xl font-medium transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          style={{ background: "#1ed760", color: "#000000" }}
                        >
                          {importing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              导入中...
                            </>
                          ) : (
                            `导入选中的歌单${selectedNetease.size > 0 ? ` (${selectedNetease.size})` : ""}`
                          )}
                        </button>
                        {importError && (
                          <p className="text-sm text-center" style={{ color: "#f43f5e" }}>{importError}</p>
                        )}
                      </div>

                      {/* 歌单网格 */}
                      <div className="grid grid-cols-2 gap-2">
                        {filteredPlaylists.map((pl) => (
                          <button
                            key={pl.playlistId}
                            disabled={pl.imported}
                            onClick={() => !pl.imported && toggleNeteaseSelect(pl.playlistId)}
                            className="flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left"
                            style={{
                              background: "#181818",
                              borderColor: pl.imported ? "#333" : selectedNetease.has(pl.playlistId) ? "#1ed760" : "#282828",
                              opacity: pl.imported ? 0.5 : 1,
                              cursor: pl.imported ? "not-allowed" : "pointer",
                            }}
                          >
                            <div
                              className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0"
                              style={{
                                borderColor: pl.imported ? "#555" : selectedNetease.has(pl.playlistId) ? "#1ed760" : "#555",
                                background: pl.imported ? "#333" : selectedNetease.has(pl.playlistId) ? "#1ed760" : "transparent",
                              }}
                            >
                              {(pl.imported || selectedNetease.has(pl.playlistId)) && (
                                <Check className="w-3 h-3" style={{ color: pl.imported ? "#666" : "#000" }} />
                              )}
                            </div>
                            {pl.coverUrl && (
                              <img src={pl.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: "#ffffff" }}>{pl.name}</p>
                              <p className="text-xs" style={{ color: "#b3b3b3" }}>
                                {pl.trackCount} 首
                                {pl.creator && ` · ${pl.creator}`}
                                {pl.imported && " · 已导入"}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                      {playlistSearch && filteredPlaylists.length === 0 && (
                        <p className="text-sm text-center py-8" style={{ color: "#666" }}>
                          没有找到匹配的歌单
                        </p>
                      )}
                    </>
                  ) : needsLogin ? (
                    <div className="py-6">
                      <p className="text-sm text-center mb-4" style={{ color: "#b3b3b3" }}>
                        登录网易云音乐后可选择歌单导入
                      </p>
                      <NeteaseQrLogin onLoginSuccess={handleLoginSuccess} />
                    </div>
                  ) : (
                    <div className="text-center py-12" style={{ color: "#b3b3b3" }}>
                      <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">暂无歌单数据</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 喜欢的音乐子视图
    if (libraryView === "liked") {
      return (
        <div className="h-full overflow-y-auto" style={{ background: "#121212" }}>
          <div className="max-w-[1400px] mx-auto px-8 py-8">
            <div className="flex items-center gap-3 mb-5">
              <motion.button
                onClick={() => setLibraryView("main")}
                className="p-2 rounded-full transition-colors"
                style={{ background: "#282828", color: "#ffffff" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-4 h-4" />
              </motion.button>
              <h1 className="text-xl font-bold" style={{ color: "#ffffff" }}>我喜欢的音乐</h1>
              <span className="text-sm" style={{ color: "#b3b3b3" }}>({favorites.length} 首)</span>
            </div>

            {favorites.length > 0 ? (
              <div className="space-y-2">
                {favorites.map((song, i) => (
                  <motion.div
                    key={song.id}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer group transition-colors"
                    style={{ background: "#181818" }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    whileHover={{ backgroundColor: "#282828" }}
                    onClick={() => { playSong(song); onEnterPlayer(); }}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#ffffff" }}>{song.title}</p>
                      <p className="text-xs truncate" style={{ color: "#b3b3b3" }}>{song.artist}</p>
                    </div>
                    <Play className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#b3b3b3" }} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12" style={{ color: "#b3b3b3" }}>
                <Heart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">还没有喜欢的音乐</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 导入歌单子视图
    if (libraryView === "imported") {
      return (
        <div className="h-full overflow-y-auto" style={{ background: "#121212" }}>
          <div className="max-w-[1400px] mx-auto px-8 py-8">
            <div className="flex items-center gap-3 mb-5">
              <motion.button
                onClick={() => setLibraryView("main")}
                className="p-2 rounded-full transition-colors"
                style={{ background: "#282828", color: "#ffffff" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-4 h-4" />
              </motion.button>
              <h1 className="text-xl font-bold" style={{ color: "#ffffff" }}>导入歌单</h1>
              <span className="text-sm" style={{ color: "#b3b3b3" }}>({userPlaylists.length} 个)</span>
            </div>

            {playlistsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#b3b3b3" }} />
              </div>
            ) : userPlaylists.length > 0 ? (
              <div className="grid grid-cols-5 gap-3">
                {userPlaylists.map((pl, i) => (
                  <motion.div
                    key={pl.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="group cursor-pointer"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden relative mb-2" style={{ background: "#282828" }}>
                      {pl.coverUrl ? (
                        <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: "#333" }}>
                          <Music className="w-5 h-5 opacity-40" style={{ color: "#b3b3b3" }} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <motion.button
                          className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          style={{ background: "#1ed760" }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => { e.stopPropagation(); playPlaylist(pl.id); }}
                        >
                          <Play className="w-3.5 h-3.5 ml-0.5" style={{ color: "#000000" }} />
                        </motion.button>
                      </div>
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); syncPlaylist(pl.id); }}
                          disabled={syncLoading[pl.id] || !pl.neteaseId}
                          className="p-1 rounded bg-black/60 text-white/80 hover:text-white disabled:opacity-40"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${syncLoading[pl.id] ? "animate-spin" : ""}`} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm("确定删除？")) deletePlaylist(pl.id); }}
                          className="p-1 rounded bg-black/60 text-white/80 hover:text-red-400"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-xs font-medium truncate" style={{ color: "#ffffff" }}>{pl.name}</h3>
                    <p className="text-[10px]" style={{ color: "#b3b3b3" }}>
                      {pl.songCount} 首
                      {syncResults[pl.id] && (syncResults[pl.id]!.added > 0 || syncResults[pl.id]!.removed > 0) && (
                        <span className="ml-1" style={{ color: "#1ed760" }}>+{syncResults[pl.id]!.added}</span>
                      )}
                    </p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12" style={{ color: "#b3b3b3" }}>
                <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无导入歌单</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 主歌单视图
    return (
      <div className="h-full overflow-y-auto" style={{ background: "#121212" }}>
        <div className="max-w-[1400px] mx-auto px-8 py-8">
          {/* 返回 + 标题 */}
          <div className="flex items-center gap-3 mb-5">
            <motion.button
              onClick={() => setShowLibrary(false)}
              className="p-2 rounded-full transition-colors"
              style={{ background: "#282828", color: "#ffffff" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>
            <h1 className="text-xl font-bold" style={{ color: "#ffffff" }}>我的歌单</h1>
          </div>

          {/* 合集卡片 - 紧凑横条 */}
          <div className="flex gap-3 mb-5">
            {/* 喜欢的音乐 */}
            <motion.div
              className="flex-1 rounded-xl p-3 flex items-center gap-3 cursor-pointer group"
              style={{ background: "#181818" }}
              whileHover={{ scale: 1.01 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setLibraryView("liked")}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                  {likedCovers.map((cover, i) => (
                    <div key={i} className="overflow-hidden">
                      {cover ? (
                        <img src={cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-pink-500/40 to-purple-500/40" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/40 to-purple-500/40 flex items-center justify-center">
                  <Heart className="w-3 h-3 text-white fill-current" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold truncate" style={{ color: "#ffffff" }}>我喜欢的音乐</h3>
                <p className="text-xs" style={{ color: "#b3b3b3" }}>{favorites.length} 首</p>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#b3b3b3" }} />
            </motion.div>

            {/* 导入歌单 */}
            <motion.div
              className="flex-1 rounded-xl p-3 flex items-center gap-3 cursor-pointer group"
              style={{ background: "#181818" }}
              whileHover={{ scale: 1.01 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              onClick={() => setLibraryView("import")}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                  {playlistCovers.map((cover, i) => (
                    <div key={i} className="overflow-hidden">
                      {cover ? (
                        <img src={cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-green-500/40 to-blue-500/40" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/40 to-blue-500/40 flex items-center justify-center">
                  <ListMusic className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold truncate" style={{ color: "#ffffff" }}>导入歌单</h3>
                <p className="text-xs" style={{ color: "#b3b3b3" }}>{userPlaylists.length} 个</p>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#b3b3b3" }} />
            </motion.div>
          </div>

          {/* 歌单列表 - 紧凑网格 */}
          {playlistsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#b3b3b3" }} />
            </div>
          ) : userPlaylists.length > 0 ? (
            <div className="grid grid-cols-5 gap-3">
              {userPlaylists.map((pl, i) => (
                <motion.div
                  key={pl.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="group cursor-pointer"
                  onClick={() => handleViewPlaylist(pl.id)}
                >
                  <div className="aspect-square rounded-lg overflow-hidden relative mb-2" style={{ background: "#282828" }}>
                    {pl.coverUrl ? (
                      <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: "#333" }}>
                        <Music className="w-5 h-5 opacity-40" style={{ color: "#b3b3b3" }} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <motion.button
                        className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        style={{ background: "#1ed760" }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => { e.stopPropagation(); playPlaylist(pl.id); }}
                      >
                        <Play className="w-3.5 h-3.5 ml-0.5" style={{ color: "#000000" }} />
                      </motion.button>
                    </div>
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); syncPlaylist(pl.id); }}
                        disabled={syncLoading[pl.id] || !pl.neteaseId}
                        className="p-1 rounded bg-black/60 text-white/80 hover:text-white disabled:opacity-40"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${syncLoading[pl.id] ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm("确定删除？")) deletePlaylist(pl.id); }}
                        className="p-1 rounded bg-black/60 text-white/80 hover:text-red-400"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-xs font-medium truncate" style={{ color: "#ffffff" }}>{pl.name}</h3>
                  <p className="text-[10px]" style={{ color: "#b3b3b3" }}>
                    {pl.songCount} 首
                    {syncResults[pl.id] && (syncResults[pl.id]!.added > 0 || syncResults[pl.id]!.removed > 0) && (
                      <span className="ml-1" style={{ color: "#1ed760" }}>+{syncResults[pl.id]!.added}</span>
                    )}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: "#b3b3b3" }}>
              <Music className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无歌单</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 接着听全屏视图
  if (showPlayHistory) {
    return (
      <div className="h-full overflow-y-auto" style={{ background: "#121212" }}>
        <div className="max-w-[1400px] mx-auto px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <motion.button
              onClick={() => setShowPlayHistory(false)}
              className="p-2 rounded-full transition-colors"
              style={{ background: "#282828", color: "#ffffff" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "#b3b3b3" }}>HISTORY</p>
              <h1 className="text-2xl font-bold" style={{ color: "#ffffff" }}>接着听</h1>
            </div>
            <span className="ml-2 text-sm" style={{ color: "#666" }}>{playHistory.length} 首</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {playHistory.map((song, index) => (
              <motion.button
                key={song.neteaseId}
                className="group text-left"
                onClick={() => { playSong(song); onEnterPlayer(); }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
              >
                <div className="aspect-square rounded-xl overflow-hidden mb-2 relative" style={{ background: "#181818" }}>
                  {song.coverUrl ? (
                    <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-8 h-8" style={{ color: "#333" }} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" style={{ background: "#1ed760" }}>
                      <Play className="w-5 h-5 ml-0.5 fill-current" style={{ color: "#000" }} />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium truncate" style={{ color: "#ffffff" }}>{song.title}</p>
                <p className="text-xs truncate" style={{ color: "#b3b3b3" }}>{song.artist}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 心情电台 - 施工中
  if (showMoodRadio) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: "#121212" }}>
        <motion.div
          className="flex flex-col items-center text-center px-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: "linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)" }}
          >
            <Disc3 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#ffffff" }}>心情电台</h1>
          <p className="text-sm mb-1" style={{ color: "#b3b3b3" }}>正在施工中，敬请期待</p>
          <p className="text-xs mb-8" style={{ color: "#555" }}>我们会尽快为你带来全新的心情电台体验</p>
          <motion.button
            onClick={() => setShowMoodRadio(false)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full transition-all"
            style={{ background: "#282828", color: "#b3b3b3" }}
            whileHover={{ scale: 1.05, color: "#ffffff" }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">返回</span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // 主界面
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#121212" }}>
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        {/* 顶部：当前播放 + 我的歌单 */}
        <div className="flex gap-6 mb-6">
          {/* 左侧：当前播放 */}
          <motion.div
            className="flex-[2] rounded-2xl p-6 flex flex-col items-center justify-center"
            style={{ background: "#181818" }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            {currentSong ? (
              <>
                <div className="w-48 h-48 rounded-xl overflow-hidden mb-6 shadow-2xl" style={{ background: "#282828" }}>
                  {currentSong.coverUrl ? (
                    <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Disc3 className="w-16 h-16" style={{ color: "#1ed760" }} />
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold mb-1" style={{ color: "#ffffff" }}>{currentSong.title}</h3>
                <p className="text-sm mb-6" style={{ color: "#b3b3b3" }}>{currentSong.artist}</p>
                <button
                  onClick={onEnterPlayer}
                  className="flex items-center gap-2 px-6 py-3 rounded-full transition-all hover:scale-105"
                  style={{ background: "#1ed760", color: "#000000" }}
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span className="text-sm font-semibold uppercase tracking-wider">继续播放</span>
                </button>
              </>
            ) : (
              <>
                <Disc3 className="w-24 h-24 mb-6" style={{ color: "#1ed760" }} />
                <h3 className="text-xl font-bold mb-2" style={{ color: "#ffffff" }}>Claudio</h3>
                <p className="text-sm mb-6" style={{ color: "#b3b3b3" }}>开始你的音乐旅程</p>
                <button
                  onClick={onStartPlay ?? onEnterPlayer}
                  className="flex items-center gap-2 px-6 py-3 rounded-full transition-all hover:scale-105"
                  style={{ background: "#1ed760", color: "#000000" }}
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span className="text-sm font-semibold uppercase tracking-wider">开始播放</span>
                </button>
              </>
            )}
          </motion.div>

          {/* 右侧：我的歌单 */}
          <motion.div
            className="flex-1 rounded-2xl p-6"
            style={{ background: "#181818" }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="mb-4">
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "#b3b3b3" }}>LIBRARY</p>
              <h2 className="text-2xl font-bold" style={{ color: "#ffffff" }}>我的歌单</h2>
            </div>
            <div className="w-full h-48 rounded-xl mb-4 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1ed760 0%, #1db954 100%)" }}>
              <ListMusic className="w-16 h-16 text-black/30" />
            </div>
            <p className="text-sm" style={{ color: "#b3b3b3" }}>打开你的私人收藏</p>
            <button
              onClick={() => setShowLibrary(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full transition-all hover:scale-105"
              style={{ background: "#1ed760", color: "#000000" }}
            >
              <span className="text-sm font-semibold uppercase tracking-wider">查看歌单</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>

        {/* 中部：功能卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {features.map((feature, index) => (
            <motion.button
              key={feature.id}
              aria-label={`打开${feature.title}`}
              className="group relative min-h-[clamp(148px,18vh,184px)] overflow-hidden rounded-[24px] p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
              style={{
                background: `linear-gradient(145deg, ${feature.glow} 0%, rgba(29,30,34,0.98) 44%, #151619 100%)`,
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 14px 34px rgba(0,0,0,0.24)",
              }}
              onClick={feature.action}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + index * 0.05 }}
              whileHover={{ y: -6, borderColor: "rgba(255,255,255,0.22)", boxShadow: `0 22px 44px ${feature.glow}` }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Chromatic Vinyl：唱片圆环与精确网格构图 */}
              <div
                className="absolute inset-0 opacity-[0.08]"
                style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
              />
              <div
                className="absolute -right-7 -bottom-9 h-32 w-32 rounded-full border border-white/15 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-12"
                style={{ boxShadow: `inset 0 0 0 20px ${feature.glow}, inset 0 0 0 21px rgba(255,255,255,.1)` }}
              />
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold tracking-[0.24em] uppercase text-white/60">{feature.label}</p>
                  <span className="font-mono text-[10px] tracking-widest text-white/35">{feature.number}</span>
                </div>

                <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] backdrop-blur-md transition-transform duration-300 group-hover:scale-110" style={{ boxShadow: `0 8px 20px ${feature.glow}` }}>
                  <feature.icon className="h-4 w-4 text-white" />
                </div>

                <div className="mt-auto max-w-[72%]">
                  <h3 className="text-[18px] font-semibold tracking-tight text-white">{feature.title}</h3>
                  <p className="mt-1 text-[11px] leading-4 text-white/55">
                    {"subtitle" in feature && feature.subtitle ? feature.subtitle : feature.description}
                  </p>
                </div>

                <div className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-[#18191c]/90 text-white shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:border-white group-hover:bg-white group-hover:text-black">
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* 底部：接着听 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold" style={{ color: "#ffffff" }}>接着听</h3>
            {isLoggedIn && mounted && playHistory.length > 0 && (
              <button onClick={() => setShowPlayHistory(true)} className="text-sm flex items-center gap-1 transition-colors hover:underline" style={{ color: "#b3b3b3" }}>
                查看全部
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          {isLoggedIn && mounted && playHistory.length > 0 ? (
            <div className="flex gap-4 overflow-hidden">
              {playHistory.map((song, index) => (
                <motion.button
                  key={song.neteaseId}
                  className="flex-shrink-0 w-28 group text-left"
                  onClick={() => { playSong(song); onEnterPlayer(); }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
                >
                  <div className="w-28 h-28 rounded-lg overflow-hidden mb-2 relative">
                    <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity fill-current" />
                    </div>
                  </div>
                  <p className="text-xs font-medium truncate" style={{ color: "#ffffff" }}>{song.title}</p>
                  <p className="text-[11px] truncate" style={{ color: "#b3b3b3" }}>{song.artist}</p>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 rounded-xl" style={{ background: "#181818" }}>
              <Music className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: "#b3b3b3" }} />
              <p className="text-sm" style={{ color: "#b3b3b3" }}>{isLoggedIn ? "播放歌曲后会显示在这里" : "登录后查看播放历史"}</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function ToggleItem({ icon, label, desc, checked, onChange }: { icon: React.ReactNode; label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <span style={{ color: "#b3b3b3" }}>{icon}</span>
        <div>
          <p className="text-sm" style={{ color: "#ffffff" }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: "#666" }}>{desc}</p>
        </div>
      </div>
      <button
        onClick={onChange}
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{ background: checked ? "#1ed760" : "#282828" }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}
