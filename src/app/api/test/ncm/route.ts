import { NextResponse } from "next/server";

export async function GET() {
  const isNetlify = !!process.env.NETLIFY;
  const diagnostics: Record<string, unknown> = {
    isNetlify,
    nodeEnv: process.env.NODE_ENV,
    timestamp: Date.now(),
  };

  try {
    if (isNetlify) {
      // 测试直接调用 NeteaseCloudMusicApi
      const ncm = await import("NeteaseCloudMusicApi");
      const funcName = "login_qr_key";
      const func = ncm[funcName] || ncm.default?.[funcName];

      diagnostics.ncmModuleAvailable = !!ncm;
      diagnostics.ncmModuleKeys = Object.keys(ncm).slice(0, 10);
      diagnostics.defaultExport = !!ncm.default;
      diagnostics.defaultKeys = ncm.default ? Object.keys(ncm.default).slice(0, 10) : [];

      if (typeof func === "function") {
        const result = await func({ timestamp: Date.now() });
        diagnostics.functionResult = {
          hasResult: !!result,
          resultKeys: result ? Object.keys(result) : [],
          status: result?.status,
          hasBody: !!result?.body,
          bodySample: JSON.stringify(result?.body).substring(0, 200),
        };
      } else {
        diagnostics.functionNotFound = true;
        diagnostics.availableFunctions = Object.keys(ncm).filter(k =>
          k.includes("login") || k.includes("qr")
        );
      }
    } else {
      // 本地开发环境，测试 HTTP 调用
      const res = await fetch("http://localhost:3001/login/qr/key?timestamp=" + Date.now());
      const data = await res.json();
      diagnostics.localApiTest = {
        status: res.status,
        dataSample: JSON.stringify(data).substring(0, 200),
      };
    }
  } catch (e) {
    diagnostics.error = e instanceof Error ? e.message : String(e);
    diagnostics.errorStack = e instanceof Error ? e.stack?.substring(0, 500) : undefined;
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
