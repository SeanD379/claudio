import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

// 获取旁白
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const songId = searchParams.get("songId");
    const language = searchParams.get("language") || "zh";

    if (!songId) {
      return NextResponse.json({ error: "songId is required" }, { status: 400 });
    }

    // 通过 neteaseId 查找歌曲
    const song = await prisma.song.findUnique({
      where: { neteaseId: songId },
    });

    if (!song) {
      return NextResponse.json({ narration: null });
    }

    const narration = await prisma.narration.findUnique({
      where: {
        songId_language: { songId: song.id, language },
      },
    });

    return NextResponse.json({ narration: narration?.content || null });
  } catch (error) {
    console.error("Get narration error:", error);
    return NextResponse.json({ error: "Failed to get narration" }, { status: 500 });
  }
}

// 保存旁白
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { songId, content, language, context, title, artist, album, coverUrl } = body;

    if (!songId || !content) {
      return NextResponse.json({ error: "songId and content is required" }, { status: 400 });
    }

    // 先确保歌曲存在，获取 Song 表的 id
    const song = await prisma.song.upsert({
      where: { neteaseId: songId },
      update: {},
      create: {
        neteaseId: songId,
        title: title || "Unknown",
        artist: artist || "Unknown",
        album: album || null,
        coverUrl: coverUrl || null,
      },
    });

    // 用 Song 表的 id（不是 neteaseId）来保存旁白
    const narration = await prisma.narration.upsert({
      where: {
        songId_language: { songId: song.id, language: language || "zh" },
      },
      update: { content, context },
      create: { songId: song.id, content, language: language || "zh", context },
    });

    return NextResponse.json({ narration });
  } catch (error) {
    console.error("Save narration error:", error);
    return NextResponse.json({ error: "Failed to save narration" }, { status: 500 });
  }
}
