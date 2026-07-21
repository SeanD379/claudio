"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { User, Camera, Loader2, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "@/hooks/useTranslation";

interface UserProfile {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  customAvatarUrl: string | null;
}

interface NeteaseProfile {
  nickname: string;
  avatarUrl: string;
  userId: number;
}

const QR_WAITING = 801;
const QR_SCANNED = 802;
const QR_EXPIRED = 800;
const QR_SUCCESS = 803;

export default function UserProfileCard({ isLight = false }: { isLight?: boolean }) {
  const { addToast } = useToast();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [neteaseProfile, setNeteaseProfile] = useState<NeteaseProfile | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [qrKey, setQrKey] = useState("");
  const [qrImg, setQrImg] = useState("");
  const [qrStatus, setQrStatus] = useState<number | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchProfileRef = useRef<(() => Promise<boolean>) | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const fetchProfile = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setNeteaseProfile(data.neteaseProfile);
        setNickname(data.user.nickname || "");
        return !!data.neteaseProfile;
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
    return false;
  };

  fetchProfileRef.current = fetchProfile;

  const generateQr = useCallback(async () => {
    setQrLoading(true);
    setQrError("");
    setQrStatus(null);
    setQrImg("");
    setQrKey("");

    try {
      const res = await fetch("/api/netease/login/qrcode?action=generate");
      const data = await res.json();

      if (!res.ok) {
        setQrError(data.error || t("toast.qrGenerateFailed"));
        return;
      }

      setQrKey(data.key);
      setQrImg(data.qrImg);
      setQrStatus(QR_WAITING);
    } catch {
      setQrError(t("toast.qrGenerateFailedRetry"));
    } finally {
      setQrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !neteaseProfile && !qrKey && !qrLoading) {
      generateQr();
    }
  }, [loading, neteaseProfile, qrKey, qrLoading, generateQr]);

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
            addToast(t("toast.loginSuccess"), "success");
            for (let i = 0; i < 5; i++) {
              if (i > 0) await new Promise((r) => setTimeout(r, 1000));
              const ok = await fetchProfileRef.current?.();
              if (ok) break;
            }
          } else if (data.code === QR_EXPIRED) {
            clearInterval(pollTimerRef.current!);
            pollTimerRef.current = null;
          }
        } catch {
          // continue polling on network error
        }
      }, 2000);
    },
    [addToast]
  );

  useEffect(() => {
    if (qrKey && qrStatus === QR_WAITING) {
      startPolling(qrKey);
    }
  }, [qrKey, qrStatus, startPolling]);

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setProfile((prev) =>
          prev ? { ...prev, customAvatarUrl: data.avatarUrl } : null
        );
        addToast(t("toast.avatarUpdated"), "success");
      } else {
        addToast(t("toast.avatarFailed"), "error");
      }
    } catch {
      addToast(t("toast.avatarFailed"), "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveNickname = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });

      if (res.ok) {
        setProfile((prev) => (prev ? { ...prev, nickname } : null));
        setEditing(false);
        addToast(t("toast.nicknameSaved"), "success");
      } else {
        addToast(t("toast.nicknameFailed"), "error");
      }
    } catch {
      addToast(t("toast.nicknameFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectNetease = async () => {
    try {
      await fetch("/api/netease/login/disconnect", {
        method: "POST",
      });
      setNeteaseProfile(null);
      setQrKey("");
      setQrImg("");
      setQrStatus(null);
      addToast(t("toast.disconnected"), "info");
    } catch {
      addToast(t("toast.disconnectFailed"), "error");
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-6" style={{ background: isLight ? "rgba(255,255,255,0.8)" : "#181818", border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: isLight ? "#9ca3af" : "#b3b3b3" }} />
        </div>
      </div>
    );
  }

  const displayAvatar =
    profile?.customAvatarUrl || neteaseProfile?.avatarUrl || null;

  return (
    <div className="rounded-2xl p-6" style={{ background: isLight ? "rgba(255,255,255,0.8)" : "#181818", border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
      <h2
        className="text-lg font-normal mb-4"
        style={{ fontFamily: 'var(--font-display)', color: isLight ? "#1a1d26" : "#ffffff" }}
      >
        {t("profile.title")}
      </h2>

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative group">
          <div
            className="w-20 h-20 rounded-full overflow-hidden bg-surface-elevated cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-10 h-10 text-text-muted" />
              </div>
            )}

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
              {uploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="mb-3">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-1"
                  style={{ border: isLight ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.1)", background: isLight ? "#f3f4f6" : "#282828", color: isLight ? "#1a1d26" : "#ffffff" }}
                  placeholder={t("profile.enterNickname")}
                />
                <button
                  onClick={handleSaveNickname}
                  disabled={saving}
                  className="p-1.5 rounded-lg text-white transition-colors disabled:opacity-50"
                  style={{ background: "#1ed760" }}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
              </div>
            ) : (
              <p
                className="text-lg font-medium cursor-pointer transition-colors"
                style={{ color: isLight ? "#1a1d26" : "#ffffff" }}
                onClick={() => setEditing(true)}
                title={t("profile.clickToEdit")}
              >
                {profile?.nickname || t("profile.noNickname")}
              </p>
            )}
          </div>

          {/* NetEase connection status */}
          {neteaseProfile ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(30,215,96,0.1)", border: "1px solid rgba(30,215,96,0.2)" }}>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium" style={{ color: "#1ed760" }}>
                  {t("profile.connected")}
                </span>
              </div>
              <span className="text-xs" style={{ color: isLight ? "#6b7280" : "#b3b3b3" }}>
                {neteaseProfile.nickname}
              </span>
              <button
                onClick={handleDisconnectNetease}
                className="text-xs transition-colors"
                style={{ color: isLight ? "#9ca3af" : "#666" }}
              >
                {t("profile.disconnect")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: isLight ? "#f3f4f6" : "#282828", border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: isLight ? "#9ca3af" : "#666" }} />
              <span className="text-xs font-medium" style={{ color: isLight ? "#9ca3af" : "#666" }}>
                {t("profile.notConnected")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* QR code when not logged in */}
      {!neteaseProfile && (
        <div className="mt-4 pt-4" style={{ borderTop: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-sm mb-3" style={{ color: isLight ? "#6b7280" : "#b3b3b3" }}>
            {t("profile.scanLogin")}
          </p>

          {qrLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: isLight ? "#9ca3af" : "#b3b3b3" }} />
            </div>
          ) : qrError ? (
            <div className="text-center py-4">
              <p className="text-sm mb-2" style={{ color: isLight ? "#3b82f6" : "#1ed760" }}>{qrError}</p>
              <button
                onClick={generateQr}
                className="px-4 py-2 text-sm rounded-lg text-white transition-colors"
                style={{ background: isLight ? "#3b82f6" : "#1ed760" }}
              >
                {t("profile.retry")}
              </button>
            </div>
          ) : qrImg ? (
            <div className="flex flex-col items-center">
              <div className="bg-white p-3 rounded-xl mb-3">
                <img src={qrImg} alt="扫码登录" className="w-40 h-40" />
              </div>

              {qrStatus === QR_WAITING && (
                <p className="text-xs" style={{ color: isLight ? "#9ca3af" : "#666" }}>
                  {t("profile.scanHint")}
                </p>
              )}
              {qrStatus === QR_SCANNED && (
                <p className="text-xs font-medium" style={{ color: "#22c55e" }}>
                  {t("profile.scanned")}
                </p>
              )}
              {qrStatus === QR_EXPIRED && (
                <div className="flex items-center gap-2">
                  <p className="text-xs" style={{ color: isLight ? "#9ca3af" : "#666" }}>
                    {t("profile.qrExpired")}
                  </p>
                  <button
                    onClick={generateQr}
                    className="flex items-center gap-1 text-xs font-medium transition-colors"
                    style={{ color: isLight ? "#3b82f6" : "#ffffff" }}
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t("profile.refresh")}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-4 text-xs" style={{ color: isLight ? "#9ca3af" : "#666" }}>
        {neteaseProfile
          ? t("profile.editHint")
          : t("profile.loginHint")}
      </p>
    </div>
  );
}
