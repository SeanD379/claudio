// NeteaseCloudMusicApi 客户端
// 本地开发：HTTP 调用 localhost:3001
// Netlify 部署：直接调用 NeteaseCloudMusicApi 包

import { getValidCookie } from "./ncm-auth";

const NCM_API_BASE = process.env.NCM_API_URL || "http://localhost:3001";

function isNetlify(): boolean {
  return !!process.env.NETLIFY;
}

// ============ 通用请求 ============

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ncmModule: any = null;

async function getNcmModule() {
  if (!ncmModule) {
    ncmModule = await import("NeteaseCloudMusicApi");
  }
  return ncmModule;
}

async function ncmCall<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  if (isNetlify()) {
    // Netlify: 直接调用包
    const ncm = await getNcmModule();
    const funcName = path.replace(/^\//, "").replace(/\//g, "_");
    const func = ncm[funcName] || ncm.default?.[funcName];
    if (typeof func === "function") {
      const result = await func(params);
      return result as T;
    }
    throw new Error(`NCM API function not found: ${funcName}`);
  }

  // 本地开发: HTTP 调用
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const url = `${NCM_API_BASE}${path}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://music.163.com",
    },
  });

  if (!response.ok) {
    throw new Error(`NCM API error: ${response.status}`);
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
    const data = await ncmCall<{ data?: Array<{ url: string | null }> }>("/song/url", {
      id: songId,
      br: bitrate * 1000,
    });
    return data.data?.[0]?.url || null;
  } catch {
    return null;
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

export async function getPlaylistDetail(playlistId: string): Promise<{ playlist: Playlist; songs: Song[] } | null> {
  try {
    const data = await ncmCall<{ playlist?: NcmApiPlaylist }>("/playlist/detail", { id: playlistId });
    if (!data.playlist) return null;
    return {
      playlist: mapPlaylist(data.playlist),
      songs: (data.playlist.tracks || []).map(mapSong),
    };
  } catch {
    return null;
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
