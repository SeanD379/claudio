// NeteaseCloudMusicApi 认证管理
// 本地开发：通过 HTTP 调用 localhost:3001 的 NeteaseCloudMusicApi 服务
// Netlify：通过 exec 调用 ncm-cli 命令（使用官方 API 认证）

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const COOKIE_FILE = resolve(process.cwd(), ".netease-cookie.json");
const NCM_API = process.env.NCM_API_URL || "http://localhost:3001";

function isNetlify(): boolean {
  return !!process.env.NETLIFY;
}

// ============ 类型 ============

interface CookieData {
  cookie: string;
  userId: number;
  nickname: string;
  avatarUrl: string;
  savedAt: number;
}

let cached: CookieData | null = null;

// ============ 存储 ============

function saveToFile(data: CookieData): void {
  cached = data;
  try {
    writeFileSync(COOKIE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[Auth] 保存 Cookie 失败:", e);
  }
}

function loadFromFile(): CookieData | null {
  if (cached) return cached;
  try {
    if (existsSync(COOKIE_FILE)) {
      cached = JSON.parse(readFileSync(COOKIE_FILE, "utf-8"));
      return cached;
    }
  } catch {
    try { unlinkSync(COOKIE_FILE); } catch {}
  }
  return null;
}

function deleteFile(): void {
  cached = null;
  try {
    if (existsSync(COOKIE_FILE)) unlinkSync(COOKIE_FILE);
  } catch {}
}

async function saveToDb(data: CookieData): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.tokenStore.upsert({
      where: { id: "netease-cookie" },
      update: { accessToken: data.cookie, refreshToken: "", expireAt: new Date(Date.now() + 86400000 * 30) },
      create: { id: "netease-cookie", accessToken: data.cookie, refreshToken: "", expireAt: new Date(Date.now() + 86400000 * 30) },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function loadFromDb(): Promise<CookieData | null> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const record = await prisma.tokenStore.findUnique({ where: { id: "netease-cookie" } });
    if (record) {
      return { cookie: record.accessToken, userId: 0, nickname: "", avatarUrl: "", savedAt: Date.now() };
    }
    return null;
  } finally {
    await prisma.$disconnect();
  }
}

async function deleteFromDb(): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.tokenStore.delete({ where: { id: "netease-cookie" } }).catch(() => {});
  } finally {
    await prisma.$disconnect();
  }
}

export async function saveCookie(data: CookieData): Promise<void> {
  cached = data;
  if (isNetlify()) await saveToDb(data);
  else saveToFile(data);
}

export async function loadCookie(): Promise<CookieData | null> {
  if (cached) return cached;
  if (isNetlify()) cached = await loadFromDb();
  else cached = loadFromFile();
  return cached;
}

export async function deleteCookie(): Promise<void> {
  cached = null;
  if (isNetlify()) await deleteFromDb();
  else deleteFile();
}

export async function getValidCookie(): Promise<string | null> {
  const data = await loadCookie();
  return data?.cookie || null;
}

export async function hasCookie(): Promise<boolean> {
  return !!(await getValidCookie());
}

// ============ HTTP 调用 ============

async function httpGet(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const url = `${NCM_API}${path}${query ? `?${query}` : ""}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`NCM API error: ${res.status}`);
  return res.json();
}

// ============ QR 码登录 ============

/**
 * 生成 QR 码
 */
export async function generateQrCode(): Promise<{ uniKey: string; qrImg: string } | null> {
  try {
    // 1. 获取 QR key
    const keyRes = (await httpGet("/login/qr/key", { timestamp: Date.now() })) as {
      data?: { code?: number; unikey?: string };
    };
    const unikey = keyRes?.data?.unikey;
    if (!unikey) {
      console.error("[Auth] 获取 QR key 失败:", keyRes);
      return null;
    }

    // 2. 创建 QR 图片
    const createRes = (await httpGet("/login/qr/create", {
      key: unikey,
      qrimg: "true",
      timestamp: Date.now(),
    })) as {
      data?: { qrimg?: string; qrurl?: string };
    };

    const qrimg = createRes?.data?.qrimg;
    if (!qrimg) {
      console.error("[Auth] 创建 QR 失败:", createRes);
      return null;
    }

    return { uniKey: unikey, qrImg: qrimg };
  } catch (e) {
    console.error("[Auth] 生成 QR 码异常:", e);
    return null;
  }
}

/**
 * 检查 QR 码扫描状态
 */
export async function checkQrStatus(uniKey: string): Promise<{
  status: number;
  message?: string;
}> {
  try {
    const res = (await httpGet("/login/qr/check", {
      key: uniKey,
      timestamp: Date.now(),
    })) as {
      code?: number;
      message?: string;
      cookie?: string;
    };

    const code = res?.code || 800;

    // 803 = 登录成功，保存 Cookie
    if (code === 803 && res.cookie) {
      const profile = await fetchProfile(res.cookie);
      await saveCookie({
        cookie: res.cookie,
        userId: profile?.userId || 0,
        nickname: profile?.nickname || "",
        avatarUrl: profile?.avatarUrl || "",
        savedAt: Date.now(),
      });
    }

    return { status: code, message: res?.message };
  } catch (e) {
    console.error("[Auth] 检查 QR 状态异常:", e);
    return { status: 800, message: "检查失败" };
  }
}

// ============ 用户资料 ============

async function fetchProfile(cookie: string): Promise<{
  userId: number;
  nickname: string;
  avatarUrl: string;
} | null> {
  try {
    const data = (await httpGet("/user/account", { cookie })) as {
      code?: number;
      profile?: { userId: number; nickname: string; avatarUrl: string };
    };
    if (data?.code === 200 && data.profile) return data.profile;
    return null;
  } catch {
    return null;
  }
}

export async function getUserProfile(): Promise<{
  nickname: string;
  avatarUrl: string;
  userId: number;
} | null> {
  const cookie = await getValidCookie();
  if (!cookie) return null;
  const profile = await fetchProfile(cookie);
  if (!profile) {
    await deleteCookie();
    return null;
  }
  return profile;
}

// ============ 登出 ============

export async function logout(): Promise<void> {
  const cookie = await getValidCookie();
  if (cookie) {
    try {
      await httpGet("/logout", { timestamp: Date.now(), cookie });
    } catch {}
  }
  await deleteCookie();
}
