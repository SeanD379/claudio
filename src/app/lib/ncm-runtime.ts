import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

// NETLIFY is supplied during builds; AWS Lambda also identifies the deployed runtime.
export function isNetlifyRuntime(): boolean {
  return process.env.NETLIFY === "true" || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}

// SDK 的 util/request 在加载时读取此文件；每个冷启动实例都必须先准备。
export function prepareNcmRuntime(): void {
  const tokenPath = resolve(tmpdir(), "anonymous_token");
  if (!existsSync(tokenPath)) {
    writeFileSync(tokenPath, "", { encoding: "utf8", flag: "a" });
  }
}
