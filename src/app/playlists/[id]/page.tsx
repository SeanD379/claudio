"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePlayer, Song } from "@/hooks/usePlayer";
import {
  Play,
  Pause,
  Music,
  Loader2,
  ListMusic,
  MoreHorizontal,
  Clock3,
  ArrowLeft,
  Shuffle,
  Link,
  Check,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useTheme } from "@/hooks/useTheme";
import { extractColorsFromImage, type ExtractedColors } from "@/app/lib/colorExtractor";

interface PlaylistInfo {
  id: string;
  name: string;
  neteaseId: string | null;
  description: string | null;
  coverUrl: string | null;
}

const FALLBACK_COLORS: ExtractedColors = {
  primary: [20, 104, 62],
  secondary: [18, 72, 48],
  accent: [30, 215, 96],
};

const toRgba = ([red, green, blue]: [number, number, number], opacity: number) =>
  `rgba(${red}, ${green}, ${blue}, ${opacity})`;

export default function PlaylistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playlistId = params.id as string;

  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverPalette, setCoverPalette] = useState<{ url: string; colors: ExtractedColors } | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const {
    currentSong,
    isPlaying,
    isLoading: playerLoading,
    setAndPlay,
  } = usePlayer();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isLight = theme === "light";

  useEffect(() => {
    const fetchPlaylist = async () => {
      try {
        const res = await fetch(`/api/user/playlists/${playlistId}/songs`);
        if (res.ok) {
          const data = await res.json();
          setPlaylist(data.playlist);
          setSongs(data.songs);

          const songsNeedingCover = data.songs.filter(
            (s: Song) => !s.coverUrl && s.neteaseId
          );
          if (songsNeedingCover.length > 0) {
            const ids = songsNeedingCover
              .map((s: Song) => s.neteaseId)
              .join(",");
            const detailRes = await fetch(`/api/music/songs?ids=${ids}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              const coverMap = new Map(
                (detailData.songs || []).map((s: Song) => [
                  s.neteaseId,
                  s.coverUrl,
                ])
              );
              setSongs((prev) =>
                prev.map((s) => {
                  if (!s.coverUrl && coverMap.has(s.neteaseId)) {
                    return { ...s, coverUrl: coverMap.get(s.neteaseId) as string };
                  }
                  return s;
                })
              );
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch playlist:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylist();
  }, [playlistId]);

  useEffect(() => {
    let cancelled = false;

    if (!playlist?.coverUrl) {
      return;
    }

    const coverUrl = playlist.coverUrl;
    extractColorsFromImage(coverUrl).then((colors) => {
      if (!cancelled) setCoverPalette({ url: coverUrl, colors });
    });

    return () => {
      cancelled = true;
    };
  }, [playlist?.coverUrl]);

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    setAndPlay(songs, songs[0]);
  };

  const handleShufflePlay = () => {
    if (songs.length === 0) return;
    const shuffledSongs = [...songs].sort(() => Math.random() - 0.5);
    setAndPlay(shuffledSongs, shuffledSongs[0]);
    setIsMoreMenuOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch (error) {
      console.error("Failed to copy playlist link:", error);
    } finally {
      setIsMoreMenuOpen(false);
    }
  };

  const handlePlaySong = (song: Song) => {
    setAndPlay(songs, song);
  };

  const handleBackToPlaylists = () => {
    router.push("/?view=library");
  };

  const isCurrentSong = (song: Song) => {
    return currentSong?.neteaseId === song.neteaseId;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const totalDuration = songs.reduce((total, song) => total + (song.duration || 0), 0);
  const palette = coverPalette && coverPalette.url === playlist?.coverUrl
    ? coverPalette.colors
    : FALLBACK_COLORS;
  const pageBackground = `radial-gradient(circle at 82% 6%, ${toRgba(palette.primary, 0.34)} 0%, transparent 30%), radial-gradient(circle at 8% 30%, ${toRgba(palette.secondary, 0.22)} 0%, transparent 34%), radial-gradient(circle at 55% 100%, ${toRgba(palette.accent, 0.16)} 0%, transparent 42%), #0d1712`;
  const heroOverlay = `linear-gradient(180deg, ${toRgba(palette.primary, 0.18)} 0%, rgba(13,23,18,0.62) 56%, ${toRgba(palette.primary, 0.06)} 84%, transparent 100%)`;
  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}小时 ${minutes}分钟` : `${minutes}分钟`;
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }} />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="h-full overflow-y-auto flex flex-col items-center justify-center">
        <p className="mb-4" style={{ color: isLight ? "#6b7280" : "var(--text-secondary)" }}>{t("playlist.notFound")}</p>
        <button
          onClick={handleBackToPlaylists}
          className="px-4 py-2 rounded-lg bg-surface-elevated transition-colors"
          style={{ color: isLight ? "#6b7280" : "var(--text-secondary)" }}
        >
          {t("playlist.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-24 transition-[background] duration-700" style={{ background: pageBackground }}>
      <section className="relative isolate overflow-hidden">
        {playlist.coverUrl && (
          <img src={playlist.coverUrl} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover opacity-20 blur-3xl scale-125" />
        )}
        <div className="absolute inset-0 -z-10 transition-[background] duration-700" style={{ background: heroOverlay }} />
        <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-5 sm:px-8 sm:pb-14 sm:pt-7">
          <button onClick={handleBackToPlaylists} aria-label="返回歌单列表" className="group mb-8 flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/10 px-4 text-sm shadow-sm backdrop-blur-sm transition duration-200 hover:border-[#1ed760]/45 hover:bg-[#1ed760]/10 active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: "#d8e6dc" }}>
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" /> 返回歌单
          </button>
          <div className="grid items-end gap-8 md:grid-cols-[250px_minmax(0,1fr)] md:gap-12">
            {playlist.coverUrl ? (
              <img src={playlist.coverUrl} alt={`${playlist.name} cover`} className="h-[min(62vw,250px)] w-[min(62vw,250px)] rounded-2xl object-cover shadow-[0_24px_64px_rgba(0,0,0,.45)] ring-1 ring-white/10" />
            ) : (
              <div className="flex h-[min(62vw,250px)] w-[min(62vw,250px)] items-center justify-center rounded-2xl bg-[#16251d] text-[#5d7768]"><Music className="h-16 w-16" /></div>
            )}
            <div className="min-w-0" style={{ color: "#f1f7f2" }}>
              <p className="mb-3 text-xs font-medium tracking-[0.22em]" style={{ color: "#1ed760" }}>A PRIVATE LISTENING ROOM</p>
              <h1 className="max-w-3xl text-4xl font-normal leading-tight tracking-[-0.035em] sm:text-6xl" style={{ fontFamily: "var(--font-display)" }}>{playlist.name}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: "#a6b9ac" }}>
                <span>{songs.length} 首歌曲</span><span style={{ color: "#5d7768" }}>·</span><span>{formatTotalDuration(totalDuration)}</span>
              </div>
              <p className="mt-5 max-w-xl text-[15px] leading-6 line-clamp-2" style={{ color: "#a6b9ac" }}>{playlist.description || "收藏的歌曲与此刻的音乐灵感。"}</p>
              <div className="mt-5 flex items-center gap-3">
                <button onClick={handlePlayAll} disabled={songs.length === 0} className="flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-medium transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "#1ed760", color: "#07150c", boxShadow: "0 8px 28px rgba(30,215,96,.2)" }}><Play className="h-4 w-4 fill-current" /> {t("playlist.playAll")}</button>
                <div className="relative">
                  <button onClick={() => setIsMoreMenuOpen((open) => !open)} aria-label="更多歌单操作" aria-expanded={isMoreMenuOpen} aria-haspopup="menu" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/10 transition duration-200 hover:border-[#1ed760]/45 hover:bg-[#1ed760]/10 active:scale-[.96] focus-visible:outline focus-visible:outline-2" style={{ color: "#d8e6dc" }}><MoreHorizontal className="h-5 w-5" /></button>
                  {isMoreMenuOpen && (
                    <div role="menu" className="absolute bottom-full left-0 z-20 mb-2 w-48 rounded-2xl border border-white/10 bg-[#17251d]/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,.35)] backdrop-blur-xl sm:bottom-auto sm:left-full sm:ml-2 sm:mb-0 sm:top-0">
                      <button role="menuitem" onClick={handleShufflePlay} disabled={songs.length === 0} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50" style={{ color: "#f1f7f2" }}><Shuffle className="h-4 w-4" style={{ color: "#1ed760" }} /> 随机播放</button>
                      <button role="menuitem" onClick={handleCopyLink} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition hover:bg-white/10" style={{ color: "#f1f7f2" }}>{linkCopied ? <Check className="h-4 w-4" style={{ color: "#1ed760" }} /> : <Link className="h-4 w-4" style={{ color: "#1ed760" }} />}{linkCopied ? "链接已复制" : "复制歌单链接"}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="pointer-events-none relative z-10 -mt-7 h-14" style={{ background: `linear-gradient(180deg, ${toRgba(palette.primary, 0.18)} 0%, rgba(13,23,18,0.48) 44%, rgba(13,23,18,0) 100%)` }} />

      <main className="relative mx-auto max-w-[1200px] px-5 pb-7 pt-0 sm:px-8">
        {songs.length === 0 ? (
          <div className="py-16 text-center" style={{ color: "var(--text-muted)" }}><ListMusic className="mx-auto mb-3 h-12 w-12 opacity-40" /><p>{t("playlist.empty")}</p></div>
        ) : (
          <div>
            <div className="grid grid-cols-[38px_minmax(0,1fr)_minmax(120px,.42fr)_48px] items-center gap-3 border-b px-1 pb-3 text-xs font-medium sm:px-3" style={{ color: "#5d7768", borderColor: "rgba(241,247,242,.08)" }}><span className="text-center">#</span><span className="pl-11">歌曲</span><span className="hidden sm:block">专辑</span><Clock3 className="mx-auto h-4 w-4" aria-label="时长" /></div>
            <div className="mt-1">
              {songs.map((song, index) => {
                const isActive = isCurrentSong(song);
                const isThisPlaying = isActive && isPlaying;
                const isThisLoading = isActive && playerLoading;
                const isFeatured = isActive || index === 0;
                return (
                  <button key={song.id} onClick={() => handlePlaySong(song)} aria-label={`播放：${song.title} - ${song.artist}`} className={`group grid min-h-[60px] w-full grid-cols-[38px_minmax(0,1fr)_minmax(120px,.42fr)_48px] items-center gap-3 rounded-xl px-1 py-2 text-left transition duration-200 sm:px-3 ${isFeatured ? "bg-[#16251d]" : "hover:bg-[#132019]"}`}>
                    <span className="relative flex h-8 items-center justify-center" style={{ color: isActive ? "#1ed760" : "#5d7768" }}>{isThisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isThisPlaying ? <span className="flex h-4 w-4 items-end justify-center gap-0.5"><i className="h-2 w-0.5 animate-music-bar-1 bg-[#1ed760]" /><i className="h-3 w-0.5 animate-music-bar-2 bg-[#1ed760]" /><i className="h-1.5 w-0.5 animate-music-bar-3 bg-[#1ed760]" /></span> : isActive ? <Pause className="h-4 w-4" /> : <><span className="text-xs tabular-nums transition-opacity duration-150 group-hover:opacity-0">{index + 1}</span><Play className="absolute h-4 w-4 fill-current opacity-0 transition-opacity duration-150 group-hover:opacity-100" /></>}</span>
                    <span className="flex min-w-0 items-center gap-3"><span className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-[#16251d]">{song.coverUrl ? <img src={song.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Music className="m-2.5 h-5 w-5" style={{ color: "#5d7768" }} />}</span><span className="min-w-0"><span className="block truncate text-[15px] font-medium" style={{ color: isActive ? "#1ed760" : "#f1f7f2" }}>{song.title}</span><span className="mt-0.5 block truncate text-xs" style={{ color: "#a6b9ac" }}>{song.artist}</span></span></span>
                    <span className="hidden truncate text-xs sm:block" style={{ color: "#a6b9ac" }}>{song.album || "—"}</span>
                    <span className="text-right text-xs tabular-nums" style={{ color: "#5d7768" }}>{song.duration > 0 ? formatDuration(song.duration) : "—"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
