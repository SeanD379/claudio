import { NextRequest, NextResponse } from "next/server";
import {
  getSongDetail,
  getSongUrl,
  getMusicConfig,
} from "@/app/lib/music";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const songId = searchParams.get("id");

    if (!songId) {
      return NextResponse.json(
        { error: "Song ID is required" },
        { status: 400 }
      );
    }

    const config = getMusicConfig();
    const [song, audioUrl] = await Promise.all([
      getSongDetail(config, songId),
      getSongUrl(config, songId),
    ]);

    if (!song) {
      return NextResponse.json(
        { error: "Song not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...song,
      audioUrl,
    });
  } catch (error) {
    console.error("Get song error:", error);
    return NextResponse.json(
      { error: "Failed to get song" },
      { status: 500 }
    );
  }
}
