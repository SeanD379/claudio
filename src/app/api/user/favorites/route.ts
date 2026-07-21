import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { isUserLoggedIn, getUnauthorizedResponse } from "@/app/lib/auth";

// 获取收藏列表
export async function GET() {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    // 临时使用固定用户ID，后续实现登录后替换
    const userId = "default-user";

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        song: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      favorites: favorites.map((fav) => ({
        id: fav.song.id,
        neteaseId: fav.song.neteaseId,
        title: fav.song.title,
        artist: fav.song.artist,
        album: fav.song.album,
        coverUrl: fav.song.coverUrl,
        duration: fav.song.duration,
        favoriteId: fav.id,
      })),
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    return NextResponse.json(
      { error: "Failed to get favorites" },
      { status: 500 }
    );
  }
}

// 添加收藏
export async function POST(request: NextRequest) {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const { songId, title, artist, album, coverUrl, duration } =
      await request.json();

    if (!songId) {
      return NextResponse.json(
        { error: "Song ID is required" },
        { status: 400 }
      );
    }

    // 临时使用固定用户ID
    const userId = "default-user";

    // 确保用户存在
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    // 确保歌曲存在
    await prisma.song.upsert({
      where: { neteaseId: songId.toString() },
      update: { title, artist, album, coverUrl, duration },
      create: {
        neteaseId: songId.toString(),
        title,
        artist,
        album,
        coverUrl,
        duration,
      },
    });

    const song = await prisma.song.findUnique({
      where: { neteaseId: songId.toString() },
    });

    if (!song) {
      throw new Error("Failed to create song");
    }

    // 添加收藏
    const favorite = await prisma.favorite.upsert({
      where: {
        userId_songId: {
          userId,
          songId: song.id,
        },
      },
      update: {},
      create: {
        userId,
        songId: song.id,
      },
    });

    return NextResponse.json({ success: true, favoriteId: favorite.id });
  } catch (error) {
    console.error("Add favorite error:", error);
    return NextResponse.json(
      { error: "Failed to add favorite" },
      { status: 500 }
    );
  }
}

// 取消收藏
export async function DELETE(request: NextRequest) {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const songId = searchParams.get("songId");

    if (!songId) {
      return NextResponse.json(
        { error: "Song ID is required" },
        { status: 400 }
      );
    }

    // 临时使用固定用户ID
    const userId = "default-user";

    const song = await prisma.song.findUnique({
      where: { neteaseId: songId },
    });

    if (song) {
      await prisma.favorite.deleteMany({
        where: {
          userId,
          songId: song.id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove favorite error:", error);
    return NextResponse.json(
      { error: "Failed to remove favorite" },
      { status: 500 }
    );
  }
}
