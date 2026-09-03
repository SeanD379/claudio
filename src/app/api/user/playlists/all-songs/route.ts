import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { isUserLoggedIn, getUnauthorizedResponse } from "@/app/lib/auth";

const userId = "default-user";

export async function GET() {
  // 检查登录状态
  if (!(await isUserLoggedIn())) {
    return getUnauthorizedResponse();
  }

  try {
    const playlistSongs = await prisma.playlistSong.findMany({
      where: {
        playlist: { userId },
      },
      include: { song: true },
      distinct: ["songId"],
    });

    const songs = playlistSongs.map((ps) => ({
      id: ps.song.id,
      neteaseId: ps.song.neteaseId,
      title: ps.song.title,
      artist: ps.song.artist,
      album: ps.song.album || "",
      coverUrl: ps.song.coverUrl || "",
      duration: ps.song.duration || 0,
    }));

    return NextResponse.json({ songs });
  } catch (error) {
    console.error("Get all songs error:", error);
    return NextResponse.json(
      { error: "Failed to get all songs" },
      { status: 500 }
    );
  }
}
