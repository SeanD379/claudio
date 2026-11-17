// NeteaseCloudMusicApi 客户端
// 本地开发：HTTP 调用 localhost:3001
// Netlify 部署：直接调用 NeteaseCloudMusicApi 包

import { getValidCookie } from "./ncm-auth";
import { prepareNcmRuntime, isNetlifyRuntime as isNetlify } from "./ncm-runtime";
import { NcmPlaylistError } from "./ncm-playlist-error";
import { loadingError, type LoadingError } from "./loading-diagnostics";

const NCM_API_BASE = process.env.NCM_API_URL || "http://localhost:3001";

// ============ 通用请求 ============

// Avoid the package entrypoint: it loads unrelated upload/cloud modules and their dependencies.
const ncmModules: Record<string, () => Promise<unknown>> = {
  "/search": () => import("NeteaseCloudMusicApi/module/search"),
  "/song/url": () => import("NeteaseCloudMusicApi/module/song_url"),
  "/song/url/v1": () => import("NeteaseCloudMusicApi/module/song_url_v1"),
  "/song/detail": () => import("NeteaseCloudMusicApi/module/song_detail"),
  "/personalized": () => import("NeteaseCloudMusicApi/module/personalized"),
  "/recommend/songs": () => import("NeteaseCloudMusicApi/module/recommend_songs"),
  "/lyric": () => import("NeteaseCloudMusicApi/module/lyric"),
};

async function ncmCall<T>(path: string, params: Record<string, string | number> = {}, signal?: AbortSignal): Promise<T> {
  if (isNetlify()) {
    prepareNcmRuntime();
    const load = ncmModules[path];
    if (!load) throw new Error("Unsupported NCM endpoint");
    const [module, requestModule] = await Promise.all([load(), import("NeteaseCloudMusicApi/util/request")]);
    const imported = module as { default?: unknown };
    const call = (imported.default ?? module) as (...args: unknown[]) => Promise<{ body: T }>;
    const result = await call(params, requestModule.default ?? requestModule);
    return result.body;
  }

  // 本地开发: HTTP 调用
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const url = `${NCM_API_BASE}${path}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://music.163.com",
    },
  });

  if (!response.ok) {
    throw Object.assign(new Error("NCM API request failed"), { status: response.status });
  }

  return response.json() as Promise<T>;
}

async function ncmCallWithCookie<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const cookie = await getValidCookie();
  if (cookie) {
    params.cookie = cookie;
  }
  return ncmCall<T>(path, params);
}

// ============ 类型定义 ============

interface NcmApiArtist {
  id: number;
  name: string;
}

interface NcmApiAlbum {
  id: number;
  name: string;
  picUrl?: string;
}

interface NcmApiSong {
  id: number;
  name: string;
  artists?: NcmApiArtist[];
  ar?: NcmApiArtist[];
  album?: NcmApiAlbum;
  al?: NcmApiAlbum;
  duration?: number;
  dt?: number;
}

interface NcmApiPlaylist {
  id: number;
  name: string;
  description?: string;
  coverImgUrl?: string;
  picUrl?: string;
  trackCount: number;
  tracks?: NcmApiSong[];
}

// ============ App 类型 ============

export interface Song {
  id: string;
  neteaseId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  songCount: number;
}

export interface LyricLine {
  time: number;
  text: string;
}

// ============ 数据映射 ============

function mapSong(song: NcmApiSong): Song {
  const artists = song.artists || song.ar || [];
  const album: NcmApiAlbum | undefined = song.album || song.al;
  const duration = song.duration || song.dt || 0;

  return {
    id: String(song.id),
    neteaseId: String(song.id),
    title: song.name,
    artist: artists.map((a) => a.name).join(" / "),
    album: album?.name || "",
    coverUrl: album?.picUrl || "",
    duration: Math.floor(duration / 1000),
  };
}

function mapPlaylist(playlist: NcmApiPlaylist): Playlist {
  return {
    id: String(playlist.id),
    name: playlist.name,
    description: playlist.description || "",
    coverUrl: playlist.coverImgUrl || playlist.picUrl || "",
    songCount: playlist.trackCount,
  };
}

// ============ 音乐 API ============

export async function searchSongs(keyword: string, limit: number = 20): Promise<Song[]> {
  const data = await ncmCall<{ result?: { songs?: NcmApiSong[] } }>("/search", {
    keywords: keyword,
    limit,
  });
  return (data.result?.songs || []).map(mapSong);
}

export async function getSongUrl(songId: string, bitrate: number = 320): Promise<string | null> {
  try {
    // VIP 歌曲需要 cookie 才能获取完整播放链接，使用 ncmCallWithCookie
    const data = await ncmCallWithCookie<{ data?: Array<{ url: string | null }> }>("/song/url", {
      id: songId,
      br: bitrate * 1000,
    });
    return data.data?.[0]?.url || null;
  } catch {
    return null;
  }
}

// Keep the legacy nullable helper above; playback uses explicit failure categories.
export async function resolveSongPlayback(songId: string, options: {
  cookie?: string;
  signal?: AbortSignal;
  onStage: (stage: string, errorCategory?: LoadingError) => void;
}): Promise<{ audioUrl: string | null; errorCategory?: LoadingError }> {
  try {
    if (isNetlify()) prepareNcmRuntime();
    const cookie = await getValidCookie(options.cookie);
    options.signal?.throwIfAborted();
    options.onStage("credentials-ready");
    options.onStage(isNetlify() ? "transport-sdk" : "transport-http");
    type UrlResponse = { code?: number; data?: Array<{ url: string | null; code?: number }> };
    let data = await ncmCall<UrlResponse>("/song/url", {
      id: songId, br: 320000, ...(cookie ? { cookie } : {}),
    }, options.signal);
    options.signal?.throwIfAborted();
    // The legacy bitrate endpoint can return no URL; v1 uses the equivalent 320 kbps quality level.
    const legacyCode = data.code === 200 ? data.data?.[0]?.code : data.code;
    if ((!data.code || data.code === 200) && legacyCode !== 301 && legacyCode !== 401 && !data.data?.[0]?.url) {
      options.onStage("url-v1-request");
      try {
        const fallback = await ncmCall<UrlResponse>("/song/url/v1", {
          id: songId, level: "exhigh", ...(cookie ? { cookie } : {}),
        }, options.signal);
        const fallbackCode = fallback.code === 200 ? fallback.data?.[0]?.code : fallback.code;
        if (fallback.data?.[0]?.url || fallbackCode === 301 || fallbackCode === 401) data = fallback;
        else options.onStage("url-v1-unavailable", "unavailable");
      } catch {
        // A failed compatibility attempt must not hide the original unavailable result.
        options.signal?.throwIfAborted();
        options.onStage("url-v1-failed", "upstream");
      }
      options.signal?.throwIfAborted();
    }
    options.onStage("upstream-ready");
    const code = data.code === 200 ? data.data?.[0]?.code : data.code;
    if (Number.isSafeInteger(code)) options.onStage(`upstream-song-${code}`, data.data?.[0]?.url ? undefined : "unavailable");
    if (code === 301 || code === 401) return { audioUrl: null, errorCategory: "auth" };
    if (data.code && data.code !== 200) return { audioUrl: null, errorCategory: "upstream" };
    const audioUrl = data.data?.[0]?.url || null;
    return { audioUrl, ...(audioUrl ? {} : { errorCategory: "unavailable" as const }) };
  } catch (error) {
    const failure = error as { status?: number; body?: { code?: number }; code?: string } | null;
    const status = failure?.body?.code ?? failure?.status;
    const moduleFailure = ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(failure?.code || "");
    const category = status === 301 || status === 401 ? "auth" : status || moduleFailure ? "upstream" : loadingError(error);
    const safeCodes = ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"];
    const code = failure?.code && safeCodes.includes(failure.code) ? failure.code : "unknown";
    options.onStage(`upstream-failed-${code}`, category);
    return { audioUrl: null, errorCategory: category };
  }
}

export async function getSongDetail(songId: string): Promise<Song | null> {
  try {
    const data = await ncmCall<{ songs?: NcmApiSong[] }>("/song/detail", { ids: songId });
    const song = data.songs?.[0];
    return song ? mapSong(song) : null;
  } catch {
    return null;
  }
}

export async function getSongDetails(songIds: string[]): Promise<Song[]> {
  if (songIds.length === 0) return [];
  try {
    const data = await ncmCall<{ songs?: NcmApiSong[] }>("/song/detail", {
      ids: songIds.join(","),
    });
    return (data.songs || []).map(mapSong);
  } catch {
    return [];
  }
}

export async function getPlaylistDetail(playlistId: string, fallbackCookie?: string): Promise<{ playlist: Playlist; songs: Song[] } | null> {
  try {
    // 本地和部署使用同一详情调用链，且不能依赖 QR 请求先初始化过实例。
    prepareNcmRuntime();
    const [playlistDetailMod, requestMod] = await Promise.all([
      import("NeteaseCloudMusicApi/module/playlist_detail"),
      import("NeteaseCloudMusicApi/util/request"),
    ]);
    const playlistDetail = (playlistDetailMod.default ?? playlistDetailMod) as (
      ...args: unknown[]
    ) => Promise<{ body: unknown }>;
    const request = (requestMod.default ?? requestMod) as (
      ...args: unknown[]
    ) => Promise<{ body: unknown }>;
    const cookie = await getValidCookie(fallbackCookie);
    const result = await playlistDetail(
      cookie ? { id: playlistId, cookie } : { id: playlistId },
      request
    );
    const data = result.body as { code?: number; playlist?: NcmApiPlaylist };
    if (data.code === 404) return null;
    if (data.code !== 200 || !data.playlist) throw new NcmPlaylistError(data.code);
    return {
      playlist: mapPlaylist(data.playlist),
      songs: (data.playlist.tracks || []).map(mapSong),
    };
  } catch (error) {
    if (error instanceof NcmPlaylistError) throw error;
    const failure = error as { code?: string; body?: { code?: number } } | null;
    const code = failure?.body?.code;
    if (code === 404) return null;
    console.warn("[NCM] Playlist request failed", { code: failure?.code, upstreamCode: code });
    throw new NcmPlaylistError(code);
  }
}

export async function getPersonalizedPlaylists(limit: number = 10): Promise<Playlist[]> {
  try {
    const data = await ncmCall<{ result?: NcmApiPlaylist[] }>("/personalized", { limit });
    return (data.result || []).map(mapPlaylist);
  } catch {
    return [];
  }
}

export async function getDailyRecommendations(): Promise<Song[]> {
  try {
    const data = await ncmCallWithCookie<{ data?: { dailySongs?: NcmApiSong[] } }>("/recommend/songs");
    return (data.data?.dailySongs || []).map(mapSong);
  } catch {
    return [];
  }
}

export async function getLyrics(songId: string): Promise<LyricLine[]> {
  try {
    const data = await ncmCall<{ lrc?: { lyric?: string } }>("/lyric", { id: songId });
    const lrc = data.lrc?.lyric;
    if (!lrc) return [];
    return parseLRC(lrc);
  } catch {
    return [];
  }
}

function parseLRC(lrc: string): LyricLine[] {
  const lines = lrc.split("\n");
  const result: LyricLine[] = [];

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, "0"), 10);
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}
