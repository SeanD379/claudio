export type LoadingError = "network" | "timeout" | "auth" | "unavailable" | "upstream" | "autoplay" | "media" | "cancelled" | "precondition";
export interface LoadingRecord {
  time: string;
  requestId: string;
  songId?: string;
  stage: string;
  elapsedMs: number;
  result: "start" | "success" | "failure" | "cancelled";
  errorCategory?: LoadingError;
  status?: number;
  size?: number;
}
const records: LoadingRecord[] = [];
export function createLoadingId(): string {
  return crypto.randomUUID();
}
export function loadingError(error: unknown): LoadingError {
  const failure = error as { name?: string; code?: string } | null;
  if (failure?.name === "TimeoutError" || failure?.code === "ETIMEDOUT" || failure?.code === "ECONNABORTED") return "timeout";
  if (failure?.name === "AbortError") return "cancelled";
  if (failure?.name === "NotAllowedError") return "autoplay";
  return "network";
}
export function recordLoading(record: Omit<LoadingRecord, "time" | "elapsedMs"> & { elapsedMs: number }): void {
  const entry: LoadingRecord = { ...record, time: new Date().toISOString(), elapsedMs: Math.round(record.elapsedMs) };
  if (typeof window !== "undefined") {
    records.push(entry);
    if (records.length > 200) records.splice(0, records.length - 200);
  }
  console.info("[loading]", JSON.stringify(entry));
}
export function loadingSnapshot(): LoadingRecord[] {
  return records.map((record) => ({ ...record }));
}
declare global {
  interface Window {
    claudioLoadingDiagnostics: {
      snapshot: typeof loadingSnapshot;
      exportJSON: () => string;
      clear: () => void;
    };
  }
}
if (typeof window !== "undefined") {
  window.claudioLoadingDiagnostics = {
    snapshot: loadingSnapshot,
    exportJSON: () => JSON.stringify(loadingSnapshot(), null, 2),
    clear: () => { records.length = 0; },
  };
}
