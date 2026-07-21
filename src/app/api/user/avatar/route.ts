import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const userId = "default-user";

// 上传头像
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("avatar") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // 验证文件大小 (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // 确保上传目录存在
    const uploadDir = join(process.cwd(), "public", "uploads", "avatars");
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    // 生成唯一文件名（校验扩展名白名单）
    const ALLOWED_EXTS = ["jpg", "jpeg", "png", "gif", "webp"];
    const rawExt = file.name.split(".").pop()?.toLowerCase() || "png";
    const ext = ALLOWED_EXTS.includes(rawExt) ? rawExt : "png";
    const fileName = `${userId}-${Date.now()}.${ext}`;
    const filePath = join(uploadDir, fileName);

    // 保存文件
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    writeFileSync(filePath, buffer);

    // 更新数据库
    const avatarUrl = `/uploads/avatars/${fileName}`;
    await prisma.user.upsert({
      where: { id: userId },
      update: { customAvatarUrl: avatarUrl },
      create: {
        id: userId,
        customAvatarUrl: avatarUrl,
      },
    });

    return NextResponse.json({
      success: true,
      avatarUrl,
    });
  } catch (error) {
    console.error("Upload avatar error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}
