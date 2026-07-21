"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useFavorites } from "@/hooks/useFavorites";
import { usePlayer } from "@/hooks/usePlayer";
import { useTheme } from "@/hooks/useTheme";
import { Heart, Play, Trash2, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function FavoritesPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { favorites, isLoading, fetchFavorites, removeFavorite } =
    useFavorites();

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const playSong = (song: { neteaseId: string; title: string; artist: string; album: string; coverUrl: string; duration: number | null; id: string }) => {
    const player = usePlayer.getState();
    const songs = favorites.map((f) => ({
      id: f.id,
      neteaseId: f.neteaseId,
      title: f.title,
      artist: f.artist,
      album: f.album,
      coverUrl: f.coverUrl,
      duration: f.duration,
    }));
    player.setAndPlay(songs, {
      id: song.id,
      neteaseId: song.neteaseId,
      title: song.title,
      artist: song.artist,
      album: song.album,
      coverUrl: song.coverUrl,
      duration: song.duration || 0,
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#121212" }}>
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/playlists" className="p-2 -ml-2 rounded-full hover:bg-surface-elevated transition-colors">
            <ArrowLeft className="w-5 h-5" style={{ color: isLight ? "#6b7280" : "var(--text-secondary)" }} />
          </Link>
          <Heart className="w-7 h-7 text-accent fill-current" />
          <h1
            className="text-3xl font-normal tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: isLight ? "#1a1d26" : "var(--text-primary)" }}
          >
            {t("favorites.title")}
          </h1>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-t-accent rounded-full mx-auto" style={{ borderColor: isLight ? "#d1d5db" : "var(--text-muted)", borderTopColor: "var(--accent)" }} />
            <p className="mt-4" style={{ color: isLight ? "#6b7280" : "var(--text-secondary)" }}>{t("favorites.loading")}</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 mx-auto mb-4 opacity-40" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }} />
            <p className="text-lg" style={{ color: isLight ? "#6b7280" : "var(--text-secondary)" }}>
              {t("favorites.empty")}
            </p>
            <p className="mt-2 text-sm" style={{ color: isLight ? "#9ca3af" : "var(--text-muted)" }}>
              {t("favorites.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {favorites.map((song, index) => (
              <div
                key={song.id}
                className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-surface-elevated transition-colors group"
                style={{ background: isLight ? "rgba(255,255,255,0.6)" : "var(--surface)" }}
              >
                <span className="w-8 text-center text-sm" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }}>
                  {index + 1}
                </span>

                <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0" style={{ background: isLight ? "rgba(0,0,0,0.05)" : "var(--surface-elevated)" }}>
                  {song.coverUrl ? (
                    <Image
                      src={song.coverUrl}
                      alt={song.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Heart className="w-5 h-5" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate text-sm" style={{ color: isLight ? "#1a1d26" : "var(--text-primary)" }}>
                    {song.title}
                  </h3>
                  <p className="text-xs truncate" style={{ color: isLight ? "#6b7280" : "var(--text-secondary)" }}>
                    {song.artist}
                  </p>
                </div>

                <span className="text-xs" style={{ color: isLight ? "#6b7280" : "var(--text-muted)" }}>
                  {formatDuration(song.duration)}
                </span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => playSong(song)} className="p-2 rounded-full hover:bg-surface-elevated transition-colors">
                    <Play className="w-4 h-4" style={{ color: isLight ? "#6b7280" : "var(--text-secondary)" }} />
                  </button>
                  <button
                    onClick={() => removeFavorite(song.neteaseId)}
                    className="p-2 rounded-full hover:bg-accent/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-accent" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
