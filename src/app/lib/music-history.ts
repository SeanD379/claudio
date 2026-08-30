import { createHash } from "node:crypto";

export type HistorySourceType = "wikimedia" | "local";

export interface HistoryCandidate {
  eventYear: number;
  event: string;
  artist: string | null;
  sourceType: HistorySourceType;
  sourceTitle: string;
  sourceUrl: string | null;
  fingerprint: string;
}

export interface ParsedHistoryDate {
  displayYear: number;
  month: number;
  day: number;
  monthDay: string;
}

const MUSIC_KEYWORDS = [
  "音乐",
  "歌曲",
  "歌手",
  "乐队",
  "乐团",
  "作曲",
  "指挥家",
  "演奏家",
  "钢琴家",
  "吉他手",
  "专辑",
  "唱片",
  "发行",
  "演唱会",
  "音乐节",
  "格莱美",
  "摇滚",
  "爵士",
  "古典",
  "说唱",
  "DJ",
  "制作人",
];

export function parseHistoryDate(
  yearValue: string | null,
  monthValue: string | null,
  dayValue: string | null,
): ParsedHistoryDate | null {
  if (
    yearValue === null ||
    monthValue === null ||
    dayValue === null ||
    !/^\d{1,4}$/.test(yearValue) ||
    !/^\d{1,2}$/.test(monthValue) ||
    !/^\d{1,2}$/.test(dayValue)
  ) {
    return null;
  }

  const displayYear = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(0);
  date.setUTCFullYear(displayYear, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  if (
    displayYear < 1 ||
    displayYear > 9999 ||
    month < 1 ||
    month > 12 ||
    date.getUTCFullYear() !== displayYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    displayYear,
    month,
    day,
    monthDay: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

export function buildHistoryFingerprint(
  monthDay: string,
  eventYear: number,
  event: string,
): string {
  return createHash("sha256")
    .update(`${monthDay}|${eventYear}|${normalizeEvent(event)}`)
    .digest("hex");
}

export function parseMusicHistoryWikitext(
  source: string,
  monthDay: string,
): HistoryCandidate[] {
  const [month, day] = monthDay.split("-").map(Number);
  const sourceTitle = `${month}月${day}日`;
  const sourceUrl = `https://zh.wikipedia.org/wiki/${sourceTitle}`;
  const candidates = new Map<string, HistoryCandidate>();

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(
      /^\*\s*(?:\[\[)?(\d{1,4})年(?:\]\])?\s*(?:[：:—–-]\s*)?(.+)$/,
    );
    if (!match) {
      continue;
    }

    const event = cleanWikiText(match[2]);
    if (!event || !containsMusicKeyword(event)) {
      continue;
    }

    const eventYear = Number(match[1]);
    const fingerprint = buildHistoryFingerprint(monthDay, eventYear, event);
    candidates.set(fingerprint, {
      eventYear,
      event,
      artist: null,
      sourceType: "wikimedia",
      sourceTitle,
      sourceUrl,
      fingerprint,
    });
  }

  return sortCandidates([...candidates.values()]);
}

export function allocateUnseenCandidates(
  candidates: HistoryCandidate[],
  usedFingerprints: Set<string>,
  count: number,
): HistoryCandidate[] {
  return sortCandidates(
    candidates.filter((candidate) => !usedFingerprints.has(candidate.fingerprint)),
  ).slice(0, count);
}

function cleanWikiText(value: string): string {
  let cleaned = value
    .replace(/<ref\b[^>]*\/>/gi, "")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, "");

  while (/{{[^{}]*}}/.test(cleaned)) {
    cleaned = cleaned.replace(/{{[^{}]*}}/g, "");
  }

  return cleaned
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function containsMusicKeyword(event: string): boolean {
  const normalized = event.toLocaleLowerCase("zh-CN");
  return MUSIC_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLocaleLowerCase("zh-CN")),
  );
}

function normalizeEvent(event: string): string {
  return event
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s\p{P}]/gu, "");
}

function sortCandidates(candidates: HistoryCandidate[]): HistoryCandidate[] {
  return [...candidates].sort(
    (left, right) =>
      left.eventYear - right.eventYear ||
      left.fingerprint.localeCompare(right.fingerprint),
  );
}
