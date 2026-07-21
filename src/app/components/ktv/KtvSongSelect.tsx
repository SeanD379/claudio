"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Music, Loader2, X, ChevronLeft, ListPlus, Check } from "lucide-react";
import { useKtvQueue } from "@/hooks/useKtvQueue";
import { usePlayer, Song } from "@/hooks/usePlayer";
import { useAuthContext } from "@/app/components/auth/AuthProvider";
import { curatedPlaylists, CuratedPlaylist } from "@/app/lib/curated-playlists";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// 合集歌曲列表视图
function CollectionView({
  collection,
  onBack,
  onAdd,
  onAddAll,
}: {
  collection: CuratedPlaylist;
  onBack: () => void;
  onAdd: (song: Song) => void;
  onAddAll: (songs: Song[]) => void;
}) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const markAdded = (id: string) => {
    setAddedIds((prev) => new Set(prev).add(id));
    setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }), 800);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/music/playlist?id=${collection.id}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSongs(data.playlist?.songs || data.songs || []);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [collection.id]);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="absolute inset-0 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium text-white/90 truncate">{collection.name}</h3>
          <p className="text-xs text-white/40">{collection.description}</p>
        </div>
        {songs.length > 0 && (
          <motion.button
            onClick={() => onAddAll(songs)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: "rgba(139,156,247,0.15)", color: "var(--accent)" }}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
          >
            <ListPlus className="w-3.5 h-3.5" />
            全部加入
          </motion.button>
        )}
      </div>

      {/* Songs */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-white/30" />
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30">
            <Music className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无歌曲</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {songs.map((song, i) => (
              <div
                key={song.neteaseId || i}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <span className="w-5 text-center text-xs text-white/30">{i + 1}</span>
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
                  onClick={() => { onAdd(song); markAdded(song.neteaseId); }}
                  className="p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  style={{
                    background: addedIds.has(song.neteaseId) ? "rgba(74,222,128,0.25)" : "rgba(139,156,247,0.15)",
                    color: addedIds.has(song.neteaseId) ? "#4ade80" : "var(--accent)",
                  }}
                  whileTap={{ scale: 0.75 }}
                  whileHover={{ scale: 1.15 }}
                >
                  {addedIds.has(song.neteaseId) ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </motion.button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function KtvSongSelect({ isOpen, onClose }: Props) {
  const addSong = useKtvQueue((s) => s.addSong);
  const playSong = usePlayer((s) => s.playSong);
  const currentSong = usePlayer((s) => s.currentSong);
  const { isLoggedIn, showLoginModal } = useAuthContext();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeCollection, setActiveCollection] = useState<CuratedPlaylist | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 搜索历史
  const HISTORY_KEY = "claudio-ktv-search-history";
  const HISTORY_MAX = 10;
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const saveToHistory = (keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h !== trimmed);
      const next = [trimmed, ...filtered].slice(0, HISTORY_MAX);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const removeFromHistory = (keyword: string) => {
    setSearchHistory((prev) => {
      const next = prev.filter((h) => h !== keyword);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const markAdded = (id: string) => {
    setAddedIds((prev) => new Set(prev).add(id));
    setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }), 800);
  };

  const searchIdRef = useRef(0);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setHasSearched(false); return; }
    const id = ++searchIdRef.current;
    setSearching(true);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q.trim())}&limit=20`);
      if (res.ok && id === searchIdRef.current) {
        const data = await res.json();
        setResults(data.songs || []);
        setHasSearched(true);
        saveToHistory(q);
      }
    } catch { /* ignore */ }
    finally { if (id === searchIdRef.current) setSearching(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setHasSearched(false); return; }
    debounceRef.current = setTimeout(() => doSearch(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const handleAdd = (song: Song) => {
    addSong(song);
    // 如果当前没在播放，直接播放这首歌
    if (!currentSong) {
      playSong(song);
    }
  };

  const handleAddAll = (songs: Song[]) => {
    songs.forEach((s) => addSong(s));
    if (!currentSong && songs.length > 0) {
      playSong(songs[0]);
    }
  };

  const handleClose = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setActiveCollection(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60]"
            onClick={handleClose}
          />

          {/* 面板 */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-[61] flex flex-col rounded-l-3xl overflow-hidden"
            style={{
              width: "min(50vw, 560px)",
              background: "rgba(10, 14, 23, 0.92)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              borderLeft: "1px solid rgba(139, 156, 247, 0.12)",
            }}
          >

            <div className="relative flex-1 overflow-hidden">
              {/* 主视图：搜索 + 歌单合集 */}
              <motion.div
                className="absolute inset-0 flex flex-col"
                animate={{ x: activeCollection ? "-100%" : 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3">
                  <h3 className="text-base font-medium text-white/90">点歌</h3>
                  <button
                    onClick={handleClose}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 搜索框 */}
                <div className="px-5 mb-4">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="搜索歌曲、歌手..."
                      className="w-full pl-10 pr-10 py-3 rounded-xl text-sm bg-white/5 text-white/90 placeholder-white/25 outline-none border border-white/5 focus:border-white/15 transition-colors"
                    />
                    {query && (
                      <button
                        onClick={() => { setQuery(""); setResults([]); setHasSearched(false); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10"
                      >
                        <X className="w-3.5 h-3.5 text-white/30" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 历史搜索 */}
                {!query.trim() && searchHistory.length > 0 && (
                  <div className="px-5 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-white/30 uppercase tracking-wider">历史搜索</p>
                      <button
                        onClick={() => {
                          setSearchHistory([]);
                          try { localStorage.removeItem(HISTORY_KEY); } catch {}
                        }}
                        className="text-[10px] text-white/20 hover:text-white/40 transition-colors"
                      >
                        清空
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchHistory.map((item) => (
                        <div
                          key={item}
                          className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer"
                          onClick={() => { setQuery(item); doSearch(item); }}
                        >
                          <span className="text-xs text-white/60 group-hover:text-white/80">{item}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFromHistory(item); }}
                            className="p-0.5 rounded-full hover:bg-white/15 transition-colors"
                          >
                            <X className="w-3 h-3 text-white/25 hover:text-white/50" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 内容区 */}
                <div className="flex-1 overflow-y-auto px-2">
                  <AnimatePresence mode="wait">
                    {hasSearched ? (
                      <motion.div
                        key="search-results"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {searching ? (
                          <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-white/30" />
                          </div>
                        ) : results.length === 0 ? (
                          <div className="text-center py-16 text-white/30">
                            <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">没有找到相关歌曲</p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {results.map((song, i) => (
                              <div
                                key={song.neteaseId || i}
                                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                              >
                                <span className="w-5 text-center text-xs text-white/30">{i + 1}</span>
                                {song.coverUrl ? (
                                  <img src={song.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                                    <Music className="w-4 h-4 text-white/20" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white/80 truncate">{song.title}</p>
                                  <p className="text-xs text-white/30 truncate">{song.artist}{song.album && ` · ${song.album}`}</p>
                                </div>
                                <motion.button
                                  onClick={() => { handleAdd(song); markAdded(song.neteaseId); }}
                                  className="p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                  style={{
                                    background: addedIds.has(song.neteaseId) ? "rgba(74,222,128,0.25)" : "rgba(139,156,247,0.15)",
                                    color: addedIds.has(song.neteaseId) ? "#4ade80" : "var(--accent)",
                                  }}
                                  whileTap={{ scale: 0.75 }}
                                  whileHover={{ scale: 1.15 }}
                                >
                                  {addedIds.has(song.neteaseId) ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                </motion.button>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="curated"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <p className="text-xs text-white/30 uppercase tracking-wider px-3 mb-3">推荐歌单</p>
                        <div className="space-y-1">
                          {curatedPlaylists.map((pl) => (
                            <button
                              key={pl.id}
                              onClick={() => setActiveCollection(pl)}
                              className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                            >
                              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pl.gradient} flex items-center justify-center flex-shrink-0`}>
                                <Music className="w-5 h-5 text-white/70" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white/80 font-medium truncate">{pl.name}</p>
                                <p className="text-xs text-white/30 truncate">{pl.description}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* 合集详情视图 */}
              {activeCollection && (
                <CollectionView
                  collection={activeCollection}
                  onBack={() => setActiveCollection(null)}
                  onAdd={handleAdd}
                  onAddAll={handleAddAll}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
