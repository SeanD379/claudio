import { Prisma } from "@prisma/client";
import musicHistory from "@/data/music-history.json";
import { prisma } from "@/app/lib/db";
import {
  allocateUnseenCandidates,
  buildMusicHistoryNarrative,
  buildMusicKnowledgeCandidates,
  buildLocalCandidates,
  isBiographicalMusicListing,
  isMusicHistoryHighlight,
  MUSIC_KNOWLEDGE_PREFIX,
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
  isKnowledge?: boolean;
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

interface WikimediaArticleSummaryResponse {
  title?: string;
  extract?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
}

type HistoryEventRecord = {
  eventYear: number;
  event: string;
  artist: string | null;
  sourceUrl: string | null;
};

const knowledgePool = Object.values(
  musicHistory as Record<string, LocalHistoryEvent[]>,
)
  .flat()
  .filter((event) => isMusicHistoryHighlight(event.event));

export async function getOrCreateHistoryBatch(
  date: ParsedHistoryDate,
): Promise<HistoryBatchResult> {
  const stored = await readStoredBatch(date.monthDay, date.displayYear);
  const usefulStored = stored.filter(
    (entry) => !isBiographicalMusicListing(entry.event),
  );
  if (usefulStored.length > 0) {
    return toResult(
      await fillStoredBatch(date, usefulStored),
      "stored",
      true,
      false,
    );
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
    candidates = buildDayLocalCandidates(date);
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
    candidates = buildDayLocalCandidates(date);
    source = "local";
    batch = allocateUnseenCandidates(candidates, usedFingerprints, BATCH_SIZE);
  }

  batch = fillBatchWithKnowledge(date, batch, usedFingerprints);

  if (batch.length === 0) {
    return toResult([], source, false, true);
  }

  batch = await enrichCandidates(batch);

  if (stored.length > 0) {
    return toResult(batch, source, false, false);
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
      const retryUsedFingerprints = new Set(usedEntries.map((entry) => entry.fingerprint));
      batch = allocateUnseenCandidates(
        candidates,
        retryUsedFingerprints,
        BATCH_SIZE,
      );
      batch = fillBatchWithKnowledge(date, batch, retryUsedFingerprints);

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
    variant: "zh-hans",
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

function buildDayLocalCandidates(date: ParsedHistoryDate): HistoryCandidate[] {
  return buildLocalCandidates(
    date.monthDay,
    (musicHistory as Record<string, LocalHistoryEvent[]>)[date.monthDay] ?? [],
  ).filter((candidate) => isMusicHistoryHighlight(candidate.event));
}

function fillBatchWithKnowledge(
  date: ParsedHistoryDate,
  batch: HistoryCandidate[],
  usedFingerprints: ReadonlySet<string>,
): HistoryCandidate[] {
  if (batch.length >= BATCH_SIZE) {
    return batch;
  }

  const selectedFingerprints = new Set([
    ...usedFingerprints,
    ...batch.map((candidate) => candidate.fingerprint),
  ]);
  const knowledge = buildMusicKnowledgeCandidates(
    date.monthDay,
    date.displayYear,
    knowledgePool,
    BATCH_SIZE - batch.length,
  );

  return [
    ...batch,
    ...allocateUnseenCandidates(
      knowledge,
      selectedFingerprints,
      BATCH_SIZE - batch.length,
    ),
  ];
}

async function enrichStoredEntries(
  entries: HistoryEventRecord[],
): Promise<HistoryEventRecord[]> {
  const candidates = entries.map((entry) => ({
    eventYear: entry.eventYear,
    event: entry.event,
    artist: entry.artist,
    sourceType: "wikimedia" as const,
    sourceTitle: "",
    sourceUrl: entry.sourceUrl,
    fingerprint: "",
  }));
  const enriched = await enrichCandidates(candidates);

  return enriched.map((entry) => ({
    eventYear: entry.eventYear,
    event: entry.event,
    artist: entry.artist,
    sourceUrl: entry.sourceUrl,
  }));
}

async function fillStoredBatch(
  date: ParsedHistoryDate,
  entries: HistoryEventRecord[],
): Promise<HistoryEventRecord[]> {
  const enriched = await enrichStoredEntries(entries);
  if (enriched.length >= BATCH_SIZE) {
    return enriched;
  }

  const knowledge = buildMusicKnowledgeCandidates(
    date.monthDay,
    date.displayYear,
    knowledgePool,
    BATCH_SIZE - enriched.length,
  );
  return [
    ...enriched,
    ...knowledge.map((candidate) => ({
      eventYear: candidate.eventYear,
      event: candidate.event,
      artist: candidate.artist,
      sourceUrl: candidate.sourceUrl,
    })),
  ];
}

async function enrichCandidates(
  candidates: HistoryCandidate[],
): Promise<HistoryCandidate[]> {
  return Promise.all(
    candidates.map(async (candidate) => {
      if (candidate.event.startsWith(MUSIC_KNOWLEDGE_PREFIX)) {
        return candidate;
      }

      const articleTitle = candidate.articleTitle ?? getFeatureTitle(candidate.event);
      const article = articleTitle
        ? await fetchArticleSummary(articleTitle)
        : null;

      return buildMusicHistoryNarrative(candidate, article);
    }),
  );
}

function getFeatureTitle(event: string): string | null {
  const match = event.match(/^([^，,。；;（(]{2,80}?)(?:出道|成立|首演|发行|发布)/);
  return match?.[1]?.trim() || null;
}

async function fetchArticleSummary(title: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WIKIMEDIA_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "zh-Hans",
          "User-Agent": "Claudio-Music-Calendar/1.0 (history feature)",
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as WikimediaArticleSummaryResponse;
    if (!payload.title || !payload.extract) {
      return null;
    }

    return {
      title: payload.title,
      extract: payload.extract,
      sourceUrl: payload.content_urls?.desktop?.page ?? null,
    };
  } catch (error) {
    console.warn(
      "Wikimedia article summary request failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
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
      ...(typeof entry.event === "string" && entry.event.startsWith(MUSIC_KNOWLEDGE_PREFIX)
        ? { isKnowledge: true }
        : {}),
    })),
    source,
    saved,
    exhausted,
  };
}
