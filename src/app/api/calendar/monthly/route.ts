import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { isUserLoggedIn, getUnauthorizedResponse } from "@/app/lib/auth";

// 获取月度统计数据
export async function GET(request: NextRequest) {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || "");
    const month = parseInt(searchParams.get("month") || "");

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid year or month" },
        { status: 400 }
      );
    }

    const userId = "default-user";

    // 月份起止时间
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // 查询当月所有播放记录
    const records = await prisma.playRecord.findMany({
      where: {
        userId,
        playedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        song: {
          select: { coverUrl: true },
        },
      },
      orderBy: { playedAt: "asc" },
    });

    // 按日期分组统计
    const dayMap = new Map<
      string,
      { songCount: number; totalDuration: number; coverUrls: string[] }
    >();

    for (const record of records) {
      const dateStr = record.playedAt.toISOString().slice(0, 10);
      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, { songCount: 0, totalDuration: 0, coverUrls: [] });
      }
      const day = dayMap.get(dateStr)!;
      day.songCount++;
      day.totalDuration += record.duration ?? 0;
      if (day.coverUrls.length < 4 && record.song.coverUrl) {
        day.coverUrls.push(record.song.coverUrl);
      }
    }

    // 转为数组
    const result = Array.from(dayMap.entries()).map(([date, stats]) => ({
      date,
      songCount: stats.songCount,
      totalDuration: stats.totalDuration,
      coverUrls: stats.coverUrls,
    }));

    return NextResponse.json({ records: result });
  } catch (error) {
    console.error("Get monthly stats error:", error);
    return NextResponse.json(
      { error: "Failed to get monthly stats" },
      { status: 500 }
    );
  }
}
