import { NextRequest, NextResponse } from "next/server";
import { sendChatMessage, getMIMOConfig } from "@/app/lib/mimo";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, language } = (await request.json()) as {
      message: string;
      history: ChatMessage[];
      language?: "zh" | "en";
    };

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const config = getMIMOConfig();
    const result = await sendChatMessage(config, message, history || [], language || "zh");

    return NextResponse.json({
      reply: result.reply,
      searchKeyword: result.searchKeyword,
      songs: result.songs,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
