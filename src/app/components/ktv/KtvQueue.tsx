"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Music } from "lucide-react";
import { useKtvQueue } from "@/hooks/useKtvQueue";
import { usePlayer } from "@/hooks/usePlayer";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function KtvQueue({ isOpen, onClose }: Props) {
  const { queue, removeSong, clearQueue } = useKtvQueue();
  const { currentSong } = usePlayer();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60]"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-80 z-[61] flex flex-col"
            style={{
              background: "rgba(10, 14, 23, 0.85)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              borderLeft: "1px solid rgba(139, 156, 247, 0.1)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="text-base font-medium text-white/90">
                待唱歌单
                {queue.length > 0 && (
                  <span className="text-xs text-white/40 ml-2">{queue.length}</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {queue.length > 0 && (
                  <motion.button
                    onClick={clearQueue}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-red-400"
                    whileTap={{ scale: 0.8, rotate: -10 }}
                    whileHover={{ scale: 1.1 }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                )}
                <motion.button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
                  whileTap={{ scale: 0.8 }}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* 当前播放 */}
            {currentSong && (
              <div className="px-5 py-3 border-b border-white/5">
                <p className="text-[10px] uppercase tracking-wider text-accent mb-2">
                  正在演唱
                </p>
                <div className="flex items-center gap-3">
                  {currentSong.coverUrl ? (
                    <img src={currentSong.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                      <Music className="w-5 h-5 text-white/20" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/90 truncate">{currentSong.title}</p>
                    <p className="text-xs text-white/40 truncate">{currentSong.artist}</p>
                  </div>
                  <div className="flex items-end gap-0.5 h-4">
                    <div className="w-0.5 bg-accent animate-music-bar-1" />
                    <div className="w-0.5 bg-accent animate-music-bar-2" />
                    <div className="w-0.5 bg-accent animate-music-bar-3" />
                  </div>
                </div>
              </div>
            )}

            {/* 队列列表 */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/30">
                  <Music className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">还没有点歌哦~</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {queue.map((song, index) => (
                    <motion.div
                      key={`${song.neteaseId}-${index}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <span className="w-5 text-center text-xs text-white/30">{index + 1}</span>
                      {song.coverUrl ? (
                        <img src={song.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                          <Music className="w-4 h-4 text-white/20" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 truncate">{song.title}</p>
                        <p className="text-xs text-white/30 truncate">{song.artist}</p>
                      </div>
                      <motion.button
                        onClick={() => removeSong(index)}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all text-white/30 hover:text-red-400"
                        whileTap={{ scale: 0.7, rotate: 90 }}
                        whileHover={{ scale: 1.15 }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部统计 */}
            {queue.length > 0 && (
              <div className="px-5 py-3 border-t border-white/5 text-center">
                <p className="text-xs text-white/30">{queue.length} 首歌</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
