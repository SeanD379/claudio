"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useAnimation } from "framer-motion";
import { Send, X, Volume2, VolumeX, Loader2, Sparkles, Maximize2, Minimize2, Play, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { usePlayer } from "@/hooks/usePlayer";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthContext } from "@/app/components/auth/AuthProvider";
import { create } from "zustand";

interface FloatingAvatarProps {
  narration: string | null;
  onNarrationDismiss: () => void;
}

interface ChatSong {
  title: string;
  artist: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  type?: "narration" | "chat";
  reaction?: string;
  songs?: ChatSong[] | null;
}

const ENERGY_REACTIONS = [
  { emoji: "💜", label: "共鸣", en: "Resonate" },
  { emoji: "🔥", label: "燃", en: "Fire" },
  { emoji: "💧", label: "治愈", en: "Heal" },
  { emoji: "✨", label: "惊喜", en: "Surprise" },
];

const MAX_CHAT_MESSAGES = 50;

const useChatStore = create<{
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  updateReaction: (msgId: string, reaction: string) => void;
  clearMessages: () => void;
}>((set) => ({
  messages: [{
    id: "welcome",
    role: "assistant",
    content: "嘿！我是 Claudio 🎵 来聊天吧！",
    timestamp: Date.now(),
    type: "chat",
  }],
  addMessage: (msg) => set((state) => {
    const next = [...state.messages, msg];
    // Keep only the last MAX_CHAT_MESSAGES to prevent memory growth
    if (next.length > MAX_CHAT_MESSAGES) {
      return { messages: next.slice(-MAX_CHAT_MESSAGES) };
    }
    return { messages: next };
  }),
  updateReaction: (msgId, reaction) => set((state) => ({
    messages: state.messages.map(m => m.id === msgId ? { ...m, reaction } : m)
  })),
  clearMessages: () => set({
    messages: [{
      id: "welcome",
      role: "assistant",
      content: "嘿！我是 Claudio 🎵 来聊天吧！",
      timestamp: Date.now(),
      type: "chat",
    }],
  }),
}));

// 歌曲列表组件
function SongList({ songs, isExpanded }: { songs: ChatSong[]; isExpanded: boolean }) {
  const { lang } = useTranslation();
  const searchAndPlay = usePlayer((s) => s.searchAndPlay);
  const [showAll, setShowAll] = useState(false);

  const defaultCount = isExpanded ? 8 : 5;
  const visibleSongs = showAll ? songs : songs.slice(0, defaultCount);
  const hasMore = songs.length > defaultCount;

  const playSong = (song: ChatSong) => {
    searchAndPlay(`${song.title} ${song.artist}`);
  };

  const playAll = () => {
    if (songs.length > 0) {
      searchAndPlay(`${songs[0].title} ${songs[0].artist}`);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {/* 歌曲列表 */}
      <div className="space-y-1">
        {visibleSongs.map((song, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer"
            onClick={() => playSong(song)}
          >
            <span className="text-[11px] text-text-muted w-4 text-right flex-shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-text-primary truncate leading-tight ${isExpanded ? "text-sm" : "text-[13px]"}`}>{song.title}</p>
              <p className={`text-text-muted truncate ${isExpanded ? "text-xs" : "text-[11px]"}`}>{song.artist}</p>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Play className="w-3.5 h-3.5 text-accent fill-accent" />
            </div>
          </div>
        ))}
      </div>

      {/* 展开/收起 */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1 text-xs text-accent/70 hover:text-accent transition-colors"
        >
          {showAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showAll
            ? (lang === "en" ? "Show less" : "收起")
            : (lang === "en" ? `Show ${songs.length - defaultCount} more` : `查看剩余 ${songs.length - defaultCount} 首`)
          }
        </button>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={playAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
        >
          <Play className="w-3 h-3 fill-accent" />
          {lang === "en" ? "Play all" : "播放全部"}
        </button>
      </div>
    </div>
  );
}

export function FloatingAvatar({ narration, onNarrationDismiss }: FloatingAvatarProps) {
  const { lang } = useTranslation();
  const { isLoggedIn, showLoginModal } = useAuthContext();
  const isSpeaking = useTTS((s) => s.isPlaying);
  const ttsLoading = useTTS((s) => s.isLoading);
  const ttsEnabled = useTTS((s) => s.enabled);
  const { speak, stop: stopTTS, toggle: toggleTTS, currentMessageId } = useTTS();
  const searchAndPlay = usePlayer((s) => s.searchAndPlay);
  const { messages, addMessage, updateReaction } = useChatStore();

  const controls = useAnimation();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [avatarPos, setAvatarPos] = useState({ x: 0, y: 0 });
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleText, setBubbleText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const bubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 面板尺寸
  const panelW = isExpanded ? 580 : 420;
  const panelH = isExpanded ? 720 : 580;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => { if (isOpen) scrollToBottom(); }, [isOpen, scrollToBottom]);
  useEffect(() => { if (isOpen) scrollToBottom(); }, [messages, isOpen, scrollToBottom]);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (chatPanelRef.current && !chatPanelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveReaction(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 吸附到最近边缘
  const snapToEdge = useCallback(async (currentX: number, currentY: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const size = 56;
    const pad = 12;

    const distL = currentX;
    const distR = rect.width - currentX - size;
    const distT = currentY;
    const distB = rect.height - currentY - size;
    const min = Math.min(distL, distR, distT, distB);

    let tx = currentX, ty = currentY;
    if (min === distL) tx = pad;
    else if (min === distR) tx = rect.width - size - pad;
    else if (min === distT) ty = pad;
    else ty = rect.height - size - pad;

    setAvatarPos({ x: tx, y: ty });
    await controls.start({ x: tx, y: ty, transition: { type: "spring", stiffness: 300, damping: 30, mass: 0.8 } });
  }, [controls]);

  const handleDragEnd = useCallback(async () => {
    isDragging.current = false;
    await snapToEdge(x.get(), y.get());
  }, [x, y, snapToEdge]);

  // 初始化位置（右下角）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const initX = rect.width - 56 - 12;
    const initY = rect.height - 56 - 12;
    controls.set({ x: initX, y: initY });
    setAvatarPos({ x: initX, y: initY });
  }, [controls]);

  // 旁白 + 气泡（TTS播放结束后5秒消失，超时兜底）
  useEffect(() => {
    if (!narration) return;
    addMessage({ id: `narration-${Date.now()}`, role: "assistant", content: narration, timestamp: Date.now(), type: "narration" });
    if (!isOpen) {
      setBubbleText(narration);
      setShowBubble(true);
      if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
      let ttsHasStarted = false;
      let dismissed = false;
      const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        setShowBubble(false);
      };
      const checkAndDismiss = () => {
        if (dismissed) return;
        const playing = useTTS.getState().isPlaying;
        if (playing) {
          ttsHasStarted = true;
          bubbleTimeoutRef.current = setTimeout(checkAndDismiss, 300);
        } else if (ttsHasStarted) {
          bubbleTimeoutRef.current = setTimeout(dismiss, 5000);
        } else {
          bubbleTimeoutRef.current = setTimeout(checkAndDismiss, 300);
        }
      };
      bubbleTimeoutRef.current = setTimeout(checkAndDismiss, 300);
      setTimeout(dismiss, 15000);
    }
    onNarrationDismiss();
  }, [narration, onNarrationDismiss, isOpen, addMessage]);

  // AI回复气泡（TTS播放结束后5秒消失，超时兜底）
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === "assistant" && last.type === "chat" && !isOpen && last.id !== "welcome") {
      setBubbleText(last.content);
      setShowBubble(true);
      if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
      let ttsHasStarted = false;
      let dismissed = false;
      const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        setShowBubble(false);
      };
      const checkAndDismiss = () => {
        if (dismissed) return;
        const playing = useTTS.getState().isPlaying;
        if (playing) {
          ttsHasStarted = true;
          bubbleTimeoutRef.current = setTimeout(checkAndDismiss, 300);
        } else if (ttsHasStarted) {
          bubbleTimeoutRef.current = setTimeout(dismiss, 5000);
        } else {
          bubbleTimeoutRef.current = setTimeout(checkAndDismiss, 300);
        }
      };
      bubbleTimeoutRef.current = setTimeout(checkAndDismiss, 300);
      setTimeout(dismiss, 15000);
    }
  }, [messages, isOpen]);

  useEffect(() => { if (isOpen) { setShowBubble(false); if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current); } }, [isOpen]);
  useEffect(() => () => { if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current); }, []);

  // 发送消息
  const sendMessage = useCallback(async (text: string) => {
    addMessage({ id: `user-${Date.now()}`, role: "user", content: text, timestamp: Date.now(), type: "chat" });
    setIsLoading(true);
    try {
      const history = messages.slice(-10).map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history, language: lang }) });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const msgId = `ai-${Date.now()}`;
      addMessage({
        id: msgId,
        role: "assistant",
        content: data.reply,
        timestamp: Date.now(),
        type: "chat",
        songs: data.songs || null,
      });
      if (data.searchKeyword) searchAndPlay(data.searchKeyword);
      speak(data.reply, lang, msgId);
    } catch {
      addMessage({ id: `error-${Date.now()}`, role: "assistant", content: lang === "en" ? "Oops, something went wrong." : "哎呀，出了点问题。", timestamp: Date.now(), type: "chat" });
    } finally {
      setIsLoading(false);
    }
  }, [lang, messages, searchAndPlay, speak, addMessage]);

  // 重新生成推荐
  const regenerate = useCallback((msg: ChatMessage) => {
    // 找到这条消息之前的最后一条用户消息
    const idx = messages.findIndex(m => m.id === msg.id);
    const prevUserMsg = messages.slice(0, idx).reverse().find(m => m.role === "user");
    if (prevUserMsg) {
      sendMessage(prevUserMsg.content);
    }
  }, [messages, sendMessage]);

  const handleSend = () => { if (!input.trim() || isLoading) return; sendMessage(input); setInput(""); inputRef.current?.focus(); };
  const handleReaction = (msgId: string, emoji: string) => { updateReaction(msgId, emoji); setActiveReaction(null); };

  // 面板位置
  const gap = 16;
  const getPanelPos = () => {
    const c = containerRef.current;
    if (!c) return { left: 0, top: 0 };
    const r = c.getBoundingClientRect();
    let left = avatarPos.x - panelW - gap;
    let top = avatarPos.y - panelH / 2 + 28;
    if (left < 12) left = avatarPos.x + 56 + gap;
    top = Math.max(12, Math.min(top, r.height - panelH - 12));
    left = Math.max(12, Math.min(left, r.width - panelW - 12));
    return { left, top };
  };
  const getBubblePos = () => {
    const bw = 360, g = 8, pad = 16;
    let left = avatarPos.x - bw - g;
    if (left < pad) left = avatarPos.x + 56 + g;
    // 防止右侧溢出
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    if (left + bw > vw - pad) left = vw - bw - pad;
    if (left < pad) left = pad;
    let top = avatarPos.y - 80;
    if (top < pad) top = avatarPos.y + 70;
    const maxTop = typeof window !== "undefined" ? window.innerHeight - 140 : top;
    if (top > maxTop) top = maxTop;
    return { left, top };
  };
  const panelPos = getPanelPos();
  const bubblePos = getBubblePos();

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {/* 遮罩 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div className="absolute inset-0 pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setIsOpen(false); setActiveReaction(null); }} />
        )}
      </AnimatePresence>

      {/* 聊天面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div ref={chatPanelRef} className="absolute pointer-events-auto" style={panelPos}
            initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            {/* 连接尾巴 */}
            <div className="absolute top-8 w-3 h-3 rotate-45" style={{
              backgroundColor: "color-mix(in srgb, var(--surface) 90%, transparent)",
              ...(avatarPos.x > panelPos.left
                ? { right: -7, borderLeft: "1px solid color-mix(in srgb, var(--border) 60%, transparent)", borderTop: "1px solid color-mix(in srgb, var(--border) 60%, transparent)" }
                : { left: -7, borderRight: "1px solid color-mix(in srgb, var(--border) 60%, transparent)", borderBottom: "1px solid color-mix(in srgb, var(--border) 60%, transparent)" }),
            }} />

            <motion.div
              className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
              style={{
                width: panelW,
                height: panelH,
                backgroundColor: "color-mix(in srgb, var(--surface) 90%, transparent)",
                backdropFilter: "blur(40px) saturate(180%)",
                border: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
              }}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* 头部 */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
                    <Sparkles className="w-4.5 h-4.5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">Claudio</h3>
                    <p className="text-[11px] text-text-muted">
                      {isSpeaking ? (lang === "en" ? "Speaking..." : "说话中...") : (lang === "en" ? "Online" : "在线")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-elevated transition-colors"
                    title={isExpanded ? (lang === "en" ? "Shrink" : "缩小") : (lang === "en" ? "Expand" : "放大")}>
                    {isExpanded ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
                  </button>
                  <button onClick={toggleTTS} className={`p-1.5 rounded-lg transition-colors ${ttsEnabled ? "text-accent hover:bg-accent/10" : "text-text-muted hover:bg-surface-elevated"}`}>
                    {ttsEnabled ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
                  </button>
                  <button onClick={() => { setIsOpen(false); setActiveReaction(null); }} className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-elevated transition-colors">
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto p-5" onClick={() => setActiveReaction(null)}>
                <style>{`.chat-scroll::-webkit-scrollbar { width: 5px; } .chat-scroll::-webkit-scrollbar-track { background: transparent; } .chat-scroll::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 10px; opacity: 0.4; } .chat-scroll::-webkit-scrollbar-thumb:hover { opacity: 0.7; }`}</style>
                <div className="chat-scroll space-y-4">
                  {messages.map((msg) => (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[85%]">
                        {/* 气泡 + emoji 包裹层 */}
                        <div className="relative">
                          <motion.div
                            className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed cursor-pointer select-none ${
                              msg.role === "user" ? "bg-accent/15 text-text-primary rounded-br-md"
                                : msg.type === "narration" ? "bg-gradient-to-br from-accent/10 to-purple-500/10 text-text-primary rounded-bl-md border border-accent/20"
                                : "bg-surface-elevated text-text-primary rounded-bl-md"
                            } ${activeReaction === msg.id ? "ring-1 ring-accent/30" : ""}`}
                            onClick={(e) => { e.stopPropagation(); if (msg.role === "assistant") setActiveReaction(activeReaction === msg.id ? null : msg.id); }}
                            whileTap={{ scale: 0.98 }}>
                            {msg.type === "narration" && (
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-accent" />
                                <span className="text-xs text-accent font-medium">{lang === "en" ? "Narration" : "旁白"}</span>
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{msg.content}</p>

                            {/* 歌曲推荐列表 */}
                            {msg.songs && msg.songs.length > 0 && (
                              <SongList songs={msg.songs} isExpanded={isExpanded} />
                            )}

                            {msg.role === "assistant" && ttsEnabled && (
                              <button onClick={(e) => { e.stopPropagation(); currentMessageId === msg.id ? stopTTS() : speak(msg.content, lang, msg.id); }}
                                disabled={ttsLoading && currentMessageId !== msg.id}
                                className="mt-1.5 flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors">
                                {ttsLoading && currentMessageId === msg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : currentMessageId === msg.id ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                                {currentMessageId === msg.id ? (lang === "en" ? "Stop" : "停止") : (lang === "en" ? "Read" : "朗读")}
                              </button>
                            )}

                            {/* 重新生成按钮（仅推荐歌曲消息） */}
                            {msg.songs && msg.songs.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); regenerate(msg); }}
                                className="mt-1.5 flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors"
                              >
                                <RefreshCw className="w-3 h-3" />
                                {lang === "en" ? "Regenerate" : "换一批"}
                              </button>
                            )}
                          </motion.div>

                          {/* 反馈emoji */}
                          {msg.reaction && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 20 }}
                              className="absolute -bottom-2.5 -right-1.5 text-xl pointer-events-none z-10">
                              {msg.reaction}
                            </motion.div>
                          )}
                        </div>

                        {/* 反馈选择器 */}
                        <AnimatePresence>
                          {activeReaction === msg.id && (
                            <motion.div initial={{ opacity: 0, y: -4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.95 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              className={`mt-1.5 ${msg.role === "user" ? "flex justify-end" : ""}`} onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex gap-1.5 px-2.5 py-2 rounded-full bg-surface-elevated/95 backdrop-blur-xl border border-white/10 shadow-lg">
                                {ENERGY_REACTIONS.map((r) => (
                                  <motion.button key={r.emoji} onClick={() => handleReaction(msg.id, r.emoji)}
                                    whileHover={{ scale: 1.3, y: -3 }} whileTap={{ scale: 0.8 }} className="relative group/r">
                                    <span className="text-xl">{r.emoji}</span>
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/r:opacity-100 transition-opacity pointer-events-none">
                                      <div className="px-1.5 py-0.5 rounded bg-surface/90 text-[9px] text-text-muted whitespace-nowrap">
                                        {lang === "en" ? r.en : r.label}
                                      </div>
                                    </div>
                                  </motion.button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}

                  {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                      <div className="bg-surface-elevated rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 bg-accent rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:0.15s]" />
                          <span className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:0.3s]" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* 输入栏 */}
              <div className="p-4 border-t border-white/5">
                <div className="flex gap-2.5 items-center">
                  <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder={lang === "en" ? "Say something..." : "说点什么..."}
                    className="flex-1 px-4 py-2.5 bg-surface-elevated rounded-full text-base text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent/30 transition-shadow" />
                  <motion.button onClick={handleSend} disabled={!input.trim() || isLoading}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ backgroundColor: input.trim() ? "var(--accent)" : "var(--surface-elevated)", color: input.trim() ? "var(--text-on-accent)" : "var(--text-muted)" }}>
                    <Send className="w-4.5 h-4.5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 气泡提醒 */}
      <AnimatePresence>
        {showBubble && !isOpen && (
          <motion.div className="absolute pointer-events-auto cursor-pointer" style={bubblePos}
            initial={{ opacity: 0, scale: 0.8, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => { setIsOpen(true); setShowBubble(false); }}>
            <div ref={(el) => {
              if (el) {
                const rect = el.getBoundingClientRect();
                const vh = window.innerHeight;
                const vw = window.innerWidth;
                if (rect.bottom > vh - 12) {
                  const parent = el.closest('.absolute') as HTMLElement;
                  if (parent) parent.style.top = `${vh - rect.height - 12}px`;
                }
                if (rect.right > vw - 12) {
                  const parent = el.closest('.absolute') as HTMLElement;
                  if (parent) parent.style.left = `${vw - rect.width - 12}px`;
                }
              }
            }} className="max-w-[360px] px-4 py-3 rounded-xl rounded-bl-md text-sm leading-relaxed text-text-primary shadow-lg"
              style={{ backgroundColor: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "blur(20px)", border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)" }}>
              <p className="whitespace-pre-wrap break-words">{bubbleText}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 头像 */}
      <motion.div className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
        drag dragConstraints={containerRef} dragElastic={0} dragMomentum={false}
        onDragStart={() => { isDragging.current = true; }} onDragEnd={handleDragEnd}
        animate={controls} style={{ x, y }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
        onClick={() => {
          // 未登录时点击头像显示登录弹窗
          if (!isLoggedIn) {
            showLoginModal();
            return;
          }
          if (!isDragging.current && !isOpen) setIsOpen(true);
          setTimeout(() => { isDragging.current = false; }, 100);
        }}>
        <div className="relative">
          {isLoading && (
            <motion.div className="absolute inset-0 rounded-full" style={{ backgroundColor: "var(--accent)" }}
              animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
          )}
          <motion.div className={`w-14 h-14 rounded-full backdrop-blur-xl border-2 flex items-center justify-center shadow-lg transition-colors ${isSpeaking ? "border-accent" : isOpen ? "border-accent/50" : "border-white/10"}`}
            style={{ backgroundColor: "color-mix(in srgb, var(--surface) 90%, transparent)" }}
            animate={isSpeaking ? { scale: [1, 1.05, 1] } : {}} transition={{ duration: 0.5, repeat: isSpeaking ? Infinity : 0 }}>
            <span className="text-2xl">🎵</span>
          </motion.div>
          {isSpeaking && (
            <motion.div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-accent"
              animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
          )}
        </div>
      </motion.div>
    </div>
  );
}
