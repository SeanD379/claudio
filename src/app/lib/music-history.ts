import { createHash } from "node:crypto";
import OpenCC from "opencc-js";

export type HistorySourceType = "wikimedia" | "local";

export interface HistoryCandidate {
  eventYear: number;
  event: string;
  artist: string | null;
  sourceType: HistorySourceType;
  sourceTitle: string;
  sourceUrl: string | null;
  fingerprint: string;
  articleTitle?: string | null;
}

export interface LocalHistoryEvent {
  year: number;
  event: string;
  artist?: string | null;
}

export interface HistoryArticleSummary {
  title: string;
  extract: string;
  sourceUrl: string | null;
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
  "演唱会",
  "音乐节",
  "格莱美",
  "摇滚",
  "爵士",
  "古典",
  "说唱",
  "DJ",
  "制作人",
  "偶像",
  "组合",
];
const MUSIC_MILESTONE_KEYWORDS = [
  "发行",
  "发布",
  "出道",
  "成立",
  "解散",
  "首演",
  "演出",
  "录制",
  "登顶",
  "冠军",
  "获奖",
  "获",
  "创立",
  "上线",
  "推出",
];
export const MUSIC_KNOWLEDGE_PREFIX = "音乐知识回顾｜";
const toSimplifiedChinese = OpenCC.Converter({ from: "t", to: "cn" });

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

export function buildLocalCandidates(
  monthDay: string,
  events: LocalHistoryEvent[],
): HistoryCandidate[] {
  return events.map((item) => {
    const rawEvent = item.event.trim();
    const event = simplifyChinese(rawEvent);

    return {
      eventYear: item.year,
      event,
      artist: item.artist ? simplifyChinese(item.artist) : null,
      sourceType: "local",
      sourceTitle: "Claudio 音乐历史资料",
      sourceUrl: null,
      fingerprint: buildHistoryFingerprint(monthDay, item.year, rawEvent),
    };
  });
}

export function parseMusicHistoryWikitext(
  source: string,
  monthDay: string,
): HistoryCandidate[] {
  const [month, day] = monthDay.split("-").map(Number);
  const sourceTitle = `${month}月${day}日`;
  const sourceUrl = `https://zh.wikipedia.org/wiki/${sourceTitle}`;
  const candidates = new Map<string, HistoryCandidate>();
  let inBiographySection = false;

  for (const line of source.split(/\r?\n/)) {
    const heading = line.match(/^==\s*([^=]+?)\s*==\s*$/);
    if (heading) {
      inBiographySection = /出生|逝世/.test(heading[1]);
      continue;
    }

    if (inBiographySection) {
      continue;
    }

    const match = line.match(
      /^\*\s*(?:\[\[)?(\d{1,4})年(?:\]\])?\s*(?:[：:—–-]\s*)?(.+)$/,
    );
    if (!match) {
      continue;
    }

    const rawEvent = cleanWikiText(match[2]);
    if (!isMusicHistoryHighlight(rawEvent)) {
      continue;
    }

    const eventYear = Number(match[1]);
    const event = simplifyChinese(rawEvent);
    const fingerprint = buildHistoryFingerprint(monthDay, eventYear, rawEvent);
    candidates.set(fingerprint, {
      eventYear,
      event,
      artist: null,
      sourceType: "wikimedia",
      sourceTitle,
      sourceUrl,
      fingerprint,
      articleTitle: getFirstLinkedArticleTitle(match[2]),
    });
  }

  return sortCandidates([...candidates.values()]);
}

export function buildMusicKnowledgeCandidates(
  monthDay: string,
  displayYear: number,
  events: LocalHistoryEvent[],
  count = 3,
): HistoryCandidate[] {
  if (events.length === 0 || count <= 0) {
    return [];
  }

  const offset = (displayYear * 37 + Number(monthDay.replace("-", ""))) % events.length;
  return Array.from({ length: Math.min(count, events.length) }, (_, index) => {
    const item = events[(offset + index) % events.length];
    const rawEvent = item.event.trim();

    return {
      eventYear: item.year,
      event: `${MUSIC_KNOWLEDGE_PREFIX}${simplifyChinese(rawEvent)}`,
      artist: null,
      sourceType: "local",
      sourceTitle: "Claudio 音乐知识库",
      sourceUrl: null,
      fingerprint: buildHistoryFingerprint(
        monthDay,
        item.year,
        `${MUSIC_KNOWLEDGE_PREFIX}${displayYear}|${offset + index}|${rawEvent}`,
      ),
    };
  });
}

export function buildMusicHistoryNarrative(
  candidate: HistoryCandidate,
  article: HistoryArticleSummary | null,
): HistoryCandidate {
  const event = simplifyChinese(candidate.event);
  if (!article) {
    return { ...candidate, event };
  }

  const title = simplifyChinese(article.title).trim();
  const extract = simplifyChinese(article.extract).trim();
  if (!title || !extract || !containsMusicMilestone(event)) {
    return {
      ...candidate,
      event,
      sourceUrl: article.sourceUrl ?? candidate.sourceUrl,
    };
  }

  const bio = getConciseImpact(title, extract, candidate.eventYear);
  return {
    ...candidate,
    event: bio ? `${title}${getMilestoneVerb(event)}。${bio}` : event,
    artist: null,
    sourceUrl: article.sourceUrl ?? candidate.sourceUrl,
  };
}

export function allocateUnseenCandidates(
  candidates: HistoryCandidate[],
  usedFingerprints: ReadonlySet<string>,
  count: number,
): HistoryCandidate[] {
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }

  const fingerprints = new Set<string>();
  return sortCandidates(
    candidates.filter((candidate) => !usedFingerprints.has(candidate.fingerprint)),
  )
    .filter((candidate) => {
      if (fingerprints.has(candidate.fingerprint)) {
        return false;
      }

      fingerprints.add(candidate.fingerprint);
      return true;
    })
    .slice(0, Math.floor(count));
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

function simplifyChinese(value: string): string {
  return toSimplifiedChinese(value);
}

function getConciseImpact(title: string, extract: string, eventYear: number): string {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutLead = extract
    .replace(
      new RegExp(
        `^${escapedTitle}(?:[（(][^）)]*[）)])?[，,]?\\s*(?:是|为|為)?\\s*`,
      ),
      "",
    )
    .replace(/^又(?:称|名)[^，。]+[，,]\s*/, "")
    .replace(new RegExp(`[，,]?成立于${eventYear}年\\d{1,2}月\\d{1,2}日[；;]?`), "；")
    .replace(/^是/, "")
    .replace(/；[，,].*$/, "")
    .replace(/[，,](?:并|有|惟|目前).*/, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .trim();
  const sentence = withoutLead.match(/^.*?[。！？!?]/)?.[0] ?? withoutLead;

  const concise = sentence.length > 72 ? `${sentence.slice(0, 71)}…` : sentence;
  return /[。！？!?…]$/.test(concise) ? concise : `${concise}。`;
}

export function isMusicHistoryHighlight(event: string): boolean {
  return containsMusicKeyword(event) && containsMusicMilestone(event);
}

export function isBiographicalMusicListing(event: string): boolean {
  return (
    !containsMusicMilestone(event) &&
    (/出生|逝世|去世/.test(event) ||
      (/^[^，,。；;]{2,80}[，,]/.test(event) && containsMusicKeyword(event)))
  );
}

function containsMusicKeyword(event: string): boolean {
  const normalized = event.toLocaleLowerCase("zh-CN");
  return MUSIC_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLocaleLowerCase("zh-CN")),
  );
}

function containsMusicMilestone(event: string): boolean {
  return MUSIC_MILESTONE_KEYWORDS.some((keyword) => event.includes(keyword));
}

function getMilestoneVerb(event: string): string {
  if (event.includes("出道")) return "出道";
  if (event.includes("成立")) return "成立";
  if (event.includes("首演")) return "首演";
  return "成为音乐史上的重要节点";
}

function getFirstLinkedArticleTitle(value: string): string | null {
  const match = value.match(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/);
  return match?.[1]?.trim() || null;
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
