"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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

  const showLoginModal = () => setIsModalOpen(true);
  const hideLoginModal = () => setIsModalOpen(false);

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
        hideLoginModal,
      }}
    >
      {children}

      {/* 二维码登录弹窗 */}
      <QRCodeLoginModal
        isOpen={isModalOpen}
        onClose={hideLoginModal}
        onLoginSuccess={async () => {
          // 二维码登录成功时，直接设置为已登录（不等网络验证）
          // checkAuth 会在后台异步更新用户信息
          auth.checkAuth();
        }}
      />

      {/* 未登录时显示提醒横幅 */}
      {!auth.isLoading && !auth.isLoggedIn && (
        <LoginBanner onLoginClick={showLoginModal} position="top" />
      )}
    </AuthContext.Provider>
  );
}
