"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Play, RefreshCw } from "lucide-react";
import { usePlayer, type Song } from "@/hooks/usePlayer";
import { useTranslation } from "@/hooks/useTranslation";
import { SongList } from "./SongList";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  songs?: { title: string; artist: string }[] | null;
  type?: "completion";
  playAllActive?: boolean;
}

const DEFAULT_MESSAGE_ZH = "你好！我是 Claudio，你的私人 DJ。今天想听什么类型的音乐呢？";
const DEFAULT_MESSAGE_EN = "Hello! I'm Claudio, your personal DJ. What kind of music would you like to listen to today?";

function defaultWelcome(lang: string): Message {
  return { id: "1", role: "assistant", content: lang === "en" ? DEFAULT_MESSAGE_EN : DEFAULT_MESSAGE_ZH };
}

export function Chat() {
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([defaultWelcome("zh")]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchAndPlay = usePlayer((s) => s.searchAndPlay);
  const prevLangRef = useRef(lang);
  const lastUserInputRef = useRef<string>("");

  // Restore from sessionStorage after hydration
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("claudio-messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {}
  }, []);

  // Persist messages to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem("claudio-messages", JSON.stringify(messages));
    }
  }, [messages]);

  const playAllStateRef = useRef<{ active: boolean; completionMsgId: string | null }>({
    active: false,
    completionMsgId: null,
  });
  const recommendedSongsRef = useRef<{ title: string; artist: string }[]>([]);
  const prevPlaylistRef = useRef<Song[]>([]);
  const prevCurrentSongRef = useRef<Song | null>(null);

  const handlePlayAllComplete = useCallback(() => {
    const { active, completionMsgId } = playAllStateRef.current;
    if (!active || completionMsgId) return;

    const msgId = `play-all-done-${Date.now()}`;
    playAllStateRef.current.completionMsgId = msgId;
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        role: "assistant",
        content:
          lang === "en"
            ? "You've listened to all the recommendations! Want me to continue with similar songs?"
            : "歌单已经播放完啦！要不要继续来一波类似的歌曲？",
        type: "completion",
        playAllActive: true,
      },
    ]);
  }, [lang]);

  useEffect(() => {
    if (playAllStateRef.current.active && !playAllStateRef.current.completionMsgId) {
      usePlayer.setState({ onPlaylistEnd: handlePlayAllComplete });
    }
    return () => {
      usePlayer.setState({ onPlaylistEnd: null });
      playAllStateRef.current.active = false;
    };
  }, [handlePlayAllComplete]);

  useEffect(() => {
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      setMessages((prev) => {
        if (prev.length > 0 && prev[0].id === "1" && prev[0].role === "assistant") {
          return [{ ...prev[0], content: lang === "en" ? DEFAULT_MESSAGE_EN : DEFAULT_MESSAGE_ZH }, ...prev.slice(1)];
        }
        return prev;
      });
    }
  }, [lang]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = useCallback(async (text: string, currentMessages: Message[]) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const history = currentMessages.slice(1).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, language: lang }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        songs: data.songs || null,
      };

      setMessages((prev) => [...prev, aiMessage]);

      if (data.searchKeyword) {
        searchAndPlay(data.searchKeyword);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: t("chat.error"),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [lang, searchAndPlay, t]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    lastUserInputRef.current = input;
    sendMessage(input, messages);
    setInput("");
  };

  const handleRegenerate = useCallback((messageId: string) => {
    if (isLoading) return;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    sendMessage(lastUserInputRef.current, messages.filter((m) => m.id !== messageId));
  }, [isLoading, messages, sendMessage]);

  const handlePlaySong = useCallback((song: { title: string; artist: string }) => {
    searchAndPlay(`${song.title} ${song.artist}`);
  }, [searchAndPlay]);

  const handlePlayAll = useCallback((songs: { title: string; artist: string }[]) => {
    if (songs.length === 0) return;

    const { playlist, currentSong } = usePlayer.getState();
    prevPlaylistRef.current = [...playlist];
    prevCurrentSongRef.current = currentSong;

    playAllStateRef.current = { active: true, completionMsgId: null };
    recommendedSongsRef.current = songs;

    usePlayer.setState({ onPlaylistEnd: handlePlayAllComplete });
    searchAndPlay(`${songs[0].title} ${songs[0].artist}`);
  }, [searchAndPlay, handlePlayAllComplete]);

  const handlePlayAllContinue = useCallback(async (completionMsgId: string) => {
    if (isLoading) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === completionMsgId ? { ...m, playAllActive: false } : m
      )
    );

    const prompt =
      lang === "en"
        ? "Recommend 20 more similar songs, different from the ones just played"
        : "再推荐 20 首类似的歌曲，和刚才播放过的不要重复";
    setIsLoading(true);

    try {
      const history = messages.slice(1).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, history, language: lang }),
      });

      if (!response.ok) throw new Error("Failed to get response");
      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        songs: data.songs || null,
      };
      setMessages((prev) => [...prev, aiMessage]);

      if (data.songs?.length) {
        recommendedSongsRef.current = data.songs;
        playAllStateRef.current = { active: true, completionMsgId: null };
        usePlayer.setState({ onPlaylistEnd: handlePlayAllComplete });

        const firstSong = data.songs[0];
        await searchAndPlay(`${firstSong.title} ${firstSong.artist}`);
      }
    } catch (error) {
      console.error("Play All continue error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, lang, messages, searchAndPlay, handlePlayAllComplete]);

  const handlePlayAllStop = useCallback((completionMsgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === completionMsgId ? { ...m, playAllActive: false } : m
      )
    );

    playAllStateRef.current = { active: false, completionMsgId: null };
    recommendedSongsRef.current = [];
    usePlayer.setState({ onPlaylistEnd: null });

    const prevPlaylist = prevPlaylistRef.current;
    const prevSong = prevCurrentSongRef.current;
    if (prevPlaylist.length > 0) {
      usePlayer.getState().setPlaylist(prevPlaylist);
      if (prevSong) {
        usePlayer.getState().playSong(prevSong);
      }
    } else {
      usePlayer.setState({ isPlaying: false });
    }
  }, []);

  return (
    <motion.div
      className="flex flex-col h-full overflow-hidden bg-surface rounded-2xl"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border-custom">
        <h2
          className="text-lg font-normal text-text-primary tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t("chat.title")}
        </h2>
      </div>

      {/* Message List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-accent/15 text-text-primary"
                    : "bg-surface-elevated text-text-primary"
                }`}
              >
                {message.content}
                {message.songs && message.songs.length > 0 && (
                  <SongList
                    songs={message.songs}
                    onPlaySong={handlePlaySong}
                    onPlayAll={() => handlePlayAll(message.songs!)}
                    onRegenerate={() => handleRegenerate(message.id)}
                  />
                )}
                {message.type === "completion" && message.playAllActive && (
                  <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--divider)' }}>
                    <motion.button
                      onClick={() => handlePlayAllContinue(message.id)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-accent text-text-on-accent text-xs font-medium transition-colors hover:bg-accent-hover"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {lang === "en" ? "Continue" : "继续播放"}
                    </motion.button>
                    <motion.button
                      onClick={() => handlePlayAllStop(message.id)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-surface-elevated text-text-secondary text-xs font-medium hover:text-text-primary transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {lang === "en" ? "Stop" : "停止"}
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-surface-elevated rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border-custom">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={t("chat.placeholder")}
            className="flex-1 px-4 py-2.5 bg-surface-elevated rounded-full text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 transition-shadow"
            style={{ '--tw-ring-color': 'var(--border-active)' } as React.CSSProperties}
          />
          <motion.button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-30"
            style={{
              backgroundColor: input.trim() ? 'var(--accent)' : 'var(--surface-elevated)',
              color: input.trim() ? 'var(--text-on-accent)' : 'var(--text-muted)',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
