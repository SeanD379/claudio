import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { isUserLoggedIn, getUnauthorizedResponse } from "@/app/lib/auth";

// 获取某天的播放详情
export async function GET(request: NextRequest) {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format, expected YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const userId = "default-user";

    // 当天起止时间
    const startDate = new Date(date + "T00:00:00");
    const endDate = new Date(date + "T00:00:00");
    endDate.setDate(endDate.getDate() + 1);

    // 查询当天播放记录
    const records = await prisma.playRecord.findMany({
      where: {
        userId,
        playedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        song: true,
      },
      orderBy: { playedAt: "asc" },
    });

    // 统计
    const totalDuration = records.reduce(
      (sum, r) => sum + (r.duration ?? 0),
      0
    );

    // 去重歌曲（同一首歌可能听了多次）
    const uniqueSongs = new Map<string, (typeof records)[0]["song"]>();
    for (const r of records) {
      if (!uniqueSongs.has(r.song.neteaseId)) {
        uniqueSongs.set(r.song.neteaseId, r.song);
      }
    }

    // 最常听歌手
    const artistCount = new Map<string, number>();
    for (const r of records) {
      const a = r.song.artist;
      artistCount.set(a, (artistCount.get(a) || 0) + 1);
    }
    const topArtist = [...artistCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // 最常听歌曲
    const songPlayCount = new Map<string, { title: string; count: number }>();
    for (const r of records) {
      const key = r.song.neteaseId;
      const existing = songPlayCount.get(key);
      songPlayCount.set(key, { title: r.song.title, count: (existing?.count || 0) + 1 });
    }
    const topSongEntry = [...songPlayCount.values()].sort((a, b) => b.count - a.count)[0];
    const topSong = topSongEntry?.title ?? null;

    // 时段分布（北京时间 UTC+8）
    const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    for (const r of records) {
      const hour = (r.playedAt.getUTCHours() + 8) % 24;
      if (hour >= 6 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 18) timeSlots.afternoon++;
      else if (hour >= 18 && hour < 24) timeSlots.evening++;
      else timeSlots.night++;
    }

    return NextResponse.json({
      songs: Array.from(uniqueSongs.values()).map((s) => ({
        id: s.id,
        neteaseId: s.neteaseId,
        title: s.title,
        artist: s.artist,
        coverUrl: s.coverUrl,
        duration: s.duration,
      })),
      playRecords: records.map((r) => ({
        songId: r.song.neteaseId,
        playedAt: r.playedAt,
        duration: r.duration,
      })),
      totalDuration,
      songCount: uniqueSongs.size,
      playCount: records.length,
      summary: {
        playCount: records.length,
        uniqueSongCount: uniqueSongs.size,
        totalDuration,
        topArtist,
        topSong,
        timeSlots,
      },
    });
  } catch (error) {
    console.error("Get day detail error:", error);
    return NextResponse.json(
      { error: "Failed to get day detail" },
      { status: 500 }
    );
  }
}
