// 网易云音乐 API 封装
// 音乐数据功能使用 NeteaseCloudMusicApi（本地服务 :3001）
// 登录系统仍使用官方 OpenAPI（netease-open-api.ts + netease-token.ts）
import {
  searchSongs as ncmSearchSongs,
  getSongUrl as ncmGetSongUrl,
  getSongDetail as ncmGetSongDetail,
  getSongDetails as ncmGetSongDetails,
  getPlaylistDetail as ncmGetPlaylistDetail,
  getPersonalizedPlaylists as ncmGetPersonalizedPlaylists,
  getDailyRecommendations as ncmGetDailyRecommendations,
  getLyrics as ncmGetLyrics,
} from "./ncm-api";

// ============ 导出类型（保持兼容） ============

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
  time: number; // 秒
  text: string;
}

// ============ 兼容旧接口 ============

export function clearCookieCache(): void {
  // 已迁移到 token 系统，此函数保留兼容
}

// ============ 音乐 API（委托给 ncm-api） ============

/**
 * 搜索歌曲
 */
export async function searchSongs(
  keyword: string,
  limit: number = 20
): Promise<Song[]> {
  return ncmSearchSongs(keyword, limit);
}

/**
 * 获取歌曲播放 URL
 */
export async function getSongUrl(
  songId: string,
  bitrate: number = 320
): Promise<string | null> {
  return ncmGetSongUrl(songId, bitrate);
}

/**
 * 获取歌曲详情
 */
export async function getSongDetail(
  songId: string
): Promise<Song | null> {
  return ncmGetSongDetail(songId);
}

/**
 * 批量获取歌曲详情
 */
export async function getSongDetails(
  songIds: string[]
): Promise<Song[]> {
  return ncmGetSongDetails(songIds);
}

/**
 * 获取歌单详情 + 歌曲列表
 */
export async function getPlaylistDetail(
  playlistId: string,
  fallbackCookie?: string
): Promise<{ playlist: Playlist; songs: Song[] } | null> {
  return ncmGetPlaylistDetail(playlistId, fallbackCookie);
}

/**
 * 获取推荐歌单
 */
export async function getPersonalizedPlaylists(
  limit: number = 10
): Promise<Playlist[]> {
  return ncmGetPersonalizedPlaylists(limit);
}

/**
 * 获取每日推荐歌曲
 */
export async function getDailyRecommendations(): Promise<Song[]> {
  return ncmGetDailyRecommendations();
}

/**
 * 获取歌词
 */
export async function getLyrics(songId: string): Promise<LyricLine[]> {
  return ncmGetLyrics(songId);
}
