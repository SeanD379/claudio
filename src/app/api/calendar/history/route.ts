import { NextRequest, NextResponse } from "next/server";
import musicHistory from "@/data/music-history.json";

interface HistoryEvent {
  year: number;
  event: string;
  artist?: string | null;
}

// 获取历史上的今天
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const day = searchParams.get("day");

    if (!month || !day) {
      return NextResponse.json(
        { error: "month and day are required" },
        { status: 400 }
      );
    }

    // 格式化为 MM-DD
    const key = `${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

    const events: HistoryEvent[] =
      (musicHistory as Record<string, HistoryEvent[]>)[key] ?? [];

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Get history events error:", error);
    return NextResponse.json(
      { error: "Failed to get history events" },
      { status: 500 }
    );
  }
}
