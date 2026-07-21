"use client";

import { useState, useEffect, useCallback } from "react";

interface UserProfile {
  nickname: string;
  avatarUrl: string | null;
  userId: number | null;
}

interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: false,
    isLoading: true,
    user: null,
    error: null,
  });

  // 检查登录状态
  const checkAuth = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const res = await fetch("/api/user/profile");
      const data = await res.json();

      if (data.neteaseProfile) {
        setState({
          isLoggedIn: true,
          isLoading: false,
          user: {
            nickname: data.neteaseProfile.nickname,
            avatarUrl: data.neteaseProfile.avatarUrl,
            userId: data.neteaseProfile.userId,
          },
          error: null,
        });
      } else {
        setState({
          isLoggedIn: false,
          isLoading: false,
          user: null,
          error: null,
        });
      }
    } catch (error) {
      console.error("Check auth error:", error);
      setState({
        isLoggedIn: false,
        isLoading: false,
        user: null,
        error: "检查登录状态失败",
      });
    }
  }, []);

  // 登录成功后调用
  const onLoginSuccess = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  // 登出
  const logout = useCallback(async () => {
    try {
      await fetch("/api/netease/login/disconnect");
      setState({
        isLoggedIn: false,
        isLoading: false,
        user: null,
        error: null,
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, []);

  // 初始化时检查登录状态
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    ...state,
    checkAuth,
    onLoginSuccess,
    logout,
  };
}
