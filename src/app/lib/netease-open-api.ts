// 网易云音乐开放平台 API 客户端
// 基于 RSA-SHA256 签名认证
import { createSign } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const BASE_URL = "http://openapi.music.163.com";

// 设备信息（云音乐CLI版应用）
// 根据官方文档：channel/os/brand/deviceType 需线下联系网易确认
// 使用最小化参数集，减少校验失败可能
const DEFAULT_DEVICE = {
  deviceType: "andrcar",
  os: "andrcar",
  appVer: "6.0.0",
  channel: "netease",
  model: "GDI-W09",
  deviceId: "claudio001",
  brand: "netease",
  osVer: "14",
  clientIp: "127.0.0.1",
  netStatus: "wifi",
  flowFlag: "init",
};

// 直接从 .env.local 读取环境变量（确保加载）
function loadEnvLocal(): Record<string, string> {
  const envLocal: Record<string, string> = {};
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    console.log("loadEnvLocal: checking path:", envPath);
    console.log("loadEnvLocal: file exists:", existsSync(envPath));
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      console.log("loadEnvLocal: file content length:", content.length);
      console.log("loadEnvLocal: ALL LINES (keys only):");
      for (const line of content.split("\n")) {
        const eqIndex = line.indexOf("=");
        if (eqIndex !== -1) {
          console.log("  KEY:", line.slice(0, eqIndex).trim());
        }
      }
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        // 去掉引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        envLocal[key] = value;
      }
      console.log("loadEnvLocal: parsed keys:", Object.keys(envLocal));
    }
  } catch (e) {
    console.error("loadEnvLocal error:", e);
  }
  return envLocal;
}

let _envCache: Record<string, string> | null = null;
function getEnv(key: string): string {
  // 优先从 process.env 读取
  if (process.env[key]) return process.env[key]!;
  // 否则从 .env.local 文件读取
  if (!_envCache) _envCache = loadEnvLocal();
  return _envCache[key] || "";
}

function getAppId(): string {
  const appId = getEnv("NETEASE_APP_ID");
  if (!appId) throw new Error("Missing NETEASE_APP_ID");
  return appId;
}

function getAppSecret(): string {
  const appSecret = getEnv("NETEASE_APP_SECRET");
  if (!appSecret) throw new Error("Missing NETEASE_APP_SECRET");
  return appSecret;
}

function getPrivateKey(): string {
  const key = getEnv("NETEASE_PRIVATE_KEY");
  if (!key) throw new Error("Missing NETEASE_PRIVATE_KEY");

  // 自动补全 PEM 格式
  let pem = key.replace(/\\n/g, "\n").trim();

  // 如果没有 PEM 头尾，自动添加
  if (!pem.includes("-----BEGIN")) {
    // 每64个字符换行
    const lines = pem.match(/.{1,64}/g) || [];
    pem = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
  }

  return pem;
}

/**
 * RSA-SHA256 签名
 * 1. 过滤 sign/null/undefined/空值
 * 2. 按 key 字母排序
 * 3. 拼接为 key=value 对
 * 4. RSA-SHA256 签名，输出 base64
 */
function signRequest(params: Record<string, string>): string {
  const signingString = Object.keys(params)
    .filter(
      (key) =>
        key !== "sign" &&
        params[key] !== null &&
        params[key] !== undefined &&
        params[key] !== ""
    )
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const sign = createSign("RSA-SHA256");
  sign.update(signingString);
  sign.end();
  return sign.sign(getPrivateKey(), "base64");
}

/**
 * 构造公共请求参数
 */
function buildCommonParams(
  bizContent: Record<string, unknown>,
  accessToken?: string
): Record<string, string> {
  const deviceJson = JSON.stringify(DEFAULT_DEVICE);
  const bizContentJson = JSON.stringify(bizContent);

  const params: Record<string, string> = {
    appId: getAppId(),
    signType: "RSA_SHA256",
    timestamp: String(Date.now()),
    device: deviceJson,
    bizContent: bizContentJson,
    appSecret: getAppSecret(),
  };

  if (accessToken) {
    params.accessToken = accessToken;
  }

  // 对需要签名的参数进行签名（排除 sign 本身）
  const paramsToSign = { ...params };
  delete paramsToSign.sign;
  params.sign = signRequest(paramsToSign);
  return params;
}

/**
 * 判断是否为 token 相关错误（需要刷新重试）
 */
function isTokenError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  // 常见的 token 过期/无效错误码
  return (
    msg.includes("code: 301") || // token expired
    msg.includes("code: 302") || // invalid token
    msg.includes("code: 303") || // token invalid
    msg.includes("code: 401") || // unauthorized
    msg.includes("unauthorized") ||
    msg.includes("token") && msg.includes("expired")
  );
}

/**
 * GET 请求（带 token 过期自动刷新重试）
 */
export async function ncmApiGet<T = unknown>(
  path: string,
  bizContent: Record<string, unknown>,
  accessToken?: string
): Promise<T> {
  return _ncmApiGetInternal<T>(path, bizContent, accessToken, false);
}

async function _ncmApiGetInternal<T = unknown>(
  path: string,
  bizContent: Record<string, unknown>,
  accessToken: string | undefined,
  isRetry: boolean
): Promise<T> {
  const params = buildCommonParams(bizContent, accessToken);
  const query = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}?${query}`;
  console.log("NCM API GET URL:", url.slice(0, 300) + "...");
  console.log("NCM API GET params:", JSON.stringify({ ...params, sign: params.sign?.slice(0, 20) + "..." }));

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://music.163.com",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("NCM API HTTP error:", response.status, text);
    throw new Error(`NCM API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    const errMsg = `NCM API error: ${data.code} - ${data.message || data.msg}`;
    console.error("NCM API response error:", errMsg);

    // Token 相关错误且未重试过 → 尝试刷新 token 后重试
    if (!isRetry && isTokenError(errMsg) && accessToken) {
      console.log("[NCM API] Token error detected, attempting refresh and retry...");
      const { refreshUserToken } = await import("./netease-token");
      const newToken = await getValidTokenForRefresh();
      if (newToken && newToken !== accessToken) {
        return _ncmApiGetInternal<T>(path, bizContent, newToken, true);
      }
    }

    throw new Error(errMsg);
  }

  return data.data as T;
}

/**
 * POST 请求（带 token 过期自动刷新重试）
 */
export async function ncmApiPost<T = unknown>(
  path: string,
  bizContent: Record<string, unknown>,
  accessToken?: string
): Promise<T> {
  return _ncmApiPostInternal<T>(path, bizContent, accessToken, false);
}

async function _ncmApiPostInternal<T = unknown>(
  path: string,
  bizContent: Record<string, unknown>,
  accessToken: string | undefined,
  isRetry: boolean
): Promise<T> {
  const params = buildCommonParams(bizContent, accessToken);

  console.log("[NCM POST]", path);
  console.log("[NCM POST] device:", params.device);
  console.log("[NCM POST] bizContent:", params.bizContent);

  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      Referer: "https://music.163.com",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[NCM POST] HTTP error:", response.status, errText);
    throw new Error(`NCM API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("[NCM POST] Full response:", JSON.stringify(data, null, 2));

  if (data.code !== 200) {
    const errMsg = `NCM API error: ${data.code} - ${data.message || data.msg}`;
    console.error("NCM API response error:", errMsg);

    // Token 相关错误且未重试过 → 尝试刷新 token 后重试
    if (!isRetry && isTokenError(errMsg) && accessToken) {
      console.log("[NCM API] Token error detected, attempting refresh and retry...");
      const newToken = await getValidTokenForRefresh();
      if (newToken && newToken !== accessToken) {
        return _ncmApiPostInternal<T>(path, bizContent, newToken, true);
      }
    }

    throw new Error(errMsg);
  }

  return data.data as T;
}

/**
 * 获取刷新后的 token（动态导入避免循环依赖）
 */
async function getValidTokenForRefresh(): Promise<string | null> {
  try {
    const { refreshUserToken, loadToken } = await import("./netease-token");
    const refreshed = await refreshUserToken();
    if (refreshed) {
      const token = loadToken();
      return token?.accessToken || null;
    }
  } catch (e) {
    console.error("[NCM API] Token refresh failed:", e);
  }
  return null;
}

// ============ 官方 API 类型定义 ============

export interface NcmSong {
  originalId: number;
  id: string; // encryptedId
  name: string;
  duration: number;
  artists: Array<{
    originalId: number;
    id: string;
    name: string;
    coverImgUrl: string | null;
  }>;
  album: {
    originalId: number;
    id: string;
    name: string;
  };
  coverImgUrl: string;
  playFlag: boolean;
  downloadFlag: boolean;
  vipFlag: boolean;
  liked: boolean;
  songMaxBr: number;
  maxBrLevel: string;
}

export interface NcmPlaylist {
  originalId: number;
  id: string;
  name: string;
  coverImgUrl: string;
  trackCount: number;
  playCount: number;
  description?: string;
  creator?: {
    originalId: number;
    nickname: string;
    avatarUrl: string;
  };
}

export interface NcmPlayUrl {
  url: string | null;
  size: number;
  md5: string | null;
  br: number;
  effects: string | null;
  privateCloudSong: boolean;
  level: string;
  freeTrail?: {
    start: number;
    end: number;
  };
}

export interface NcmUserProfile {
  originalId: number;
  id: string;
  nickname: string;
  avatarUrl: string;
  signature: string;
  vipDetail?: Array<{
    type: number;
    expireTime: number;
  }>;
}

export interface NcmQrCodeData {
  qrCodeUrl: string;
  uniKey: string;
}

export interface NcmAnonymousToken {
  accessToken: string;
  refreshToken: string;
  expireTime: number;
  scopes: unknown;
}
