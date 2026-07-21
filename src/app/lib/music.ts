// 网易云音乐 API 封装
import { readFileSync } from "fs";
import { resolve } from "path";

interface MusicAPIConfig {
  apiUrl: string; // NeteaseCloudMusicApi 地址
  cookie?: string; // 登录 cookie
}

let cachedCookie: string | null = null;

function getCookie(): string | undefined {
  if (cachedCookie !== null) return cachedCookie || undefined;
  try {
    const cookiePath = resolve(process.cwd(), ".netease-cookie");
    cachedCookie = readFileSync(cookiePath, "utf-8").trim();
    return cachedCookie || undefined;
  } catch {
    cachedCookie = "";
    return undefined;
  }
}

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

interface NeteaseSong {
  id: number;
  name: string;
  // Search API fields
  artists?: Array<{ id: number; name: string }>;
  album?: { id: number; name: string; picUrl: string };
  duration?: number;
  // Detail API fields
  ar?: Array<{ id: number; name: string }>;
  al?: { id: number; name: string; picUrl: string };
  dt?: number;
}

interface NeteasePlaylist {
  id: number;
  name: string;
  description: string;
  coverImgUrl: string;
  picUrl?: string;
  trackCount: number;
}

function mapSong(song: NeteaseSong): Song {
  const artists = song.ar || song.artists || [];
  const album = song.al || song.album || { id: 0, name: "", picUrl: "" };
  const durationMs = song.dt || song.duration || 0;
  return {
    id: song.id.toString(),
    neteaseId: song.id.toString(),
    title: song.name,
    artist: artists.map((a) => a.name).join(" / "),
    album: album.name,
    coverUrl: album.picUrl,
    duration: Math.floor(durationMs / 1000),
  };
}

function mapPlaylist(playlist: NeteasePlaylist): Playlist {
  return {
    id: playlist.id.toString(),
    name: playlist.name,
    description: playlist.description || "",
    coverUrl: playlist.coverImgUrl,
    songCount: playlist.trackCount,
  };
}

export function clearCookieCache(): void {
  cachedCookie = null;
}

export function getMusicConfig(): MusicAPIConfig {
  const apiUrl = process.env.MUSIC_API_URL;
  if (!apiUrl) {
    throw new Error("Missing MUSIC_API_URL");
  }
  return { apiUrl, cookie: getCookie() };
}

export async function searchSongs(
  config: MusicAPIConfig,
  keyword: string,
  limit: number = 20
): Promise<Song[]> {
  const cookieParam = config.cookie ? `&cookie=${encodeURIComponent(config.cookie)}` : "";
  const response = await fetch(
    `${config.apiUrl}/search?keywords=${encodeURIComponent(keyword)}&limit=${limit}${cookieParam}`
  );

  if (!response.ok) {
    throw new Error(`Music API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.result?.songs || []).map(mapSong);
}

export async function getSongUrl(
  config: MusicAPIConfig,
  songId: string
): Promise<string | null> {
  const cookieParam = config.cookie ? `&cookie=${encodeURIComponent(config.cookie)}` : "";
  const response = await fetch(
    `${config.apiUrl}/song/url?id=${songId}${cookieParam}`
  );

  if (!response.ok) {
    throw new Error(`Music API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data?.[0]?.url || null;
}

export async function getSongDetail(
  config: MusicAPIConfig,
  songId: string
): Promise<Song | null> {
  const cookieParam = config.cookie ? `&cookie=${encodeURIComponent(config.cookie)}` : "";
  const response = await fetch(
    `${config.apiUrl}/song/detail?ids=${songId}${cookieParam}`
  );

  if (!response.ok) {
    throw new Error(`Music API error: ${response.status}`);
  }

  const data = await response.json();
  const song = data.songs?.[0];
  return song ? mapSong(song) : null;
}

export async function getPlaylistDetail(
  config: MusicAPIConfig,
  playlistId: string
): Promise<{ playlist: Playlist; songs: Song[] } | null> {
  const cookieParam = config.cookie ? `&cookie=${encodeURIComponent(config.cookie)}` : "";
  const response = await fetch(
    `${config.apiUrl}/playlist/detail?id=${playlistId}${cookieParam}`
  );

  if (!response.ok) {
    throw new Error(`Music API error: ${response.status}`);
  }

  const data = await response.json();
  const playlist = data.playlist;

  if (!playlist) return null;

  let songs = (playlist.tracks || []).map(mapSong);

  // tracks 为空时，用 /playlist/track/all 补充
  if (songs.length === 0) {
    try {
      const trackRes = await fetch(
        `${config.apiUrl}/playlist/track/all?id=${playlistId}&limit=50${cookieParam}`
      );
      if (trackRes.ok) {
        const trackData = await trackRes.json();
        songs = (trackData.songs || []).map(mapSong);
      }
    } catch { /* ignore */ }
  }

  return {
    playlist: mapPlaylist(playlist),
    songs,
  };
}

export async function getPersonalizedPlaylists(
  config: MusicAPIConfig,
  limit: number = 10
): Promise<Playlist[]> {
  const cookieParam = config.cookie ? `&cookie=${encodeURIComponent(config.cookie)}` : "";
  const response = await fetch(
    `${config.apiUrl}/personalized?limit=${limit}${cookieParam}`
  );

  if (!response.ok) {
    throw new Error(`Music API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.result || []).map((item: NeteasePlaylist) => ({
    id: item.id.toString(),
    name: item.name,
    description: item.description || "",
    coverUrl: item.picUrl || item.coverImgUrl,
    songCount: item.trackCount || 0,
  }));
}

export async function getDailyRecommendations(
  config: MusicAPIConfig
): Promise<Song[]> {
  const cookieParam = config.cookie ? `?cookie=${encodeURIComponent(config.cookie)}` : "";
  const response = await fetch(`${config.apiUrl}/recommend/songs${cookieParam}`);

  if (!response.ok) {
    throw new Error(`Music API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.data?.dailySongs || []).map(mapSong);
}

export interface LyricLine {
  time: number; // 秒
  text: string;
}

export async function getLyrics(
  config: MusicAPIConfig,
  songId: string
): Promise<LyricLine[]> {
  const cookieParam = config.cookie ? `&cookie=${encodeURIComponent(config.cookie)}` : "";
  const response = await fetch(
    `${config.apiUrl}/lyric?id=${songId}${cookieParam}`
  );

  if (!response.ok) {
    throw new Error(`Music API error: ${response.status}`);
  }

  const data = await response.json();
  const lrc = data.lrc?.lyric;

  if (!lrc) return [];

  return parseLRC(lrc);
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
