"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { User, Camera, Loader2, Check, RefreshCw, Pencil, Unplug } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "@/hooks/useTranslation";
import MoltenMetal from "@/app/components/MoltenMetal";

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
    <div className="relative overflow-hidden rounded-[28px] p-5 text-center sm:p-6" style={{ background: isLight ? "rgba(255,255,255,0.86)" : "#121713", border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(30,215,96,0.18)", backdropFilter: "blur(20px)" }}>
      {!isLight && (
        <>
          <div aria-hidden="true" className="absolute inset-0">
            <MoltenMetal
              className="h-full w-full"
              color1="#063b20"
              color2="#1ed760"
              color3="#d9ffe8"
              speed={0.35}
              scale={4}
              detail={3}
              glow={1.6}
              coreSize={0.1}
              swirl={1}
              fold={-0.2}
              blackPoint={0.05}
              brightness={1.3}
              colorMode="molten"
              grain={true}
              grainIntensity={0.05}
              mouseInteraction={false}
              mouseStrength={0}
              opacity={1.0}
            />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(8,16,12,0.84) 0%, rgba(9,15,13,0.45) 50%, rgba(8,16,12,0.84) 100%), linear-gradient(180deg, rgba(7,16,11,0.25) 0%, rgba(10,15,12,0.54) 100%)" }} />
        </>
      )}
      <div className="pointer-events-none absolute left-1/2 top-0 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1ed760]/10 blur-3xl" />
      <div className={neteaseProfile ? "relative flex min-h-[214px] flex-col justify-center" : "relative"}>
        <div className="relative mx-auto w-20 sm:w-24">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="更换头像"
            className="group relative aspect-square w-full overflow-hidden rounded-full bg-surface-elevated ring-4 ring-[#1ed760]/20 shadow-[0_18px_40px_rgba(0,0,0,0.32)] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]"
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt="用户头像" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center"><User className="h-12 w-12 text-text-muted" /></span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
              {uploading ? <Loader2 className="h-6 w-6 animate-spin text-white" /> : <Camera className="h-6 w-6 text-white" />}
            </span>
          </button>
          <span className="pointer-events-none absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#181818] bg-[#1ed760] text-[#111111] shadow-lg"><Camera className="h-3.5 w-3.5" /></span>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>

        <div className="mt-2">
          {editing ? (
            <div className="mx-auto flex max-w-xs items-center gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="min-h-11 flex-1 rounded-xl px-3 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#1ed760]"
                style={{ border: isLight ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.1)", background: isLight ? "#f3f4f6" : "#282828", color: isLight ? "#1a1d26" : "#ffffff" }}
                placeholder={t("profile.enterNickname")}
              />
              <button onClick={handleSaveNickname} disabled={saving} aria-label="保存昵称" className="flex h-11 w-11 items-center justify-center rounded-xl text-[#111111] transition-transform hover:scale-105 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]" style={{ background: "#1ed760" }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} title={t("profile.clickToEdit")} className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]" style={{ color: isLight ? "#1a1d26" : "#ffffff" }}>
              {profile?.nickname || t("profile.noNickname")}<Pencil className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70" />
            </button>
          )}
        </div>

        {neteaseProfile ? (
          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2">
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: "rgba(30,215,96,0.1)", border: "1px solid rgba(30,215,96,0.24)" }}>
              <span className="h-2 w-2 rounded-full bg-[#1ed760] shadow-[0_0_10px_rgba(30,215,96,0.9)]" />
              <span className="text-xs font-medium" style={{ color: "#1ed760" }}>{t("profile.connected")}</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: isLight ? "#6b7280" : "#a0a0a0" }}>
              <span>网易云音乐 · {neteaseProfile.nickname}</span>
              <span aria-hidden="true" style={{ color: isLight ? "#d1d5db" : "#4a4a4a" }}>•</span>
              <button
                type="button"
                onClick={handleDisconnectNetease}
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 text-xs font-medium text-[#b6b6b6] transition-[background-color,border-color,color,transform] duration-200 hover:border-red-400/35 hover:bg-red-400/10 hover:text-red-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                <Unplug className="h-3.5 w-3.5" aria-hidden="true" />
                {t("profile.disconnect")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: isLight ? "#f3f4f6" : "#282828", border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: isLight ? "#9ca3af" : "#666" }} />
            <span className="text-xs font-medium" style={{ color: isLight ? "#9ca3af" : "#999" }}>{t("profile.notConnected")}</span>
          </div>
        )}
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

    </div>
  );
}
