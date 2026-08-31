import { NextRequest, NextResponse } from "next/server";
import { parseHistoryDate } from "@/app/lib/music-history";
import { getOrCreateHistoryBatch } from "@/app/lib/music-history-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const historyDate = parseHistoryDate(
      searchParams.get("year"),
      searchParams.get("month"),
      searchParams.get("day"),
    );

    if (!historyDate) {
      return NextResponse.json(
        { error: "Invalid date; expected a real year/month/day" },
        { status: 400 }
      );
    }

    const historyBatch = await getOrCreateHistoryBatch(historyDate);
    return NextResponse.json(historyBatch, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Get history events error:", error);
    return NextResponse.json(
      { error: "Failed to get history events" },
      { status: 500 }
    );
  }
}
