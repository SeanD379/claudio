import { NextRequest, NextResponse } from "next/server";
import { narrateSong, getMIMOConfig } from "@/app/lib/mimo";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, artist, album, language, timeContext } = body as {
      title: string;
      artist: string;
      album?: string;
      language?: "zh" | "en";
      timeContext?: string;
    };

    if (!title || !artist) {
      return NextResponse.json(
        { error: "title and artist are required" },
        { status: 400 }
      );
    }

    let config;
    try {
      config = getMIMOConfig();
    } catch {
      return NextResponse.json(
        { error: "AI service not configured (missing API keys)" },
        { status: 503 }
      );
    }

    const narration = await narrateSong(config, title, artist, album, language || "zh", timeContext);

    return NextResponse.json({ narration });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Narrate API error:", message);
    return NextResponse.json(
      { error: "Failed to generate narration", detail: message },
      { status: 500 }
    );
  }
}
