import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { isUserLoggedIn, getUnauthorizedResponse } from "@/app/lib/auth";

// 记录播放行为
export async function POST(request: NextRequest) {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const { songId, duration, title, artist, album, coverUrl } = await request.json();

    if (!songId) {
      return NextResponse.json(
        { error: "Song ID is required" },
        { status: 400 }
      );
    }

    const userId = "default-user";

    // 确保歌曲存在，不存在则创建
    const song = await prisma.song.upsert({
      where: { neteaseId: songId.toString() },
      update: {
        ...(title && { title }),
        ...(coverUrl && { coverUrl }),
        ...(duration && { duration }),
      },
      create: {
        neteaseId: songId.toString(),
        title: title || "未知歌曲",
        artist: artist || "未知歌手",
        album: album || null,
        coverUrl: coverUrl || null,
        duration: duration || null,
      },
    });

    // 写入播放记录
    const record = await prisma.playRecord.create({
      data: {
        userId,
        songId: song.id,
        duration: duration ?? null,
      },
    });

    return NextResponse.json({ success: true, recordId: record.id });
  } catch (error) {
    console.error("Record play error:", error);
    return NextResponse.json(
      { error: "Failed to record play" },
      { status: 500 }
    );
  }
}
