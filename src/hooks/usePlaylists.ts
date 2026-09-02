"use client";

import { create } from "zustand";
import { Song } from "@/app/lib/music";
import { usePlayer } from "./usePlayer";

export interface PlaylistItem {
  id: string;
  neteaseId: string | null;
  name: string;
  description: string | null;
  coverUrl: string | null;
  songCount: number;
  createdAt: string;
}

export interface ImportablePlaylist {
  playlistId: number;
  name: string;
  trackCount: number;
  imported: boolean;
  coverUrl?: string;
  creator?: string;
  isMine?: boolean;
}

export interface SyncResult {
  added: number;
  removed: number;
  total: number;
}

interface PlaylistsState {
  playlists: PlaylistItem[];
  isLoading: boolean;
  syncLoading: Record<string, boolean>;
  syncResults: Record<string, SyncResult | null>;

  fetchPlaylists: () => Promise<void>;
  fetchImportable: () => Promise<ImportablePlaylist[]>;
  fetchNeteasePlaylists: () => Promise<ImportablePlaylist[]>;
  importFromExport: (playlistIds: number[]) => Promise<void>;
  importFromNetease: (neteasePlaylistId: string) => Promise<void>;
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  syncPlaylist: (playlistId: string) => Promise<SyncResult>;
  playPlaylist: (playlistId: string) => Promise<void>;
  playAllSongs: () => Promise<void>;
}

export const usePlaylists = create<PlaylistsState>((set, get) => ({
  playlists: [],
  isLoading: false,
  syncLoading: {},
  syncResults: {},

  fetchPlaylists: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/user/playlists");
      if (res.ok) {
        const data = await res.json();
        set({ playlists: data.playlists });
      }
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchImportable: async () => {
    try {
      const res = await fetch("/api/user/playlists/import-available");
      if (res.ok) {
        const data = await res.json();
        return data.playlists;
      }
    } catch (error) {
      console.error("Failed to fetch importable playlists:", error);
    }
    return [];
  },

  fetchNeteasePlaylists: async () => {
    try {
      const res = await fetch("/api/user/playlists/netease-mine");
      if (res.ok) {
        const data = await res.json();
        return data.playlists;
      }
    } catch (error) {
      console.error("Failed to fetch netease playlists:", error);
    }
    return [];
  },

  importFromExport: async (playlistIds: number[]) => {
    try {
      const res = await fetch("/api/user/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "file", playlistIds }),
      });

      if (res.ok) {
        // 刷新列表
        await get().fetchPlaylists();
      }
    } catch (error) {
      console.error("Failed to import playlists:", error);
    }
  },

  importFromNetease: async (neteasePlaylistId: string) => {
    try {
      const res = await fetch("/api/user/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "netease", neteasePlaylistId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "导入失败");
      }

      // 刷新列表
      await get().fetchPlaylists();
    } catch (error) {
      console.error("Failed to import from netease:", error);
      throw error;
    }
  },

  createPlaylist: async (name: string) => {
    const res = await fetch("/api/user/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "manual", name }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "创建歌单失败");
    }

    await get().fetchPlaylists();
  },

  deletePlaylist: async (playlistId: string) => {
    try {
      const res = await fetch(
        `/api/user/playlists?playlistId=${playlistId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== playlistId),
        }));
      }
    } catch (error) {
      console.error("Failed to delete playlist:", error);
    }
  },

  syncPlaylist: async (playlistId: string) => {
    set((state) => ({
      syncLoading: { ...state.syncLoading, [playlistId]: true },
      syncResults: { ...state.syncResults, [playlistId]: null },
    }));

    try {
      const res = await fetch("/api/user/playlists/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId }),
      });

      if (res.ok) {
        const data = await res.json();
        const result: SyncResult = {
          added: data.added,
          removed: data.removed,
          total: data.total,
        };
        set((state) => ({
          syncResults: { ...state.syncResults, [playlistId]: result },
        }));

        // 如果有变化，刷新歌单列表
        if (data.added > 0 || data.removed > 0) {
          await get().fetchPlaylists();
        }

        return result;
      }
    } catch (error) {
      console.error("Failed to sync playlist:", error);
    } finally {
      set((state) => ({
        syncLoading: { ...state.syncLoading, [playlistId]: false },
      }));
    }

    return { added: 0, removed: 0, total: 0 };
  },

  playPlaylist: async (playlistId: string) => {
    try {
      const res = await fetch(
        `/api/user/playlists/${playlistId}/songs`
      );

      if (res.ok) {
        const data = await res.json();
        const songs: Song[] = data.songs;

        if (songs.length === 0) return;

        const player = usePlayer.getState();
        player.setAndPlay(songs, songs[0]);
      }
    } catch (error) {
      console.error("Failed to play playlist:", error);
    }
  },

  playAllSongs: async () => {
    try {
      // 并行获取所有歌单歌曲和收藏歌曲
      const [playlistRes, favoritesRes] = await Promise.all([
        fetch("/api/user/playlists/all-songs"),
        fetch("/api/user/favorites"),
      ]);

      const allSongs: Song[] = [];

      if (playlistRes.ok) {
        const data = await playlistRes.json();
        if (data.songs) allSongs.push(...data.songs);
      }

      if (favoritesRes.ok) {
        const data = await favoritesRes.json();
        if (data.favorites) {
          const favoriteSongs: Song[] = data.favorites.map((f: any) => ({
            id: f.id || f.neteaseId,
            neteaseId: f.neteaseId,
            title: f.title,
            artist: f.artist,
            album: f.album || "",
            coverUrl: f.coverUrl || "",
            duration: f.duration || 0,
          }));
          allSongs.push(...favoriteSongs);
        }
      }

      // 去重
      const uniqueSongs = allSongs.filter(
        (song, index, self) =>
          index === self.findIndex((s) => s.neteaseId === song.neteaseId)
      );

      if (uniqueSongs.length === 0) return;

      const player = usePlayer.getState();
      usePlayer.setState({ playMode: "shuffle" });
      localStorage.setItem("claudio-play-mode", "shuffle");
      const randomIndex = Math.floor(Math.random() * uniqueSongs.length);
      player.setAndPlay(uniqueSongs, uniqueSongs[randomIndex]);
    } catch (error) {
      console.error("Failed to play all songs:", error);
    }
  },
}));
