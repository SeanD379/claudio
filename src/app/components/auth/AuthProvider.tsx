"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { QRCodeLoginModal } from "./QRCodeLoginModal";
import { LoginBanner } from "./LoginBanner";
import { usePlayer } from "@/hooks/usePlayer";

interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: {
    nickname: string;
    avatarUrl: string | null;
    userId: number | null;
  } | null;
  showLoginModal: () => void;
  showLoginPrompt: () => void;
  hideLoginModal: () => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideLoginPrompt = useCallback(() => {
    setIsPromptVisible(false);
    if (promptTimer.current) {
      clearTimeout(promptTimer.current);
      promptTimer.current = null;
    }
  }, []);

  const showLoginPrompt = useCallback(() => {
    setIsPromptVisible(true);
    if (promptTimer.current) clearTimeout(promptTimer.current);
    promptTimer.current = setTimeout(hideLoginPrompt, 5000);
  }, [hideLoginPrompt]);

  const showLoginModal = useCallback(() => {
    setIsModalOpen(true);
    showLoginPrompt();
  }, [showLoginPrompt]);
  const hideLoginModal = useCallback(() => setIsModalOpen(false), []);

  useEffect(() => () => hideLoginPrompt(), [hideLoginPrompt]);

  useEffect(() => {
    if (!auth.isLoading && !auth.isLoggedIn) showLoginPrompt();
    if (auth.isLoggedIn) hideLoginPrompt();
  }, [auth.isLoading, auth.isLoggedIn, hideLoginPrompt, showLoginPrompt]);

  // 未登录时阻止播放
  useEffect(() => {
    if (!auth.isLoading) {
      if (!auth.isLoggedIn) {
        // 未登录时，注册 beforePlay 回调来阻止播放
        const beforePlay = async (_song: any) => {
          // 显示登录弹窗
          setIsModalOpen(true);
          // 抛出错误阻止播放
          throw new Error("LOGIN_REQUIRED");
        };
        usePlayer.getState().setBeforePlay(beforePlay);

        return () => {
          // 清理：移除 beforePlay 回调
          usePlayer.getState().setBeforePlay(null);
        };
      } else {
        // 已登录时，清理 beforePlay 回调
        usePlayer.getState().setBeforePlay(null);
      }
    }
  }, [auth.isLoading, auth.isLoggedIn]);

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        showLoginModal,
        showLoginPrompt,
        hideLoginModal,
      }}
    >
      {children}

      {/* 二维码登录弹窗 */}
      <QRCodeLoginModal
        isOpen={isModalOpen}
        onClose={hideLoginModal}
        onLoginSuccess={async () => {
          console.log("[Auth] QR login success, calling checkAuth...");
          await auth.checkAuth();
          console.log("[Auth] checkAuth completed, isLoggedIn:", auth.isLoggedIn);
        }}
      />

      {/* 未登录时显示提醒横幅 */}
      {!auth.isLoading && !auth.isLoggedIn && isPromptVisible && (
        <LoginBanner onLoginClick={showLoginModal} position="top" />
      )}
    </AuthContext.Provider>
  );
}
