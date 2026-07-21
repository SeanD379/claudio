"use client";

import { create } from "zustand";
import { Song } from "./usePlayer";

interface KtvQueueState {
  queue: Song[];
  isOpen: boolean;

  addSong: (song: Song) => void;
  removeSong: (index: number) => void;
  clearQueue: () => void;
  playNext: () => Song | null;
  togglePanel: () => void;
  setOpen: (open: boolean) => void;
}

export const useKtvQueue = create<KtvQueueState>((set, get) => ({
  queue: [],
  isOpen: false,

  addSong: (song) => {
    set((state) => ({ queue: [...state.queue, song] }));
  },

  removeSong: (index) => {
    set((state) => ({
      queue: state.queue.filter((_, i) => i !== index),
    }));
  },

  clearQueue: () => set({ queue: [] }),

  playNext: () => {
    const { queue } = get();
    if (queue.length === 0) return null;
    const next = queue[0];
    set({ queue: queue.slice(1) });
    return next;
  },

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
}));
