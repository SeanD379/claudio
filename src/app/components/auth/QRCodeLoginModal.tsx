"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface QRCodeLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

type QRStatus = "loading" | "ready" | "scanned" | "expired" | "error" | "success";

export function QRCodeLoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
}: QRCodeLoginModalProps) {
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [qrKey, setQrKey] = useState<string | null>(null);
  const [status, setStatus] = useState<QRStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // 生成二维码
  const generateQRCode = useCallback(async () => {
    try {
      setStatus("loading");
      setErrorMessage("");
      const res = await fetch("/api/netease/login/qrcode?action=generate");
      const data = await res.json();

      if (data.error) {
        setStatus("error");
        setErrorMessage(data.error);
        return;
      }

      setQrImg(data.qrImg);
      setQrKey(data.key);
      setStatus("ready");
    } catch (error) {
      console.error("Generate QR code error:", error);
      setStatus("error");
      setErrorMessage("生成二维码失败，请稍后重试");
    }
  }, []);

  // 轮询检查登录状态
  useEffect(() => {
    if (!isOpen || !qrKey || status === "expired" || status === "error" || status === "success") {
      return;
    }

    let isCleaningUp = false;

    const checkInterval = setInterval(async () => {
      if (isCleaningUp) return;

      try {
        const res = await fetch(
          `/api/netease/login/qrcode?action=check&key=${encodeURIComponent(qrKey)}`
        );
        const data = await res.json();

        console.log("QR check response:", data);
        switch (data.code) {
          case 800:
            // 二维码过期
            isCleaningUp = true;
            clearInterval(checkInterval);
            setStatus("expired");
            break;
          case 801:
            // 等待扫码，继续轮询
            break;
          case 802:
            // 已扫码等待确认
            setStatus("scanned");
            break;
          case 803:
            // 登录成功 - 立即关闭弹窗
            isCleaningUp = true;
            clearInterval(checkInterval);
            setStatus("success");
            // 立即关闭弹窗
            onClose();
            // 后台异步更新登录状态（不阻塞关闭）
            onLoginSuccess();
            break;
          default:
            break;
        }
      } catch (error) {
        console.error("Check QR status error:", error);
      }
    }, 1000); // 缩短轮询间隔到1秒，提高响应速度

    return () => {
      isCleaningUp = true;
      clearInterval(checkInterval);
    };
  }, [isOpen, qrKey, status, onLoginSuccess, onClose]);

  // 打开弹窗时生成二维码，同时重置状态
  useEffect(() => {
    if (isOpen) {
      // 重置所有状态
      setStatus("loading");
      setQrImg(null);
      setQrKey(null);
      setErrorMessage("");
      // 生成新的二维码
      generateQRCode();
    }
  }, [isOpen, generateQRCode]);

  // 刷新二维码
  const handleRefresh = () => {
    generateQRCode();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* 标题 */}
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
              扫码登录
            </h2>
            <p className="text-center text-gray-500 mb-6">
              使用网易云音乐 APP 扫码登录
            </p>

            {/* 二维码容器 */}
            <div className="relative flex items-center justify-center mb-6">
              {/* 二维码图片 */}
              <div className="relative w-64 h-64 bg-gray-100 rounded-xl overflow-hidden">
                {status === "loading" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                  </div>
                )}

                {qrImg && status !== "success" && (
                  <img
                    src={qrImg}
                    alt="登录二维码"
                    className={`w-full h-full object-contain ${
                      status === "expired" ? "opacity-50" : ""
                    }`}
                  />
                )}

                {/* 过期遮罩 */}
                {status === "expired" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80">
                    <svg
                      className="w-12 h-12 text-orange-500 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <p className="text-gray-700 font-medium">二维码已过期</p>
                  </div>
                )}

                {/* 已扫码状态 */}
                {status === "scanned" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80">
                    <svg
                      className="w-12 h-12 text-green-500 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-gray-700 font-medium">已扫码</p>
                    <p className="text-sm text-gray-500">请在手机上确认</p>
                  </div>
                )}

                {/* 登录成功状态 */}
                {status === "success" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-50">
                    <svg
                      className="w-16 h-16 text-green-500 mb-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-green-700 font-bold text-lg">登录成功！</p>
                    <p className="text-sm text-green-600">正在跳转...</p>
                  </div>
                )}
              </div>

              {/* 刷新按钮 */}
              {(status === "expired" || status === "ready") && (
                <button
                  onClick={handleRefresh}
                  className="absolute -right-2 top-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow border border-gray-200"
                  title="刷新二维码"
                >
                  <svg
                    className={`w-5 h-5 text-gray-600 ${
                      status === "expired" ? "animate-spin" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* 状态提示 */}
            <div className="text-center mb-4">
              {status === "loading" && (
                <p className="text-gray-500">正在生成二维码...</p>
              )}
              {status === "ready" && (
                <p className="text-gray-600">请使用网易云音乐 APP 扫描二维码</p>
              )}
              {status === "scanned" && (
                <p className="text-green-600 font-medium">
                  已扫描，请在手机上确认登录
                </p>
              )}
              {status === "expired" && (
                <p className="text-orange-600 font-medium">
                  二维码已过期（有效期约3分钟）
                </p>
              )}
              {status === "error" && (
                <p className="text-red-600 font-medium">{errorMessage}</p>
              )}
              {status === "success" && (
                <p className="text-green-600 font-bold">
                  登录成功！
                </p>
              )}
            </div>

            {/* 底部提示 */}
            <div className="text-center text-sm text-gray-400">
              <p>登录即代表同意相关服务条款</p>
            </div>

            {/* 分隔线 */}
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-3 text-sm text-gray-400">或</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            {/* 网页授权登录按钮 */}
            <button
              onClick={() => {
                window.location.href = "/api/netease/login/authorize";
              }}
              className="w-full py-3 rounded-xl font-medium transition-all duration-200 bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 active:scale-95"
            >
              网页授权登录
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">
              跳转到网易云音乐完成授权
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
