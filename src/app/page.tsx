"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { Player } from "./components/home/Player";
import { Lyrics } from "./components/home/Lyrics";
import { SilkBackground } from "./components/home/SilkBackground";
import { ModeSwitcher } from "./components/home/ModeSwitcher";
import { MusicHall } from "./components/home/MusicHall";
import { KtvStage } from "./components/ktv/KtvStage";
import { KtvLyrics } from "./components/ktv/KtvLyrics";
import { KtvPlayer } from "./components/ktv/KtvPlayer";
import { KtvOpening } from "./components/ktv/KtvOpening";
import { KtvSongSelect } from "./components/ktv/KtvSongSelect";
import { KtvQueue } from "./components/ktv/KtvQueue";
import { CircularPlaylist } from "./components/home/CircularPlaylist";
import { usePlayer } from "@/hooks/usePlayer";
import { useKtvQueue } from "@/hooks/useKtvQueue";
import { useNarration } from "@/hooks/useNarration";
import { useMode } from "@/hooks/useMode";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { initKtvTransitionListener } from "@/hooks/useKtvTransition";
import { useAuthContext } from "./components/auth/AuthProvider";

const FloatingAvatar = dynamic(() => import("./components/home/FloatingAvatar").then(m => ({ default: m.FloatingAvatar })), { ssr: false });

export default function Home() {
  const [currentNarration, setCurrentNarration] = useState<string | null>(null);
  const { mode, showHall, setShowHall } = useMode();
  const { playAllSongs } = usePlaylists();
  const analyzerInit = useRef(false);
  const { isLoggedIn, isLoading, showLoginModal } = useAuthContext();

  // KTV 点歌/队列面板状态
  const [songSelectOpen, setSongSelectOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const originalNextSongRef = useRef<(() => void) | null>(null);

  // KTV 开场过渡状态
  const [showOpening, setShowOpening] = useState(false);
  const [openingDone, setOpeningDone] = useState(() => {
    // 本次会话已看过开场则跳过
    return typeof window !== "undefined" && sessionStorage.getItem("claudio-ktv-opening-seen") === "1";
  });

  // 旁白回调
  const handleNarration = useCallback((_song: unknown, narration: string) => {
    setCurrentNarration(narration);
  }, []);

  // 开始播放：加载所有歌单歌曲并随机播放
  const handleStartPlay = useCallback(async () => {
    // 未登录时直接进入播放器空状态
    if (!isLoggedIn) {
      setShowHall(false);
      return;
    }
    await playAllSongs();
    setShowHall(false);
  }, [isLoggedIn, playAllSongs, setShowHall]);

  // 注册旁白系统
  useNarration(handleNarration);

  // 进入KTV模式时初始化音频分析器和转场系统，并设置队列联动
  useEffect(() => {
    if (mode !== "ktv") {
      // 退出KTV时恢复原始 nextSong
      if (originalNextSongRef.current) {
        usePlayer.setState({
          nextSong: originalNextSongRef.current,
          onPlaylistEnd: null,
        });
        originalNextSongRef.current = null;
      }
      return;
    }

    // 保存原始 nextSong，覆盖为队列优先版本
    if (!originalNextSongRef.current) {
      originalNextSongRef.current = usePlayer.getState().nextSong;
    }
    usePlayer.setState({
      nextSong: () => {
        const next = useKtvQueue.getState().playNext();
        if (next) {
          usePlayer.getState().playSong(next);
        } else {
          originalNextSongRef.current?.();
        }
      },
      onPlaylistEnd: () => {
        const next = useKtvQueue.getState().playNext();
        if (next) {
          usePlayer.getState().playSong(next);
        }
      },
    });

    if (analyzerInit.current) return;
    initKtvTransitionListener();

    const tryInit = () => {
      const playerState = usePlayer.getState();
      if (playerState.audio) {
        useAudioAnalyzer.getState().init(playerState.audio);
        analyzerInit.current = true;
      }
    };

    // 立即尝试
    tryInit();

    // 如果还没有audio，监听变化
    if (!analyzerInit.current) {
      const unsub = usePlayer.subscribe((state) => {
        if (state.audio && !analyzerInit.current) {
          useAudioAnalyzer.getState().init(state.audio);
          analyzerInit.current = true;
          unsub();
        }
      });
      return unsub;
    }
  }, [mode]);

  // 首次进入 KTV 模式时触发开场过渡
  useEffect(() => {
    if (mode !== "ktv" || openingDone) {
      setShowOpening(false);
      return;
    }
    // 延迟一帧确保听歌模式已渲染（开场从当前画面暗下去）
    const id = requestAnimationFrame(() => setShowOpening(true));
    return () => cancelAnimationFrame(id);
  }, [mode, openingDone]);

  // 从模块页面返回时，或浏览器后退时，显示主页
  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname === "/") {
        setShowHall(true);
        // 同时重置为听歌模式
        useMode.getState().setMode("listen");
        localStorage.setItem("claudio-mode", "listen");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setShowHall]);

  // 模块页面通过 sessionStorage 标记返回主页
  useEffect(() => {
    if (sessionStorage.getItem("claudio-go-home") === "1") {
      sessionStorage.removeItem("claudio-go-home");
      setShowHall(true);
      // 同时重置为听歌模式
      useMode.getState().setMode("listen");
      localStorage.setItem("claudio-mode", "listen");
    }
  }, [setShowHall]);

  // 首次加载时，如果未登录则自动弹出登录弹窗（仅弹出一次）
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      // 检查是否已经弹出过登录弹窗
      const hasShownLogin = sessionStorage.getItem("claudio-login-modal-shown");
      if (!hasShownLogin) {
        // 延迟一下再弹出，让页面先渲染完成
        const timer = setTimeout(() => {
          showLoginModal();
          // 标记已经弹出过
          sessionStorage.setItem("claudio-login-modal-shown", "1");
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, isLoggedIn, showLoginModal]);

  return (
    <div className="relative h-full overflow-hidden">
      {/* 左上角 Logo - 仅在播放模式显示 */}
      {!showHall && !isLoading && (
        <motion.div
          className="fixed top-8 left-6 z-[70]"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h1
            className="text-xl font-bold tracking-widest uppercase"
            style={{
              fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
              color: mode === "ktv" ? "rgba(255,255,255,0.6)" : "var(--text-primary)",
              letterSpacing: "0.15em",
            }}
          >
            Claudio
          </h1>
        </motion.div>
      )}

      {/* 右上角模式切换器 - 仅在播放模式显示 */}
      {!showHall && (
        <motion.div
          className="fixed top-7 right-6 z-[60]"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <ModeSwitcher />
        </motion.div>
      )}

      {/* 音乐大厅 / 播放器切换 */}
      <AnimatePresence mode="wait">
        {showHall && mode === "listen" ? (
          <motion.div
            key="music-hall"
            className="h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <MusicHall onEnterPlayer={() => setShowHall(false)} onStartPlay={handleStartPlay} />
          </motion.div>
        ) : (
          <motion.div
            key="player"
            className="h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {mode === "listen" && !showOpening && (
              <>
                {/* 听歌模式 */}
                <SilkBackground />

                <motion.div
                  className="absolute inset-0 flex items-center justify-center z-10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <Lyrics />
                </motion.div>

                <motion.div
                  className="absolute bottom-0 left-0 right-0 z-20 p-4 sm:p-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                >
                  <Player />
                </motion.div>

                <FloatingAvatar
                  narration={currentNarration}
                  onNarrationDismiss={() => setCurrentNarration(null)}
                />

                {/* 右侧弧形歌单 */}
                <CircularPlaylist />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* KTV 开场过渡 — 覆盖在当前内容之上 */}
      {showOpening && (
        <KtvOpening
          onDone={() => {
            setShowOpening(false);
            setOpeningDone(true);
            sessionStorage.setItem("claudio-ktv-opening-seen", "1");
          }}
        />
      )}

      {/* KTV 模式 — 开场完成后渲染 */}
      {mode === "ktv" && openingDone && (
        <>
          <KtvStage />
          <KtvLyrics />
          <KtvPlayer
            onSongSelect={() => {
              // 未登录时显示登录弹窗
              if (!isLoggedIn) {
                showLoginModal();
                return;
              }
              setSongSelectOpen(true);
            }}
            onQueueToggle={() => setQueueOpen((v) => !v)}
          />
          <KtvSongSelect isOpen={songSelectOpen} onClose={() => setSongSelectOpen(false)} />
          <KtvQueue isOpen={queueOpen} onClose={() => setQueueOpen(false)} />
        </>
      )}
    </div>
  );
}
