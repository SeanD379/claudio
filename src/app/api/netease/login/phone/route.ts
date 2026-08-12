import { NextRequest, NextResponse } from "next/server";

export async function POST() {
  // 官方开放平台 API 不支持手机号+密码登录
  // 请使用二维码扫码登录
  return NextResponse.json(
    { error: "官方 API 暂不支持手机号密码登录，请使用二维码扫码登录" },
    { status: 400 }
  );
}
