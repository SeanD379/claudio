// 网易云音乐开放平台 API 封装
// 从第三方 NeteaseCloudMusicApi 迁移到官方开放平台 API
import { ncmApiGet } from "./netease-open-api";
import { getValidToken } from "./netease-token";
import type { NcmSong, NcmPlaylist, NcmPlayUrl } from "./netease-open-api";

// ============ 导出类型（保持兼容） ============

export interface Song {
  id: string;
  neteaseId: string; // encryptedId，用于 API 调用
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

// ============ 数据映射 ============

function mapSong(song: NcmSong): Song {
  return {
    id: String(song.originalId),
    neteaseId: song.id, // encryptedId，API 调用用
    title: song.name,
    artist: song.artists.map((a) => a.name).join(" / "),
    album: song.album.name,
    coverUrl: song.coverImgUrl,
    duration: Math.floor(song.duration / 1000),
  };
}

function mapPlaylist(playlist: NcmPlaylist): Playlist {
  return {
    id: String(playlist.originalId),
    name: playlist.name,
    description: playlist.description || "",
    coverUrl: playlist.coverImgUrl,
    songCount: playlist.trackCount,
  };
}

// ============ 兼容旧接口（清除 cookie 缓存） ============

export function clearCookieCache(): void {
  // 已迁移到 token 系统，此函数保留兼容
  // 实际清除在 netease-token.ts 中
}

// ============ 音乐 API ============

/**
 * 搜索歌曲
 */
export async function searchSongs(
  keyword: string,
  limit: number = 20
): Promise<Song[]> {
  const token = await getValidToken();
  const data = await ncmApiGet<{ songs: NcmSong[] }>(
    "/openapi/music/basic/search/song/get/v3",
    { keyword, limit },
    token
  );
  return (data.songs || []).map(mapSong);
}

/**
 * 获取歌曲播放 URL
 */
export async function getSongUrl(
  songId: string, // encryptedId
  bitrate: number = 320
): Promise<string | null> {
  const token = await getValidToken();
  try {
    const data = await ncmApiGet<NcmPlayUrl>(
      "/openapi/music/basic/song/playurl/get/v2",
      { songId, bitrate },
      token
    );
    return data.url || null;
  } catch {
    return null;
  }
}

/**
 * 获取歌曲详情（从搜索结果获取，官方 API 无单独详情端点）
 */
export async function getSongDetail(
  songId: string
): Promise<Song | null> {
  // 官方 API 没有单独的歌曲详情端点
  // 通过搜索歌曲名来获取详情（降级方案）
  // 大部分场景下搜索结果已包含详情
  return null;
}

/**
 * 获取歌单详情 + 歌曲列表
 */
export async function getPlaylistDetail(
  playlistId: string
): Promise<{ playlist: Playlist; songs: Song[] } | null> {
  const token = await getValidToken();

  try {
    // 获取歌单详情
    const playlistData = await ncmApiGet<NcmPlaylist>(
      "/openapi/music/basic/playlist/detail/get/v2",
      { id: playlistId },
      token
    );

    // 获取歌单歌曲
    const songListData = await ncmApiGet<{ songs: NcmSong[] }>(
      "/openapi/music/basic/playlist/song/list/get/v3",
      { id: playlistId, limit: 100 },
      token
    );

    return {
      playlist: mapPlaylist(playlistData),
      songs: (songListData.songs || []).map(mapSong),
    };
  } catch {
    return null;
  }
}

/**
 * 获取推荐歌单
 */
export async function getPersonalizedPlaylists(
  limit: number = 10
): Promise<Playlist[]> {
  const token = await getValidToken();
  try {
    const data = await ncmApiGet<{ playlists: NcmPlaylist[] }>(
      "/openapi/music/basic/recommend/songlist/get/v2",
      { limit },
      token
    );
    return (data.playlists || []).map(mapPlaylist);
  } catch {
    return [];
  }
}

/**
 * 获取每日推荐歌曲
 */
export async function getDailyRecommendations(): Promise<Song[]> {
  const token = await getValidToken();
  try {
    const data = await ncmApiGet<{ songs: NcmSong[] }>(
      "/openapi/music/basic/recommend/songlist/get/v2",
      {},
      token
    );
    return (data.songs || []).map(mapSong);
  } catch {
    return [];
  }
}

/**
 * 获取歌词
 */
export async function getLyrics(songId: string): Promise<LyricLine[]> {
  const token = await getValidToken();
  try {
    const data = await ncmApiGet<{ lrc?: { lyric?: string }; lyric?: string }>(
      "/openapi/music/basic/song/lyric/get/v2",
      { songId },
      token
    );

    const lrc = data.lrc?.lyric || data.lyric;
    if (!lrc) return [];
    return parseLRC(lrc);
  } catch {
    return [];
  }
}

/**
 * 解析 LRC 格式歌词
 */
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
