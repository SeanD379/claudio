import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/app/lib/fish-audio";

export async function POST(request: NextRequest) {
  try {
    const { text, language } = (await request.json()) as {
      text: string;
      language: "zh" | "en";
    };

    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    const audioBuffer = await synthesizeSpeech(text, language || "zh");

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return NextResponse.json(
      { error: "Failed to synthesize speech" },
      { status: 500 }
    );
  }
}
