import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { isUserLoggedIn, getUnauthorizedResponse } from "@/app/lib/auth";

const userId = "default-user";

// 获取歌单内的歌曲
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const { id: playlistId } = await params;

    // 验证歌单属于当前用户
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
    });

    if (!playlist) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    const playlistSongs = await prisma.playlistSong.findMany({
      where: { playlistId },
      include: { song: true },
      orderBy: { addedAt: "asc" },
    });

    return NextResponse.json({
      playlist: {
        id: playlist.id,
        name: playlist.name,
        neteaseId: playlist.neteaseId,
      },
      songs: playlistSongs.map((ps) => ({
        id: ps.song.id,
        neteaseId: ps.song.neteaseId,
        title: ps.song.title,
        artist: ps.song.artist,
        album: ps.song.album || "",
        coverUrl: ps.song.coverUrl || "",
        duration: ps.song.duration || 0,
      })),
    });
  } catch (error) {
    console.error("Get playlist songs error:", error);
    return NextResponse.json(
      { error: "Failed to get playlist songs" },
      { status: 500 }
    );
  }
}
