"use client";

import { create } from "zustand";
import { Song } from "@/app/lib/music";

interface FavoriteSong extends Song {
  favoriteId: string;
}

interface FavoritesState {
  favorites: FavoriteSong[];
  isLoading: boolean;
  fetchFavorites: () => Promise<void>;
  addFavorite: (song: Song) => Promise<void>;
  removeFavorite: (songId: string) => Promise<void>;
  isFavorite: (songId: string) => boolean;
}

export const useFavorites = create<FavoritesState>((set, get) => ({
  favorites: [],
  isLoading: false,

  fetchFavorites: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch("/api/user/favorites");
      if (response.ok) {
        const data = await response.json();
        set({ favorites: data.favorites });
      }
    } catch (error) {
      console.error("Failed to fetch favorites:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  addFavorite: async (song: Song) => {
    try {
      const response = await fetch("/api/user/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: song.neteaseId,
          title: song.title,
          artist: song.artist,
          album: song.album,
          coverUrl: song.coverUrl,
          duration: song.duration,
          neteaseId: song.neteaseId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        set((state) => ({
          favorites: [
            { ...song, favoriteId: data.favoriteId },
            ...state.favorites,
          ],
        }));
      }
    } catch (error) {
      console.error("Failed to add favorite:", error);
    }
  },

  removeFavorite: async (songId: string) => {
    try {
      const response = await fetch(
        `/api/user/favorites?songId=${songId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        set((state) => ({
          favorites: state.favorites.filter((f) => f.neteaseId !== songId),
        }));
      }
    } catch (error) {
      console.error("Failed to remove favorite:", error);
    }
  },

  isFavorite: (songId: string) => {
    return get().favorites.some((f) => f.neteaseId === songId);
  },
}));
