"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { Player } from "./components/home/Player";
import { Lyrics } from "./components/home/Lyrics";
import { SilkBackground } from "./components/home/SilkBackground";
import { ModeSwitcher } from "./components/home/ModeSwitcher";
import { MusicHall } from "./components/home/MusicHall";
import { ConcertStage } from "./components/concert/ConcertStage";
import { ConcertLyrics } from "./components/concert/ConcertLyrics";
import { ConcertOpening } from "./components/concert/ConcertOpening";
import { CircularPlaylist } from "./components/home/CircularPlaylist";
import { usePlayer } from "@/hooks/usePlayer";
import { useMode } from "@/hooks/useMode";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { useAuthContext } from "./components/auth/AuthProvider";

const FloatingAvatar = dynamic(() => import("./components/home/FloatingAvatar").then(m => ({ default: m.FloatingAvatar })), { ssr: false });

export default function Home() {
  const { mode, showHall, setShowHall } = useMode();
  const { playAllSongs } = usePlaylists();
  const analyzerInit = useRef(false);
  const { isLoggedIn, isLoading, showLoginModal, checkAuth } = useAuthContext();

  // 演唱会开场过渡状态
  const [showOpening, setShowOpening] = useState(false);
  const [openingDone, setOpeningDone] = useState(() => {
    // 本次会话已看过开场则跳过
    return typeof window !== "undefined" && sessionStorage.getItem("claudio-concert-opening-seen") === "1";
  });

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

  // 进入演唱会模式时初始化音频分析器
  useEffect(() => {
    if (mode !== "concert") return;

    if (analyzerInit.current) return;

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

  // 首次进入演唱会模式时触发开场过渡
  useEffect(() => {
    if (mode !== "concert" || openingDone) {
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
    // 检查 OAuth 回调成功标记
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("login") === "success") {
      // OAuth 登录成功，刷新登录状态
      checkAuth();
      // 清除 URL 参数
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

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
              color: mode === "concert" ? "rgba(255,255,255,0.6)" : "var(--text-primary)",
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
            <Suspense fallback={null}>
              <MusicHall onEnterPlayer={() => setShowHall(false)} onStartPlay={handleStartPlay} />
            </Suspense>
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

                <FloatingAvatar />

                {/* 右侧弧形歌单 */}
                <CircularPlaylist />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 演唱会开场过渡 — 覆盖在当前内容之上 */}
      {showOpening && (
        <ConcertOpening
          onDone={() => {
            setShowOpening(false);
            setOpeningDone(true);
            sessionStorage.setItem("claudio-concert-opening-seen", "1");
          }}
        />
      )}

      {/* 演唱会模式 — 开场完成后渲染 */}
      {mode === "concert" && openingDone && (
        <>
          <ConcertStage />
          <ConcertLyrics />
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none">
            <div className="pointer-events-auto">
              <Player />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
