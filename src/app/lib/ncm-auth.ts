// NeteaseCloudMusicApi Cookie 认证管理
// 本地开发：文件存储 + HTTP 调用 NeteaseCloudMusicApi 服务
// Netlify 部署：Prisma 数据库存储 + 直接调用 NeteaseCloudMusicApi 包

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";

const COOKIE_FILE = resolve(process.cwd(), ".netease-cookie.json");
const NCM_API = process.env.NCM_API_URL || "http://localhost:3001";

// 判断是否为 Netlify 环境
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

// ============ 存储（自动选择文件或数据库） ============

async function saveToDb(data: CookieData): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.tokenStore.upsert({
      where: { id: "netease-cookie" },
      update: {
        accessToken: data.cookie,
        refreshToken: "",
        expireAt: new Date(Date.now() + 86400000 * 30),
      },
      create: {
        id: "netease-cookie",
        accessToken: data.cookie,
        refreshToken: "",
        expireAt: new Date(Date.now() + 86400000 * 30),
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function loadFromDb(): Promise<CookieData | null> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const record = await prisma.tokenStore.findUnique({
      where: { id: "netease-cookie" },
    });
    if (record) {
      return {
        cookie: record.accessToken,
        userId: 0,
        nickname: "",
        avatarUrl: "",
        savedAt: Date.now(),
      };
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
    await prisma.tokenStore
      .delete({ where: { id: "netease-cookie" } })
      .catch(() => {});
  } finally {
    await prisma.$disconnect();
  }
}

export async function saveCookie(data: CookieData): Promise<void> {
  cached = data;
  if (isNetlify()) {
    await saveToDb(data);
  } else {
    try {
      writeFileSync(COOKIE_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error("[Auth] 保存 Cookie 失败:", e);
    }
  }
}

export async function loadCookie(): Promise<CookieData | null> {
  if (cached) return cached;
  if (isNetlify()) {
    cached = await loadFromDb();
  } else {
    try {
      if (existsSync(COOKIE_FILE)) {
        cached = JSON.parse(readFileSync(COOKIE_FILE, "utf-8"));
      }
    } catch {
      try { unlinkSync(COOKIE_FILE); } catch {}
    }
  }
  return cached;
}

export async function deleteCookie(): Promise<void> {
  cached = null;
  if (isNetlify()) {
    await deleteFromDb();
  } else {
    try {
      if (existsSync(COOKIE_FILE)) unlinkSync(COOKIE_FILE);
    } catch {}
  }
}

export async function getValidCookie(): Promise<string | null> {
  const data = await loadCookie();
  return data?.cookie || null;
}

export async function hasCookie(): Promise<boolean> {
  return !!(await getValidCookie());
}

// ============ NeteaseCloudMusicApi 请求 ============

// 本地开发通过 HTTP 调用，Netlify 直接调用包
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ncmModule: any = null;

async function getNcmModule() {
  if (!ncmModule) {
    ncmModule = await import("NeteaseCloudMusicApi");
  }
  return ncmModule;
}

async function ncmApi(path: string, params: Record<string, string> = {}): Promise<unknown> {
  if (isNetlify()) {
    // 直接调用 NeteaseCloudMusicApi 包
    const ncm = await getNcmModule();
    const funcName = path.replace(/^\//, "").replace(/\//g, "_");
    const func = ncm[funcName] || ncm.default?.[funcName];
    if (typeof func === "function") {
      return func(params);
    }
    throw new Error(`NCM API function not found: ${funcName}`);
  }
  // 本地开发通过 HTTP 调用
  const query = new URLSearchParams(params).toString();
  const url = `${NCM_API}${path}${query ? `?${query}` : ""}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  return res.json();
}

async function ncmApiWithCookie(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const cookie = await getValidCookie();
  if (cookie) params.cookie = cookie;
  return ncmApi(path, params);
}

// ============ QR 码登录 ============

export async function generateQrCode(): Promise<{ uniKey: string; qrImg: string } | null> {
  try {
    const keyData = (await ncmApi("/login/qr/key", {
      timestamp: String(Date.now()),
    })) as { code: number; data?: { unikey: string } };

    if (keyData.code !== 200 || !keyData.data?.unikey) {
      console.error("[Auth] 获取 QR key 失败:", keyData);
      return null;
    }

    const uniKey = keyData.data.unikey;
    const createData = (await ncmApi("/login/qr/create", {
      key: uniKey,
      qrimg: "true",
      timestamp: String(Date.now()),
    })) as { code: number; data?: { qrimg: string } };

    if (createData.code !== 200) {
      console.error("[Auth] 创建 QR 失败:", createData);
      return null;
    }

    return { uniKey, qrImg: createData.data?.qrimg || "" };
  } catch (e) {
    console.error("[Auth] 生成 QR 码失败:", e);
    return null;
  }
}

export async function checkQrStatus(uniKey: string): Promise<{
  status: number;
  message?: string;
}> {
  try {
    const data = (await ncmApi("/login/qr/check", {
      key: uniKey,
      timestamp: String(Date.now()),
    })) as { code: number; cookie?: string; message?: string };

    if (data.code === 803 && data.cookie) {
      const profile = await fetchProfile(data.cookie);
      await saveCookie({
        cookie: data.cookie,
        userId: profile?.userId || 0,
        nickname: profile?.nickname || "",
        avatarUrl: profile?.avatarUrl || "",
        savedAt: Date.now(),
      });
    }

    return { status: data.code, message: data.message };
  } catch (e) {
    console.error("[Auth] 检查 QR 状态失败:", e);
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
    const data = (await ncmApi("/user/account", { cookie })) as {
      code: number;
      profile?: { userId: number; nickname: string; avatarUrl: string };
    };
    return data.code === 200 ? data.profile || null : null;
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
      await ncmApiWithCookie("/logout", { timestamp: String(Date.now()) });
    } catch {}
  }
  await deleteCookie();
}

// ============ 兼容旧 API ============

export const saveCookieSync = (data: CookieData) => {
  cached = data;
  if (!isNetlify()) {
    try {
      writeFileSync(COOKIE_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch {}
  }
};

export const loadCookieSync = (): CookieData | null => {
  if (cached) return cached;
  if (!isNetlify()) {
    try {
      if (existsSync(COOKIE_FILE)) {
        cached = JSON.parse(readFileSync(COOKIE_FILE, "utf-8"));
        return cached;
      }
    } catch {}
  }
  return null;
};

export const deleteCookieSync = () => {
  cached = null;
  if (!isNetlify()) {
    try {
      if (existsSync(COOKIE_FILE)) unlinkSync(COOKIE_FILE);
    } catch {}
  }
};

export const getCookie = () => loadCookieSync()?.cookie || null;
export const isLoggedIn = () => !!getCookie();
export const getUserInfo = () => {
  const d = loadCookieSync();
  return d ? { userId: d.userId, nickname: d.nickname, avatarUrl: d.avatarUrl } : null;
};
