"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

const QR_WAITING = 801;
const QR_SCANNED = 802;
const QR_EXPIRED = 800;
const QR_SUCCESS = 803;

interface NeteaseQrLoginProps {
  /** 登录成功回调 */
  onLoginSuccess?: () => void;
}

export default function NeteaseQrLogin({ onLoginSuccess }: NeteaseQrLoginProps) {
  const [qrKey, setQrKey] = useState("");
  const [qrImg, setQrImg] = useState("");
  const [qrStatus, setQrStatus] = useState<number | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [loginResult, setLoginResult] = useState<"success" | "error" | null>(null);
  const [loginMessage, setLoginMessage] = useState("");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateQr = useCallback(async () => {
    setQrLoading(true);
    setQrError("");
    setQrStatus(null);
    setQrImg("");
    setQrKey("");
    setLoginResult(null);
    setLoginMessage("");

    try {
      const res = await fetch("/api/netease/login/qrcode?action=generate");
      const data = await res.json();

      if (!res.ok) {
        setQrError(data.detail ? `${data.error}（${data.detail}）` : data.error || "生成二维码失败");
        return;
      }

      setQrKey(data.key);
      setQrImg(data.qrImg);
      setQrStatus(QR_WAITING);
    } catch {
      setQrError("生成二维码失败，请重试");
    } finally {
      setQrLoading(false);
    }
  }, []);

  useEffect(() => {
    generateQr();
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [generateQr]);

  const startPolling = useCallback(
    (key: string) => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }

      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/netease/login/qrcode?action=check&key=${encodeURIComponent(key)}`
          );
          const data = await res.json();

          if (!res.ok) return;

          setQrStatus(data.code);

          if (data.code === QR_SUCCESS) {
            clearInterval(pollTimerRef.current!);
            pollTimerRef.current = null;
            setLoginResult("success");
            setLoginMessage("登录成功！");
            onLoginSuccess?.();
          } else if (data.code === QR_EXPIRED) {
            clearInterval(pollTimerRef.current!);
            pollTimerRef.current = null;
          }
        } catch {
          // 网络错误继续轮询
        }
      }, 2000);
    },
    [onLoginSuccess]
  );

  useEffect(() => {
    if (qrKey && qrStatus === QR_WAITING) {
      startPolling(qrKey);
    }
  }, [qrKey, qrStatus, startPolling]);

  // 登录成功状态
  if (loginResult === "success") {
    return (
      <div className="flex flex-col items-center py-8">
        <CheckCircle2 className="w-12 h-12 mb-3" style={{ color: "#1ed760" }} />
        <p className="text-sm font-medium" style={{ color: "#1ed760" }}>{loginMessage}</p>
        <p className="text-xs mt-1" style={{ color: "#b3b3b3" }}>正在加载歌单...</p>
      </div>
    );
  }

  // 加载中
  if (qrLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#b3b3b3" }} />
      </div>
    );
  }

  // 错误状态
  if (qrError) {
    return (
      <div className="flex flex-col items-center py-6">
        <XCircle className="w-10 h-10 mb-3" style={{ color: "#f43f5e" }} />
        <p className="text-sm mb-3" style={{ color: "#f43f5e" }}>{qrError}</p>
        <button
          onClick={generateQr}
          className="px-4 py-2 text-sm rounded-lg font-medium transition-colors"
          style={{ background: "#282828", color: "#ffffff" }}
        >
          重试
        </button>
      </div>
    );
  }

  // 二维码展示
  if (qrImg) {
    return (
      <div className="flex flex-col items-center">
        <div className="p-3 rounded-xl mb-3" style={{ background: "#ffffff" }}>
          <img src={qrImg} alt="扫码登录" className="w-44 h-44" />
        </div>

        {qrStatus === QR_WAITING && (
          <p className="text-xs" style={{ color: "#b3b3b3" }}>
            打开网易云音乐 App 扫码登录
          </p>
        )}
        {qrStatus === QR_SCANNED && (
          <p className="text-xs font-medium" style={{ color: "#1ed760" }}>
            已扫码，请在手机上确认
          </p>
        )}
        {qrStatus === QR_EXPIRED && (
          <div className="flex items-center gap-2">
            <p className="text-xs" style={{ color: "#b3b3b3" }}>二维码已过期</p>
            <button
              onClick={generateQr}
              className="flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: "#ffffff" }}
            >
              <RefreshCw className="w-3 h-3" />
              刷新
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
