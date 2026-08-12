import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { isUserLoggedIn, getUnauthorizedResponse } from "@/app/lib/auth";

const userId = "default-user";

// 同步歌单（与网易云对比差异）
export async function POST(request: NextRequest) {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const { playlistId } = await request.json();

    if (!playlistId) {
      return NextResponse.json(
        { error: "playlistId is required" },
        { status: 400 }
      );
    }

    // 查找歌单
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
      include: {
        songs: {
          include: { song: true },
        },
      },
    });

    if (!playlist) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    if (!playlist.neteaseId) {
      return NextResponse.json(
        { error: "Playlist has no Netease source, cannot sync" },
        { status: 400 }
      );
    }

    // 从网易云 API 获取最新歌单详情
    const { getPlaylistDetail } = await import("@/app/lib/music");
    const detail = await getPlaylistDetail(playlist.neteaseId);

    if (!detail) {
      return NextResponse.json(
        { error: "Failed to fetch playlist from Netease" },
        { status: 502 }
      );
    }

    // 计算差异
    const currentIds = new Set(
      playlist.songs.map((ps) => ps.song.neteaseId)
    );
    const remoteIds = new Set(
      detail.songs.map((s) => s.neteaseId)
    );

    const addedSongs = detail.songs.filter(
      (s) => !currentIds.has(s.neteaseId)
    );
    const removedEntries = playlist.songs.filter(
      (ps) => !remoteIds.has(ps.song.neteaseId)
    );

    // 添加新歌曲
    for (const song of addedSongs) {
      const dbSong = await prisma.song.upsert({
        where: { neteaseId: song.neteaseId },
        update: {
          title: song.title,
          artist: song.artist,
          album: song.album,
          coverUrl: song.coverUrl,
          duration: song.duration,
        },
        create: {
          neteaseId: song.neteaseId,
          title: song.title,
          artist: song.artist,
          album: song.album,
          coverUrl: song.coverUrl,
          duration: song.duration,
        },
      });

      await prisma.playlistSong.create({
        data: {
          playlistId: playlist.id,
          songId: dbSong.id,
        },
      });
    }

    // 删除移除的歌曲
    for (const entry of removedEntries) {
      await prisma.playlistSong.delete({
        where: { id: entry.id },
      });
    }

    return NextResponse.json({
      success: true,
      added: addedSongs.length,
      removed: removedEntries.length,
      total: detail.songs.length,
    });
  } catch (error) {
    console.error("Sync playlist error:", error);
    return NextResponse.json(
      { error: "Failed to sync playlist" },
      { status: 500 }
    );
  }
}
