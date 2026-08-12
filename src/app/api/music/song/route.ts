import { NextRequest, NextResponse } from "next/server";
import { getSongUrl } from "@/app/lib/music";

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

    const audioUrl = await getSongUrl(songId);

    return NextResponse.json({ audioUrl });
  } catch (error) {
    console.error("Get song error:", error);
    return NextResponse.json(
      { error: "Failed to get song" },
      { status: 500 }
    );
  }
}
