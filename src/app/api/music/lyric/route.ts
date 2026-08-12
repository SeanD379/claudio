import { NextRequest, NextResponse } from "next/server";
import { getLyrics } from "@/app/lib/music";

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

    const lyrics = await getLyrics(songId);

    return NextResponse.json({ lyrics });
  } catch (error) {
    console.error("Get lyrics error:", error);
    return NextResponse.json(
      { error: "Failed to get lyrics" },
      { status: 500 }
    );
  }
}
