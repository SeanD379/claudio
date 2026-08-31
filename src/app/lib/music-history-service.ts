import { Prisma } from "@prisma/client";
import musicHistory from "@/data/music-history.json";
import { prisma } from "@/app/lib/db";
import {
  allocateUnseenCandidates,
  buildLocalCandidates,
  parseMusicHistoryWikitext,
  type HistoryCandidate,
  type LocalHistoryEvent,
  type ParsedHistoryDate,
} from "@/app/lib/music-history";

const BATCH_SIZE = 3;
const MAX_P2002_RETRIES = 2;
const WIKIMEDIA_TIMEOUT_MS = 8000;

export interface HistoryApiEvent {
  year: number;
  event: string;
  artist: string | null;
  sourceUrl: string | null;
}

export interface HistoryBatchResult {
  events: HistoryApiEvent[];
  source: "wikimedia" | "local" | "stored";
  saved: boolean;
  exhausted: boolean;
}

interface WikimediaResponse {
  query?: {
    pages?: Array<{
      revisions?: Array<{
        slots?: {
          main?: {
            content?: string;
          };
        };
      }>;
    }>;
  };
}

type HistoryEventRecord = {
  eventYear: number;
  event: string;
  artist: string | null;
  sourceUrl: string | null;
};

export async function getOrCreateHistoryBatch(
  date: ParsedHistoryDate,
): Promise<HistoryBatchResult> {
  const stored = await readStoredBatch(date.monthDay, date.displayYear);
  if (stored.length > 0) {
    return toResult(stored, "stored", true, false);
  }

  let source: HistoryBatchResult["source"] = "wikimedia";
  let candidates: HistoryCandidate[] = [];

  try {
    candidates = await fetchWikimediaCandidates(date);
  } catch (error) {
    console.error(
      "Fetch Wikimedia history failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  }

  if (candidates.length === 0) {
    candidates = buildLocalCandidates(
      date.monthDay,
      (musicHistory as Record<string, LocalHistoryEvent[]>)[date.monthDay] ?? [],
    );
    source = "local";
  }

  let usedEntries = await prisma.musicHistoryEntry.findMany({
    where: { monthDay: date.monthDay },
    select: { fingerprint: true },
  });
  const usedFingerprints = new Set(
    usedEntries.map((entry) => entry.fingerprint),
  );
  let batch = allocateUnseenCandidates(
    candidates,
    usedFingerprints,
    BATCH_SIZE,
  );

  if (batch.length === 0 && source === "wikimedia") {
    candidates = buildLocalCandidates(
      date.monthDay,
      (musicHistory as Record<string, LocalHistoryEvent[]>)[date.monthDay] ?? [],
    );
    source = "local";
    batch = allocateUnseenCandidates(candidates, usedFingerprints, BATCH_SIZE);
  }

  if (batch.length === 0) {
    return toResult([], source, false, true);
  }

  for (let retries = 0; ; retries += 1) {
    try {
      await saveBatch(date, batch);
      break;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }

      const concurrentBatch = await readStoredBatch(date.monthDay, date.displayYear);
      if (concurrentBatch.length > 0) {
        return toResult(concurrentBatch, "stored", true, false);
      }

      if (retries >= MAX_P2002_RETRIES) {
        throw error;
      }

      usedEntries = await prisma.musicHistoryEntry.findMany({
        where: { monthDay: date.monthDay },
        select: { fingerprint: true },
      });
      batch = allocateUnseenCandidates(
        candidates,
        new Set(usedEntries.map((entry) => entry.fingerprint)),
        BATCH_SIZE,
      );

      if (batch.length === 0) {
        return toResult([], source, false, true);
      }
    }
  }

  return toResult(
    await readStoredBatch(date.monthDay, date.displayYear),
    source,
    true,
    false,
  );
}

async function fetchWikimediaCandidates(
  date: ParsedHistoryDate,
): Promise<HistoryCandidate[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WIKIMEDIA_TIMEOUT_MS);
  const title = `${date.month}月${date.day}日`;
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: title,
    format: "json",
    formatversion: "2",
    origin: "*",
  });

  try {
    const response = await fetch(
      `https://zh.wikipedia.org/w/api.php?${params.toString()}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "Claudio-Music-Calendar/1.0 (history feature)",
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      console.warn("Wikimedia history request failed", {
        status: response.status,
        title,
      });
      return [];
    }

    const payload = (await response.json()) as WikimediaResponse;
    const content = payload.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content;
    return content ? parseMusicHistoryWikitext(content, date.monthDay) : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function readStoredBatch(monthDay: string, displayYear: number) {
  return prisma.musicHistoryEntry.findMany({
    where: { monthDay, displayYear },
    orderBy: { slot: "asc" },
  });
}

async function saveBatch(date: ParsedHistoryDate, batch: HistoryCandidate[]) {
  await prisma.$transaction(
    batch.map((candidate, slot) =>
      prisma.musicHistoryEntry.create({
        data: {
          monthDay: date.monthDay,
          displayYear: date.displayYear,
          slot,
          eventYear: candidate.eventYear,
          event: candidate.event,
          artist: candidate.artist,
          sourceType: candidate.sourceType,
          sourceTitle: candidate.sourceTitle,
          sourceUrl: candidate.sourceUrl,
          fingerprint: candidate.fingerprint,
        },
      }),
    ),
  );
}

function toResult(
  entries: HistoryEventRecord[],
  source: HistoryBatchResult["source"],
  saved: boolean,
  exhausted: boolean,
): HistoryBatchResult {
  return {
    events: entries.map((entry) => ({
      year: entry.eventYear,
      event: entry.event,
      artist: entry.artist,
      sourceUrl: entry.sourceUrl,
    })),
    source,
    saved,
    exhausted,
  };
}
