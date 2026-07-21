import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

// 获取设置
export async function GET() {
  try {
    // 临时使用固定用户ID
    const userId = "default-user";

    let settings = await prisma.userSetting.findUnique({
      where: { userId },
    });

    // 如果没有设置，创建默认设置
    if (!settings) {
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId },
      });

      settings = await prisma.userSetting.create({
        data: {
          userId,
          theme: "light",
          fontSize: "medium",
          language: "zh",
        },
      });
    }

    return NextResponse.json({
      theme: settings.theme,
      fontSize: settings.fontSize,
      language: settings.language,
      narrationEnabled: settings.narrationEnabled,
      autoPlay: settings.autoPlay,
      quickSwitch: settings.quickSwitch,
      dynamicBg: settings.dynamicBg,
    });
  } catch (error: unknown) {
    console.error("Get settings error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to get settings", details: errorMessage },
      { status: 500 }
    );
  }
}

// 更新设置
export async function PUT(request: NextRequest) {
  try {
    const { theme, fontSize, language, narrationEnabled, autoPlay, quickSwitch, dynamicBg } = await request.json();

    // 临时使用固定用户ID
    const userId = "default-user";

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const settings = await prisma.userSetting.upsert({
      where: { userId },
      update: {
        theme: theme || undefined,
        fontSize: fontSize || undefined,
        language: language || undefined,
        narrationEnabled,
        autoPlay,
        quickSwitch,
        dynamicBg,
      },
      create: {
        userId,
        theme: theme || "light",
        fontSize: fontSize || "medium",
        language: language || "zh",
        narrationEnabled: narrationEnabled !== false,
        autoPlay: autoPlay !== false,
        quickSwitch: quickSwitch === true,
        dynamicBg: dynamicBg !== false,
      },
    });

    return NextResponse.json({
      theme: settings.theme,
      fontSize: settings.fontSize,
      language: settings.language,
      narrationEnabled: settings.narrationEnabled,
      autoPlay: settings.autoPlay,
      quickSwitch: settings.quickSwitch,
      dynamicBg: settings.dynamicBg,
    });
  } catch (error: unknown) {
    console.error("Update settings error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update settings", details: errorMessage },
      { status: 500 }
    );
  }
}
