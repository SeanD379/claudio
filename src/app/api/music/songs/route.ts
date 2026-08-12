import { NextRequest, NextResponse } from "next/server";
import { getSongUrl, Song } from "@/app/lib/music";
import { ncmApiGet } from "@/app/lib/netease-open-api";
import { getValidToken } from "@/app/lib/netease-token";
import type { NcmSong } from "@/app/lib/netease-open-api";

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

    // 官方 API 没有批量歌曲详情端点
    // 返回基本信息，播放 URL 在播放时单独获取
    const songs: Song[] = ids.map((id) => ({
      id,
      neteaseId: id,
      title: "",
      artist: "",
      album: "",
      coverUrl: "",
      duration: 0,
    }));

    return NextResponse.json({ songs });
  } catch (error) {
    console.error("Get songs error:", error);
    return NextResponse.json(
      { error: "Failed to get songs" },
      { status: 500 }
    );
  }
}
