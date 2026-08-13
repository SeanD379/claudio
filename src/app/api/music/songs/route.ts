import { NextRequest, NextResponse } from "next/server";
import { getSongDetails } from "@/app/lib/music";

// 批量获取歌曲详情
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json(
        { error: "ids parameter is required" },
        { status: 400 }
      );
    }

    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ songs: [] });
    }

    const songs = await getSongDetails(ids);
    return NextResponse.json({ songs });
  } catch (error) {
    console.error("Get songs error:", error);
    return NextResponse.json(
      { error: "Failed to get songs" },
      { status: 500 }
    );
  }
}
