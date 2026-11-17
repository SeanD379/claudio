// NeteaseCloudMusicApi 认证管理
// 直接调用 NeteaseCloudMusicApi 模块函数（由其请求网易云音乐服务器），
// 本地开发与 Netlify 部署均不依赖 localhost:3001 独立服务。

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";
import { compactNcmCookie } from "./ncm-session";
import { prepareNcmRuntime, isNetlifyRuntime as isNetlify } from "./ncm-runtime";

const COOKIE_FILE = resolve(process.cwd(), ".netease-cookie.json");

// 只对读取类请求的临时连接故障重试一次，鉴权错误及模块错误不重试。
async function retryNcmRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    const failure = error as { code?: string; body?: { code?: number } } | null;
    const temporary = [502, 503, 504].includes(failure?.body?.code || 0)
      || ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "ENOTFOUND", "EAI_AGAIN"].includes(failure?.code || "");
    if (!temporary) throw error;
    console.warn("[Auth] 临时连接失败，重试一次", { code: failure?.code, upstreamCode: failure?.body?.code });
    await new Promise((resolve) => setTimeout(resolve, 250));
    return read();
  }
}

/**
 * 按需加载 NeteaseCloudMusicApi 的具体模块。
 * 不加载 main.js：它会动态 require 包内全部 300+ 模块（含云盘、上传等），
 * 其传递依赖在 Netlify 上不完整，会导致 Cannot find module 'xxx'。
 * 这 5 个登录相关模块只依赖 qrcode 与包内 util（已验证）。
 */
async function loadNcm() {
  try {
    prepareNcmRuntime();

    const [qrKey, qrCreate, qrCheck, account, logoutMod, requestMod] =
      await Promise.all([
        import("NeteaseCloudMusicApi/module/login_qr_key"),
        import("NeteaseCloudMusicApi/module/login_qr_create"),
        import("NeteaseCloudMusicApi/module/login_qr_check"),
        import("NeteaseCloudMusicApi/module/user_account"),
        import("NeteaseCloudMusicApi/module/logout"),
        import("NeteaseCloudMusicApi/util/request"),
      ]);
    // 模块函数签名为 (query, request)，request 由包的 main.js 注入；
    // 直接调用时需自行提供（与 main.js 的行为一致）
    const request = (requestMod.default ?? requestMod) as (
      ...args: unknown[]
    ) => Promise<{ body: unknown }>;
    const wrap =
      (fn: (...args: unknown[]) => Promise<{ body: unknown }>) =>
      (query: Record<string, unknown>) =>
        fn(query, request);
    return {
      login_qr_key: (query: Record<string, unknown>) => retryNcmRead(() => wrap(qrKey.default ?? qrKey)(query)),
      login_qr_create: wrap(qrCreate.default ?? qrCreate),
      // SDK 的 QR 模块在 request 抛错时会引用未定义的 result。
      // 把传输失败转换为明确的失败响应，避免被误报成二维码过期。
      login_qr_check: (query: Record<string, unknown>) => (qrCheck.default ?? qrCheck)(query, async (...args: unknown[]) => {
        try {
          return await request(...args);
        } catch (error) {
          const code = (error as { body?: { code?: number } } | null)?.body?.code;
          console.warn("[Auth] QR 状态请求失败", { code });
          return {
            body: { code: code && code >= 800 && code <= 802 ? code : 502, message: "暂时无法连接网易云音乐，正在重试" },
            cookie: [],
          };
        }
      }),
      user_account: (query: Record<string, unknown>) => retryNcmRead(() => wrap(account.default ?? account)(query)),
      ncmLogout: wrap(logoutMod.default ?? logoutMod),
    };
  } catch (e) {
    throw new Error(
      `NeteaseCloudMusicApi module load failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }
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
  if (isNetlify()) {
    try {
      await saveToDb(data);
    } catch (e) {
      // 数据库不可达时降级为实例内存缓存，登录态在实例存续期内仍然有效；
      // 浏览器 Cookie 兜底由 qrcode 路由负责下发
      console.warn("[Auth] 数据库保存 Cookie 失败，降级为内存缓存:", e);
      (globalThis as { __ncmCookieCache?: CookieData }).__ncmCookieCache = data;
    }
  } else {
    saveToFile(data);
  }
}

export async function loadCookie(): Promise<CookieData | null> {
  if (cached) return cached;
  // 内存兜底缓存（数据库不可用时的降级存储）
  const mem = (globalThis as { __ncmCookieCache?: CookieData }).__ncmCookieCache;
  if (mem) {
    cached = mem;
    return cached;
  }
  if (isNetlify()) {
    try {
      cached = await loadFromDb();
    } catch (e) {
      console.warn("[Auth] 数据库读取 Cookie 失败:", e);
      cached = null;
    }
  } else {
    cached = loadFromFile();
  }
  return cached;
}

export async function deleteCookie(): Promise<void> {
  cached = null;
  delete (globalThis as { __ncmCookieCache?: CookieData }).__ncmCookieCache;
  if (isNetlify()) {
    try {
      await deleteFromDb();
    } catch {
      console.warn("[Auth] 数据库不可达，已清除当前实例登录态");
    }
  } else deleteFile();
}

export async function getValidCookie(fallback?: string): Promise<string | null> {
  // 当前浏览器刚扫码的凭证优先，不能被其他实例/旧数据库记录覆盖。
  if (fallback) return fallback;
  const data = await loadCookie();
  return data?.cookie || null;
}

export async function hasCookie(fallback?: string): Promise<boolean> {
  return !!(await getValidCookie(fallback));
}

// ============ HTTP 调用（已废弃） ============
// 原通过 httpGet 请求 localhost:3001 的独立服务，
// 现已全部改为直接调用 NeteaseCloudMusicApi 模块函数。

// ============ QR 码登录 ============

/**
 * 生成 QR 码（直接调用 NeteaseCloudMusicApi 模块函数，
 * 由其向网易云音乐服务器发起请求，本地与 Netlify 均可用）
 */
export async function generateQrCode(): Promise<{ uniKey: string; qrImg: string } | null> {
  try {
    const { login_qr_key, login_qr_create } = await loadNcm();
    // 1. 获取 QR key
    const keyRes = await login_qr_key({});
    const unikey = (keyRes.body as { data?: { unikey?: string } })?.data?.unikey;
    if (!unikey) {
      console.error("[Auth] 获取 QR key 失败:", keyRes.body);
      return null;
    }

    // 2. 创建 QR 图片
    const createRes = await login_qr_create({
      key: unikey,
      qrimg: true,
    });
    const qrimg = (createRes.body as { data?: { qrimg?: string } })?.data?.qrimg;
    if (!qrimg) {
      console.error("[Auth] 创建 QR 失败:", createRes.body);
      return null;
    }

    return { uniKey: unikey, qrImg: qrimg };
  } catch (e) {
    const errBody = (e as { body?: unknown }).body;
    console.error("[Auth] 生成 QR 码异常:", errBody ?? e);
    throw new Error(
      `NCM request failed: ${JSON.stringify(errBody ?? (e as Error).message ?? String(e))}`
    );
  }
}

/**
 * 检查 QR 码扫描状态
 */
export async function checkQrStatus(uniKey: string): Promise<{
  status: number;
  message?: string;
  profile?: { userId: number; nickname: string; avatarUrl: string } | null;
  cookie?: string;
}> {
  try {
    const { login_qr_check } = await loadNcm();
    const res = await login_qr_check({ key: uniKey });
    const body = res.body as { code?: number; message?: string; cookie?: string };
    const code = body?.code;
    if (!code || ![800, 801, 802, 803].includes(code)) {
      return { status: 502, message: "暂时无法连接网易云音乐，正在重试" };
    }

    if (code === 803 && !body.cookie) {
      return { status: 502, message: "扫码已确认，但未取得登录凭证，请重新扫码" };
    }

    // 803 = 登录成功，保存 Cookie。
    // 注意：保存失败绝不能影响登录成功的结果，这里单独隔离错误
    if (code === 803 && body.cookie) {
      const cookie = compactNcmCookie(body.cookie);
      let profile: { userId: number; nickname: string; avatarUrl: string } | null = null;
      try {
        profile = await fetchProfile(cookie);
      } catch {
        // 资料接口暂时不可达时仍保存凭证，后续请求可重试。
      }
      try {
        await saveCookie({
          cookie,
          userId: profile?.userId || 0,
          nickname: profile?.nickname || "",
          avatarUrl: profile?.avatarUrl || "",
          savedAt: Date.now(),
        });
      } catch (saveErr) {
        console.error("[Auth] 登录成功但保存 Cookie 失败（登录结果不受影响）:", saveErr);
      }
      return { status: 803, profile, cookie };
    }

    return { status: code, message: body?.message };
  } catch (e) {
    // 模块函数在非 200 状态时会抛出含 body 的错误对象
    const errBody = (e as { body?: { code?: number; message?: string } }).body;
    console.error("[Auth] 检查 QR 状态异常:", errBody ?? e);
    return { status: 502, message: "暂时无法连接网易云音乐，请稍后重试" };
  }
}

// ============ 用户资料 ============

async function fetchProfile(cookie: string): Promise<{
  userId: number;
  nickname: string;
  avatarUrl: string;
} | null> {
  try {
    const { user_account } = await loadNcm();
    const res = await user_account({ cookie });
    const body = res.body as {
      code?: number;
      profile?: { userId: number; nickname: string; avatarUrl: string };
    };
    if (body?.code === 200 && body.profile) return body.profile;
    if (body?.code === 200 || body?.code === 301 || body?.code === 401) return null;
    throw new Error("网易云资料服务暂时不可用，请稍后重试");
  } catch (e) {
    const code = (e as { body?: { code?: number } }).body?.code;
    if (code === 301 || code === 401) return null;
    console.warn("[Auth] 获取用户资料失败", { code });
    throw new Error("网易云资料服务暂时不可用，请稍后重试");
  }
}

export async function getUserProfile(fallback?: string): Promise<{
  nickname: string;
  avatarUrl: string;
  userId: number;
} | null> {
  const cookie = await getValidCookie(fallback);
  if (!cookie) return null;
  const profile = await fetchProfile(cookie);
  return profile;
}

// ============ 登出 ============

export async function logout(): Promise<void> {
  const cookie = await getValidCookie();
  if (cookie) {
    try {
      const { ncmLogout } = await loadNcm();
      await ncmLogout({ cookie });
    } catch (e) {
      const errBody = (e as { body?: unknown }).body;
      console.error("[Auth] 登出异常:", errBody ?? e);
    }
  }
  await deleteCookie();
}
