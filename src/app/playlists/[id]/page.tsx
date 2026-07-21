"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePlayer, Song } from "@/hooks/usePlayer";
import {
  ArrowLeft,
  Play,
  Pause,
  Music,
  Loader2,
  ListMusic,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useTheme } from "@/hooks/useTheme";

interface PlaylistInfo {
  id: string;
  name: string;
  neteaseId: string | null;
}

export default function PlaylistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playlistId = params.id as string;

  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    setAndPlay(songs, songs[0]);
  };

  const handlePlaySong = (song: Song) => {
    setAndPlay(songs, song);
  };

  const isCurrentSong = (song: Song) => {
    return currentSong?.neteaseId === song.neteaseId;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
          onClick={() => router.back()}
          className="px-4 py-2 rounded-lg bg-surface-elevated transition-colors"
          style={{ color: isLight ? "#6b7280" : "var(--text-secondary)" }}
        >
          {t("playlist.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-24">
      {/* Header */}
      <div
        className="sticky top-0 z-10 backdrop-blur-xl"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--canvas) 85%, transparent)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="max-w-[1400px] mx-auto px-8 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex-1 min-w-0">
            <h1
              className="text-lg font-normal truncate"
              style={{ fontFamily: 'var(--font-display)', color: isLight ? "#1a1d26" : "var(--text-primary)" }}
            >
              {playlist.name}
            </h1>
            <p className="text-xs" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }}>
              {t("playlist.songCount", songs.length)}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-8 pt-4">
        {/* Play All Button */}
        <button
          onClick={handlePlayAll}
          disabled={songs.length === 0}
          className="w-full mb-4 py-3 px-4 rounded-xl bg-accent text-text-on-accent font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-hover flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" />
          {t("playlist.playAll")}
        </button>

        {/* Songs List */}
        {songs.length === 0 ? (
          <div className="text-center py-12" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }}>
            <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>{t("playlist.empty")}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {songs.map((song, index) => {
              const isActive = isCurrentSong(song);
              const isThisPlaying = isActive && isPlaying;
              const isThisLoading = isActive && playerLoading;

              return (
                <button
                  key={song.id}
                  onClick={() => handlePlaySong(song)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                    isActive
                      ? "bg-surface-elevated"
                      : "hover:bg-surface-elevated/50"
                  }`}
                >
                  {/* Index / Play indicator */}
                  <div className="w-8 flex-shrink-0 text-center">
                    {isThisLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }} />
                    ) : isThisPlaying ? (
                      <div className="flex items-end justify-center gap-0.5 h-4">
                        <div className="w-1 bg-accent animate-music-bar-1" />
                        <div className="w-1 bg-accent animate-music-bar-2" />
                        <div className="w-1 bg-accent animate-music-bar-3" />
                      </div>
                    ) : isActive ? (
                      <Pause className="w-4 h-4 text-accent mx-auto" />
                    ) : (
                      <span className="text-sm" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }}>
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Cover */}
                  {song.coverUrl ? (
                    <img
                      src={song.coverUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center flex-shrink-0">
                      <Music className="w-5 h-5 text-text-muted" />
                    </div>
                  )}

                  {/* Song Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: isActive ? "var(--accent)" : (isLight ? "#1a1d26" : "var(--text-primary)") }}
                    >
                      {song.title}
                    </p>
                    <p className="text-xs truncate" style={{ color: isLight ? "#6b7280" : "var(--text-secondary)" }}>
                      {song.artist}
                      {song.album && ` · ${song.album}`}
                    </p>
                  </div>

                  {/* Duration */}
                  {song.duration > 0 && (
                    <span className="text-xs flex-shrink-0" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }}>
                      {formatDuration(song.duration)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
