import { NextRequest, NextResponse } from "next/server";
import {
  getPlaylistDetail,
  getPersonalizedPlaylists,
  getDailyRecommendations,
} from "@/app/lib/music";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get("id");
    const type = searchParams.get("type") || "detail";
    const limit = parseInt(searchParams.get("limit") || "10");

    // 获取推荐歌单
    if (type === "personalized") {
      const playlists = await getPersonalizedPlaylists(limit);
      return NextResponse.json({ playlists });
    }

    // 获取每日推荐
    if (type === "daily") {
      const songs = await getDailyRecommendations();
      return NextResponse.json({ songs });
    }

    // 获取歌单详情
    if (playlistId) {
      const result = await getPlaylistDetail(playlistId);
      if (!result) {
        return NextResponse.json(
          { error: "Playlist not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Playlist ID or type is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Get playlist error:", error);
    return NextResponse.json(
      { error: "Failed to get playlist" },
      { status: 500 }
    );
  }
}
