import { NextRequest, NextResponse } from "next/server";
import { getMusicConfig, getSongDetail, Song } from "@/app/lib/music";

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

    const config = getMusicConfig();

    // 批量获取歌曲详情
    const songs = await Promise.all(
      ids.map(async (id): Promise<Song | null> => {
        try {
          return await getSongDetail(config, id);
        } catch {
          return null;
        }
      })
    );

    return NextResponse.json({
      songs: songs.filter(Boolean),
    });
  } catch (error) {
    console.error("Get songs error:", error);
    return NextResponse.json(
      { error: "Failed to get songs" },
      { status: 500 }
    );
  }
}
