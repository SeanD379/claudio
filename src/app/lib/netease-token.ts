// 网易云音乐开放平台 Token 管理
// 支持文件存储（本地开发）和数据库存储（Netlify 无服务器环境）
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";
import { ncmApiPost, ncmApiGet } from "./netease-open-api";
import type { NcmAnonymousToken, NcmQrCodeData } from "./netease-open-api";

// 复用 netease-open-api 的 getEnv
function getEnvFromLocal(key: string): string {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const k = trimmed.slice(0, eqIndex).trim();
        let v = trimmed.slice(eqIndex + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (k === key) return v;
      }
    }
  } catch { /* ignore */ }
  return process.env[key] || "";
}

const TOKEN_FILE = resolve(process.cwd(), ".netease-token.json");

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expireAt: number; // timestamp ms
  anonymousAccessToken?: string;
  anonymousExpireAt?: number;
}

let cachedToken: TokenData | null = null;

// ============ Token 存储（支持数据库和文件） ============

/**
 * 检测是否在 Netlify 环境（无服务器环境）
 */
function isNetlifyEnvironment(): boolean {
  return !!process.env.NETLIFY || !!process.env.LAMBDA_RUNTIME_DIR;
}

/**
 * 从数据库加载 token（Netlify 环境）
 */
async function loadTokenFromDB(): Promise<TokenData | null> {
  try {
    const { prisma } = await import("./db");
    const record = await prisma.tokenStore.findUnique({
      where: { id: "default" },
    });
    if (!record) return null;
    return {
      accessToken: record.accessToken,
      refreshToken: record.refreshToken,
      expireAt: record.expireAt.getTime(),
      anonymousAccessToken: record.anonymousAccessToken || undefined,
      anonymousExpireAt: record.anonymousExpireAt?.getTime(),
    };
  } catch {
    return null;
  }
}

/**
 * 保存 token 到数据库（Netlify 环境）
 */
async function saveTokenToDB(token: TokenData): Promise<void> {
  try {
    const { prisma } = await import("./db");
    await prisma.tokenStore.upsert({
      where: { id: "default" },
      update: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expireAt: new Date(token.expireAt),
        anonymousAccessToken: token.anonymousAccessToken || null,
        anonymousExpireAt: token.anonymousExpireAt
          ? new Date(token.anonymousExpireAt)
          : null,
      },
      create: {
        id: "default",
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expireAt: new Date(token.expireAt),
        anonymousAccessToken: token.anonymousAccessToken || null,
        anonymousExpireAt: token.anonymousExpireAt
          ? new Date(token.anonymousExpireAt)
          : null,
      },
    });
  } catch (error) {
    console.error("[Token] Failed to save to database:", error);
  }
}

/**
 * 删除数据库中的 token（Netlify 环境）
 */
async function deleteTokenFromDB(): Promise<void> {
  try {
    const { prisma } = await import("./db");
    await prisma.tokenStore.delete({ where: { id: "default" } });
  } catch {
    // ignore
  }
}

export function loadToken(): TokenData | null {
  if (cachedToken) return cachedToken;
  try {
    if (!existsSync(TOKEN_FILE)) return null;
    cachedToken = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
    return cachedToken;
  } catch {
    return null;
  }
}

function saveToken(token: TokenData): void {
  cachedToken = token;
  try {
    writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2), "utf-8");
  } catch {
    // 文件写入失败（Netlify 环境），忽略
  }
}

/**
 * 异步加载 token（支持数据库和文件）
 */
export async function loadTokenAsync(): Promise<TokenData | null> {
  if (cachedToken) return cachedToken;
  if (isNetlifyEnvironment()) {
    return loadTokenFromDB();
  }
  return loadToken();
}

/**
 * 异步保存 token（支持数据库和文件）
 */
export async function saveTokenAsync(token: TokenData): Promise<void> {
  cachedToken = token;
  if (isNetlifyEnvironment()) {
    await saveTokenToDB(token);
  } else {
    saveToken(token);
  }
}

export function clearTokenCache(): void {
  cachedToken = null;
}

export async function deleteTokenFile(): Promise<void> {
  cachedToken = null;
  if (isNetlifyEnvironment()) {
    await deleteTokenFromDB();
  } else {
    try {
      if (existsSync(TOKEN_FILE)) unlinkSync(TOKEN_FILE);
    } catch {
      // ignore
    }
  }
}

// ============ 匿名登录 ============

export async function getAnonymousToken(): Promise<string> {
  const existing = await loadTokenAsync();
  if (
    existing?.anonymousAccessToken &&
    existing.anonymousExpireAt &&
    existing.anonymousExpireAt > Date.now()
  ) {
    return existing.anonymousAccessToken;
  }

  const appId = getEnvFromLocal("NETEASE_APP_ID");
  if (!appId) throw new Error("Missing NETEASE_APP_ID");

  const data = await ncmApiPost<NcmAnonymousToken>(
    "/openapi/music/basic/oauth2/login/anonymous",
    { clientId: appId }
  );

  const token: TokenData = {
    ...(await loadTokenAsync()),
    accessToken: (await loadTokenAsync())?.accessToken || "",
    refreshToken: (await loadTokenAsync())?.refreshToken || "",
    expireAt: (await loadTokenAsync())?.expireAt || 0,
    anonymousAccessToken: data.accessToken,
    anonymousExpireAt: Date.now() + data.expireTime * 1000 - 60000,
  };
  await saveTokenAsync(token);

  return data.accessToken;
}

// ============ 用户 Token（二维码登录/OAuth 登录后存储） ============

export async function saveUserToken(
  accessToken: string,
  refreshToken: string,
  expireTime?: number
): Promise<void> {
  const existing = await loadTokenAsync();
  const token: TokenData = {
    accessToken,
    refreshToken,
    expireAt: Date.now() + (expireTime || 604800) * 1000 - 60000, // 默认7天，提前1分钟
    anonymousAccessToken: existing?.anonymousAccessToken,
    anonymousExpireAt: existing?.anonymousExpireAt,
  };
  await saveTokenAsync(token);
}

export async function getUserToken(): Promise<string | null> {
  const token = await loadTokenAsync();
  if (!token?.accessToken) return null;
  return token.accessToken;
}

export async function hasUserToken(): Promise<boolean> {
  const token = await loadTokenAsync();
  if (!token?.accessToken || token.accessToken.length === 0) return false;
  // 检查 token 是否过期（提前 1 分钟判断）
  if (token.expireAt && token.expireAt > 0 && Date.now() >= token.expireAt) {
    return false;
  }
  return true;
}

/**
 * 获取有效的用户 token，过期时自动尝试刷新
 */
export async function getValidToken(): Promise<string> {
  const token = await loadTokenAsync();
  if (token?.accessToken && token.accessToken.length > 0) {
    // 检查是否即将过期（提前 1 分钟）
    if (!token.expireAt || token.expireAt > Date.now() + 60000) {
      return token.accessToken;
    }
    // Token 即将过期，尝试刷新
    console.log("[Auth] Token expiring soon, attempting refresh...");
    const refreshed = await refreshUserToken();
    if (refreshed) {
      console.log("[Auth] Token refreshed successfully");
      return (await loadTokenAsync())!.accessToken;
    }
    console.log("[Auth] Token refresh failed, falling back to anonymous token");
  }
  return getAnonymousToken();
}

// ============ 二维码登录 ============

export async function getQrCode(): Promise<NcmQrCodeData> {
  // 先获取匿名 token（官方 API 要求）
  const anonymousToken = await getAnonymousToken();
  return ncmApiGet<NcmQrCodeData>(
    "/openapi/music/basic/user/oauth2/qrcodekey/get/v2",
    { type: 2, expiredKey: "300" },
    anonymousToken
  );
}

export type QrCodeStatus = "waiting" | "scanned" | "confirmed" | "expired";

/**
 * 轮询二维码状态
 * 官方端点: /openapi/music/basic/oauth2/device/login/qrcode/get
 * 需要匿名 token
 */
export async function checkQrCodeStatus(
  uniKey: string
): Promise<{ status: QrCodeStatus; accessToken?: string }> {
  try {
    const anonymousToken = await getAnonymousToken();

    const data = await ncmApiGet<{
      accessToken: {
        accessToken: string;
        refreshToken: string;
        expireTime: number;
      };
      status: number;
      msg: string;
    }>(
      "/openapi/music/basic/oauth2/device/login/qrcode/get",
      { key: uniKey, clientId: getEnvFromLocal("NETEASE_APP_ID") },
      anonymousToken
    );

    console.log("[QR] Status response:", JSON.stringify({ status: data.status, msg: data.msg }));

    // 状态码: 800=过期, 801=等待扫码, 802=授权中, 803=成功, 804=未知
    if (data.status === 800) return { status: "expired" };
    if (data.status === 801) return { status: "waiting" };
    if (data.status === 802) return { status: "scanned" };
    if (data.status === 803 && data.accessToken?.accessToken) {
      // 登录成功，保存 token
      console.log("[QR] Login success, saving token");
      await saveUserToken(
        data.accessToken.accessToken,
        data.accessToken.refreshToken,
        data.accessToken.expireTime
      );
      return { status: "confirmed", accessToken: data.accessToken.accessToken };
    }

    console.warn("[QR] Unknown status:", data.status, data.msg);
    return { status: "waiting" };
  } catch (error) {
    console.error("[QR] checkQrCodeStatus error:", error instanceof Error ? error.message : String(error));
    return { status: "waiting" };
  }
}

// ============ 用户信息 ============

export async function getUserProfile(): Promise<{
  nickname: string;
  avatarUrl: string;
  userId: string;
} | null> {
  try {
    const token = await getValidToken();
    const data = await ncmApiGet<{
      originalId: number;
      id: string;
      nickname: string;
      avatarUrl: string;
    }>("/openapi/music/basic/user/profile/get/v2", {}, token);

    return {
      nickname: data.nickname,
      avatarUrl: data.avatarUrl,
      userId: String(data.originalId),
    };
  } catch (error) {
    console.error("[Auth] getUserProfile error:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

// ============ Token 刷新 ============

export async function refreshUserToken(): Promise<boolean> {
  const token = await loadTokenAsync();
  if (!token?.refreshToken) return false;

  try {
    const data = await ncmApiPost<{
      accessToken: string;
      refreshToken: string;
      expireTime: number;
    }>("/openapi/music/basic/oauth2/token/refresh", {
      refreshToken: token.refreshToken,
    });

    await saveUserToken(data.accessToken, data.refreshToken, data.expireTime);
    return true;
  } catch {
    return false;
  }
}
