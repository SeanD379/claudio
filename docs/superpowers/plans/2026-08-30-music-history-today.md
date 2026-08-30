# Music History Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the music calendar fetch music-related events for the selected month/day, persist one stable batch per display year, and never reuse an event for the same month/day across years.

**Architecture:** Keep the existing Next.js route and UI data flow, but split candidate parsing/allocation into a pure module and persistence/network orchestration into a service. Prisma continues to use the MySQL provider: local `DATABASE_URL` targets MySQL, while Netlify `DATABASE_URL` targets TiDB Cloud. The API reads an existing batch first, fetches Chinese Wikipedia only for a missing batch, excludes fingerprints used by earlier display years, then writes up to three records transactionally. The one new production table is applied explicitly in TiDB Cloud before deployment, so the existing Netlify build pipeline does not have to infer migration history.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 5, local MySQL, TiDB Cloud, Netlify Functions, MediaWiki Action API, Node test runner through `tsx`.

---

## File map

- Create `src/app/lib/music-history.ts`: pure date validation, wiki cleanup/parsing, music filtering, fingerprints, and unseen-candidate allocation.
- Create `src/app/lib/music-history.test.ts`: unit tests for all pure behavior.
- Create `src/app/lib/music-history-service.ts`: Wikimedia fetch, local fallback, Prisma reads/writes, and race recovery.
- Modify `prisma/schema.prisma`: add `MusicHistoryEntry`.
- Create `prisma/migrations/20260830000000_add_music_history_entries/migration.sql`: portable MySQL/TiDB table migration.
- Modify `src/app/api/calendar/history/route.ts`: validate `year/month/day` and delegate to the service.
- Modify `src/hooks/useCalendar.ts`: send the selected year and expose history loading/error/exhaustion state.
- Modify `src/app/components/calendar/DayDetail.tsx`: pass history state independently from play-detail state.
- Modify `src/app/components/calendar/HistoryToday.tsx`: render loading, error, exhausted, persisted events, and source links.
- Modify `package.json` and `package-lock.json`: add the lightweight `tsx` test runner and a targeted test script.
- Keep `netlify.toml` unchanged: apply only the new committed table migration through TiDB Cloud SQL Editor before deploying.

---

### Task 1: Add the TypeScript test runner

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the runner**

Run:

```powershell
npm install --save-dev tsx
```

Expected: `tsx` is added to `devDependencies` and `package-lock.json` changes.

- [ ] **Step 2: Add the focused test script**

Add this entry to `scripts` in `package.json`:

```json
"test:music-history": "tsx --test src/app/lib/music-history.test.ts"
```

- [ ] **Step 3: Verify the runner is available**

Run:

```powershell
npx tsx --version
```

Expected: a version string and exit code 0.

- [ ] **Step 4: Commit the test setup**

```powershell
git add package.json package-lock.json
git commit -m "test: add TypeScript test runner"
```

---

### Task 2: Build and test the pure history parser and allocator

**Files:**
- Create: `src/app/lib/music-history.test.ts`
- Create: `src/app/lib/music-history.ts`

- [ ] **Step 1: Write failing behavior tests**

Create `src/app/lib/music-history.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateUnseenCandidates,
  buildHistoryFingerprint,
  parseHistoryDate,
  parseMusicHistoryWikitext,
  type HistoryCandidate,
} from "./music-history";

test("parseHistoryDate accepts a real calendar date", () => {
  assert.deepEqual(parseHistoryDate("2026", "08", "30"), {
    displayYear: 2026,
    month: 8,
    day: 30,
    monthDay: "08-30",
  });
});

test("parseHistoryDate rejects rollover dates", () => {
  assert.equal(parseHistoryDate("2026", "02", "30"), null);
});

test("parseMusicHistoryWikitext keeps music events and cleans wiki markup", () => {
  const source = `
== 大事记 ==
* [[1965年]]：[[鲍勃·迪伦]]发行专辑《Highway 61 Revisited》。<ref>source</ref>
* [[1997年]]：某国举行议会选举。
== 出生 ==
* [[1943年]]：[[约翰·艾略特·加德纳]]，英国指挥家。
`;

  assert.deepEqual(parseMusicHistoryWikitext(source, "08-30"), [
    {
      eventYear: 1943,
      event: "约翰·艾略特·加德纳，英国指挥家。",
      artist: null,
      sourceType: "wikimedia",
      sourceTitle: "8月30日",
      sourceUrl: "https://zh.wikipedia.org/wiki/8月30日",
      fingerprint: buildHistoryFingerprint(
        "08-30",
        1943,
        "约翰·艾略特·加德纳，英国指挥家。",
      ),
    },
    {
      eventYear: 1965,
      event: "鲍勃·迪伦发行专辑《Highway 61 Revisited》。",
      artist: null,
      sourceType: "wikimedia",
      sourceTitle: "8月30日",
      sourceUrl: "https://zh.wikipedia.org/wiki/8月30日",
      fingerprint: buildHistoryFingerprint(
        "08-30",
        1965,
        "鲍勃·迪伦发行专辑《Highway 61 Revisited》。",
      ),
    },
  ]);
});

test("allocateUnseenCandidates never returns a used fingerprint", () => {
  const candidates: HistoryCandidate[] = [
    candidate(1965, "事件 A", "a"),
    candidate(1970, "事件 B", "b"),
    candidate(1980, "事件 C", "c"),
    candidate(1990, "事件 D", "d"),
  ];

  assert.deepEqual(
    allocateUnseenCandidates(candidates, new Set(["a"]), 3).map(
      (item) => item.fingerprint,
    ),
    ["b", "c", "d"],
  );
});

function candidate(
  eventYear: number,
  event: string,
  fingerprint: string,
): HistoryCandidate {
  return {
    eventYear,
    event,
    artist: null,
    sourceType: "wikimedia",
    sourceTitle: "8月30日",
    sourceUrl: "https://zh.wikipedia.org/wiki/8月30日",
    fingerprint,
  };
}
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
npm run test:music-history
```

Expected: FAIL because `music-history.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure module**

Create `src/app/lib/music-history.ts`:

```ts
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
  if (!yearValue || !monthValue || !dayValue) return null;

  const displayYear = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (!Number.isInteger(displayYear) || displayYear < 1 || displayYear > 9999) {
    return null;
  }
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;

  const date = new Date(Date.UTC(displayYear, month - 1, day));
  if (
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
    .update(`${monthDay}|${eventYear}|${normalizeForFingerprint(event)}`)
    .digest("hex");
}

export function parseMusicHistoryWikitext(
  wikitext: string,
  monthDay: string,
): HistoryCandidate[] {
  const [month, day] = monthDay.split("-").map(Number);
  const sourceTitle = `${month}月${day}日`;
  const sourceUrl = `https://zh.wikipedia.org/wiki/${sourceTitle}`;
  const deduped = new Map<string, HistoryCandidate>();

  for (const line of wikitext.split(/\r?\n/)) {
    if (!/^\*\s*/.test(line)) continue;

    const yearMatch = line.match(/(?:\[\[)?(\d{1,4})年/);
    if (!yearMatch) continue;

    const eventYear = Number(yearMatch[1]);
    const cleaned = cleanWikiText(
      line
        .replace(/^\*\s*/, "")
        .replace(/^(?:\[\[)?\d{1,4}年(?:\]\])?\s*[：:—–-]*\s*/, ""),
    );
    if (!cleaned || !MUSIC_KEYWORDS.some((keyword) => cleaned.includes(keyword))) {
      continue;
    }

    const fingerprint = buildHistoryFingerprint(monthDay, eventYear, cleaned);
    deduped.set(fingerprint, {
      eventYear,
      event: cleaned,
      artist: null,
      sourceType: "wikimedia",
      sourceTitle,
      sourceUrl,
      fingerprint,
    });
  }

  return [...deduped.values()].sort(
    (left, right) =>
      left.eventYear - right.eventYear ||
      left.fingerprint.localeCompare(right.fingerprint),
  );
}

export function allocateUnseenCandidates(
  candidates: HistoryCandidate[],
  usedFingerprints: ReadonlySet<string>,
  limit: number,
): HistoryCandidate[] {
  return candidates
    .filter((candidate) => !usedFingerprints.has(candidate.fingerprint))
    .sort(
      (left, right) =>
        left.eventYear - right.eventYear ||
        left.fingerprint.localeCompare(right.fingerprint),
    )
    .slice(0, limit);
}

function cleanWikiText(value: string): string {
  return value
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref\b[^>]*\/>/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForFingerprint(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s，。、“”‘’：:；;！!？?（）()《》〈〉·—–-]/g, "");
}
```

- [ ] **Step 4: Run tests and static checks**

Run:

```powershell
npm run test:music-history
npx tsc --noEmit
```

Expected: four tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the pure domain logic**

```powershell
git add src/app/lib/music-history.ts src/app/lib/music-history.test.ts
git commit -m "feat: parse and allocate music history events"
```

---

### Task 3: Add persistent history storage for MySQL and TiDB Cloud

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260830000000_add_music_history_entries/migration.sql`

- [ ] **Step 1: Record and preserve the existing schema diff**

`prisma/schema.prisma` already has unrelated user changes. Inspect them before editing:

```powershell
git diff -- prisma/schema.prisma
```

Expected: note the pre-existing hunks. Do not rewrite, format, revert, or stage them as part of this feature.

- [ ] **Step 2: Add the Prisma model**

Append to `prisma/schema.prisma`:

```prisma
model MusicHistoryEntry {
  id           String   @id @default(cuid())
  monthDay     String   @db.Char(5)
  displayYear  Int
  slot         Int
  eventYear    Int
  event        String   @db.Text
  artist       String?  @db.VarChar(191)
  sourceType   String   @db.VarChar(16)
  sourceTitle  String   @db.VarChar(191)
  sourceUrl    String?  @db.Text
  fingerprint  String   @db.Char(64)
  createdAt    DateTime @default(now())

  @@unique([monthDay, displayYear, slot], map: "uq_music_history_batch_slot")
  @@unique([monthDay, fingerprint], map: "uq_music_history_fingerprint")
  @@index([monthDay, displayYear], map: "idx_music_history_batch")
}
```

- [ ] **Step 3: Add the committed migration**

Create `prisma/migrations/20260830000000_add_music_history_entries/migration.sql`:

```sql
CREATE TABLE `MusicHistoryEntry` (
  `id` VARCHAR(191) NOT NULL,
  `monthDay` CHAR(5) NOT NULL,
  `displayYear` INTEGER NOT NULL,
  `slot` INTEGER NOT NULL,
  `eventYear` INTEGER NOT NULL,
  `event` TEXT NOT NULL,
  `artist` VARCHAR(191) NULL,
  `sourceType` VARCHAR(16) NOT NULL,
  `sourceTitle` VARCHAR(191) NOT NULL,
  `sourceUrl` TEXT NULL,
  `fingerprint` CHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `uq_music_history_batch_slot`(`monthDay`, `displayYear`, `slot`),
  UNIQUE INDEX `uq_music_history_fingerprint`(`monthDay`, `fingerprint`),
  INDEX `idx_music_history_batch`(`monthDay`, `displayYear`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

- [ ] **Step 4: Validate and apply the migration to local MySQL**

Run with the existing local `DATABASE_URL`:

```powershell
npx prisma validate
npx prisma migrate deploy
npx prisma generate
```

Expected: schema valid, one migration applied, Prisma Client generated.

- [ ] **Step 5: Verify local migration state**

Run:

```powershell
npx prisma migrate status
```

Expected: Prisma reports that the local MySQL schema is up to date and includes `20260830000000_add_music_history_entries`.

- [ ] **Step 6: Commit only the feature schema hunk and migration**

```powershell
git add prisma/migrations/20260830000000_add_music_history_entries/migration.sql
git add -p prisma/schema.prisma
git diff --cached -- prisma/schema.prisma prisma/migrations/20260830000000_add_music_history_entries/migration.sql
git commit -m "feat: persist generated music history batches"
```

At the `git add -p` prompt, stage only the new `MusicHistoryEntry` model hunk. Expected before commit: the cached diff contains no pre-existing schema changes.

---

### Task 4: Implement the network and persistence service

**Files:**
- Modify: `src/app/lib/music-history.ts`
- Modify: `src/app/lib/music-history.test.ts`
- Create: `src/app/lib/music-history-service.ts`

- [ ] **Step 1: Add a failing local-fallback conversion test**

Merge `buildLocalCandidates` into the existing import from `./music-history`, then add this test to `src/app/lib/music-history.test.ts`:

```ts
test("buildLocalCandidates uses the same fingerprint format", () => {
  const candidates = buildLocalCandidates("08-30", [
    { year: 1965, event: "一张重要专辑发行", artist: "示例音乐人" },
  ]);

  assert.equal(candidates[0].sourceType, "local");
  assert.equal(candidates[0].sourceUrl, null);
  assert.equal(
    candidates[0].fingerprint,
    buildHistoryFingerprint("08-30", 1965, "一张重要专辑发行"),
  );
});
```

- [ ] **Step 2: Verify the new test fails**

Run:

```powershell
npm run test:music-history
```

Expected: FAIL because `buildLocalCandidates` is not exported.

- [ ] **Step 3: Add the local conversion helper**

Add to `src/app/lib/music-history.ts`:

```ts
export interface LocalHistoryEvent {
  year: number;
  event: string;
  artist?: string | null;
}

export function buildLocalCandidates(
  monthDay: string,
  events: LocalHistoryEvent[],
): HistoryCandidate[] {
  return events.map((item) => ({
    eventYear: item.year,
    event: item.event.trim(),
    artist: item.artist ?? null,
    sourceType: "local",
    sourceTitle: "Claudio 音乐历史资料",
    sourceUrl: null,
    fingerprint: buildHistoryFingerprint(monthDay, item.year, item.event),
  }));
}
```

- [ ] **Step 4: Implement the service**

Create `src/app/lib/music-history-service.ts`:

```ts
import { Prisma } from "@prisma/client";
import musicHistory from "@/data/music-history.json";
import { prisma } from "@/app/lib/db";
import {
  allocateUnseenCandidates,
  buildLocalCandidates,
  parseMusicHistoryWikitext,
  type HistoryCandidate,
  type ParsedHistoryDate,
} from "@/app/lib/music-history";

const BATCH_SIZE = 3;
const WIKIMEDIA_TIMEOUT_MS = 8_000;

interface WikiResponse {
  query?: {
    pages?: Array<{
      missing?: boolean;
      revisions?: Array<{
        slots?: { main?: { content?: string } };
      }>;
    }>;
  };
}

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

export async function getOrCreateHistoryBatch(
  date: ParsedHistoryDate,
): Promise<HistoryBatchResult> {
  const stored = await readStoredBatch(date.monthDay, date.displayYear);
  if (stored.length > 0) return toResult(stored, "stored", true);

  let source: "wikimedia" | "local" = "wikimedia";
  let candidates = await fetchWikimediaCandidates(date).catch((error) => {
    console.error("Fetch Wikimedia history failed:", error);
    return [];
  });

  if (candidates.length === 0) {
    source = "local";
    const local = (
      musicHistory as Record<
        string,
        Array<{ year: number; event: string; artist?: string | null }>
      >
    )[date.monthDay] ?? [];
    candidates = buildLocalCandidates(date.monthDay, local);
  }

  const used = await prisma.musicHistoryEntry.findMany({
    where: { monthDay: date.monthDay },
    select: { fingerprint: true },
  });
  let selected = allocateUnseenCandidates(
    candidates,
    new Set(used.map((entry) => entry.fingerprint)),
    BATCH_SIZE,
  );

  if (selected.length === 0) {
    return { events: [], source, saved: false, exhausted: true };
  }

  try {
    await saveBatch(date, selected);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await readStoredBatch(date.monthDay, date.displayYear);
      if (raced.length > 0) return toResult(raced, "stored", true);

      const usedAfterRace = await prisma.musicHistoryEntry.findMany({
        where: { monthDay: date.monthDay },
        select: { fingerprint: true },
      });
      selected = allocateUnseenCandidates(
        candidates,
        new Set(usedAfterRace.map((entry) => entry.fingerprint)),
        BATCH_SIZE,
      );
      if (selected.length === 0) {
        return { events: [], source, saved: false, exhausted: true };
      }
      await saveBatch(date, selected);
    } else {
      throw error;
    }
  }

  const saved = await readStoredBatch(date.monthDay, date.displayYear);
  return toResult(saved, source, true);
}

async function fetchWikimediaCandidates(
  date: ParsedHistoryDate,
): Promise<HistoryCandidate[]> {
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WIKIMEDIA_TIMEOUT_MS);

  try {
    const response = await fetch(`https://zh.wikipedia.org/w/api.php?${params}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Claudio-Music-Calendar/1.0 (history feature)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Wikimedia returned ${response.status}`);

    const payload = (await response.json()) as WikiResponse;
    const page = payload.query?.pages?.[0];
    const content = page?.revisions?.[0]?.slots?.main?.content;
    if (page?.missing || !content) return [];
    return parseMusicHistoryWikitext(content, date.monthDay);
  } finally {
    clearTimeout(timer);
  }
}

async function readStoredBatch(monthDay: string, displayYear: number) {
  return prisma.musicHistoryEntry.findMany({
    where: { monthDay, displayYear },
    orderBy: { slot: "asc" },
  });
}

async function saveBatch(
  date: ParsedHistoryDate,
  candidates: HistoryCandidate[],
) {
  await prisma.$transaction(
    candidates.map((candidate, slot) =>
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
  entries: Array<{
    eventYear: number;
    event: string;
    artist: string | null;
    sourceUrl: string | null;
  }>,
  source: HistoryBatchResult["source"],
  saved: boolean,
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
    exhausted: false,
  };
}
```

- [ ] **Step 5: Run unit and type checks**

```powershell
npm run test:music-history
npx tsc --noEmit
```

Expected: five tests pass; TypeScript exits 0.

- [ ] **Step 6: Commit the service**

```powershell
git add src/app/lib/music-history.ts src/app/lib/music-history.test.ts src/app/lib/music-history-service.ts
git commit -m "feat: fetch and persist music history events"
```

---

### Task 5: Replace the static history API with the persisted service

**Files:**
- Modify: `src/app/api/calendar/history/route.ts`

- [ ] **Step 1: Replace the route implementation**

Use this complete route:

```ts
import { NextRequest, NextResponse } from "next/server";
import { parseHistoryDate } from "@/app/lib/music-history";
import { getOrCreateHistoryBatch } from "@/app/lib/music-history-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = parseHistoryDate(
    searchParams.get("year"),
    searchParams.get("month"),
    searchParams.get("day"),
  );

  if (!date) {
    return NextResponse.json(
      { error: "Invalid date; expected a real year/month/day" },
      { status: 400 },
    );
  }

  try {
    const result = await getOrCreateHistoryBatch(date);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Get history events error:", error);
    return NextResponse.json(
      { error: "Failed to get history events" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify validation without writing data**

Run while the dev server is active:

```powershell
Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/api/calendar/history?year=2026&month=02&day=30'
```

Expected: HTTP 400.

- [ ] **Step 3: Verify a real request writes local MySQL**

Ensure the Next.js process has outbound network permission, then run:

```powershell
$first = Invoke-RestMethod 'http://localhost:3000/api/calendar/history?year=2026&month=08&day=30'
$second = Invoke-RestMethod 'http://localhost:3000/api/calendar/history?year=2026&month=08&day=30'
$first | ConvertTo-Json -Depth 5
$second | ConvertTo-Json -Depth 5
```

Expected: both responses contain identical `events`; the second response has `source: "stored"`.

- [ ] **Step 4: Verify cross-year deduplication**

```powershell
$yearA = Invoke-RestMethod 'http://localhost:3000/api/calendar/history?year=2026&month=08&day=30'
$yearB = Invoke-RestMethod 'http://localhost:3000/api/calendar/history?year=2027&month=08&day=30'
Compare-Object ($yearA.events.event) ($yearB.events.event)
```

Expected: no event text appears in both batches. If the source is exhausted, the later response has `exhausted: true` rather than repeated events.

- [ ] **Step 5: Commit the API route**

```powershell
git add src/app/api/calendar/history/route.ts
git commit -m "feat: serve persisted calendar history batches"
```

---

### Task 6: Add independent history states to the calendar UI

**Files:**
- Modify: `src/hooks/useCalendar.ts`
- Modify: `src/app/calendar/page.tsx`
- Modify: `src/app/components/calendar/DayDetail.tsx`
- Modify: `src/app/components/calendar/HistoryToday.tsx`

- [ ] **Step 1: Extend the history event and state types in `useCalendar.ts`**

Replace the existing `HistoryEvent` interface with:

```ts
interface HistoryEvent {
  year: number;
  event: string;
  artist?: string | null;
  sourceUrl?: string | null;
}

export type HistoryState = "idle" | "loading" | "ready" | "exhausted" | "error";
```

Add state next to `historyEvents`:

```ts
const [historyState, setHistoryState] = useState<HistoryState>("idle");
```

- [ ] **Step 2: Replace the history request in `fetchDayDetail`**

Use this block before the login-dependent day request:

```ts
setHistoryState("loading");
try {
  const historyRes = await fetch(
    `/api/calendar/history?year=${date.slice(0, 4)}&month=${date.slice(5, 7)}&day=${date.slice(8, 10)}`,
    { cache: "no-store" },
  );
  if (!historyRes.ok) throw new Error(`History API returned ${historyRes.status}`);

  const data = await historyRes.json();
  const events = data.events || [];
  setHistoryEvents(events);
  setHistoryState(data.exhausted ? "exhausted" : "ready");
} catch (error) {
  console.error("Fetch history error:", error);
  setHistoryEvents([]);
  setHistoryState("error");
}
```

Add `historyState` to the returned object from `useCalendar`.

- [ ] **Step 3: Pass history state through the page and detail component**

In `src/app/calendar/page.tsx`, destructure `historyState` from `useCalendar()` and pass it to `DayDetail`:

```tsx
<DayDetail
  date={selectedDate}
  summary={dayDetail?.summary ?? null}
  historyEvents={historyEvents}
  historyState={historyState}
  loading={loading}
  formatDuration={formatDuration}
/>
```

In `DayDetail.tsx`, import the type:

```ts
import type { HistoryState } from "@/hooks/useCalendar";
```

Add the prop:

```ts
historyState: HistoryState;
```

Pass it to `HistoryToday`:

```tsx
<HistoryToday
  events={historyEvents}
  month={dateObj.getMonth() + 1}
  day={dateObj.getDate()}
  state={historyState}
/>
```

Update `hasContent` so public loading/error/exhausted states still render the right panel:

```ts
const hasContent =
  (summary && summary.playCount > 0) ||
  historyEvents.length > 0 ||
  historyState !== "idle" ||
  isToday(date);
```

- [ ] **Step 4: Render all history states and source links**

In `HistoryToday.tsx`:

```ts
import { ExternalLink, History, Loader2 } from "lucide-react";
import type { HistoryState } from "@/hooks/useCalendar";

interface HistoryEvent {
  year: number;
  event: string;
  artist?: string | null;
  sourceUrl?: string | null;
}

interface HistoryTodayProps {
  events: HistoryEvent[];
  month: number;
  day: number;
  state: HistoryState;
}
```

Remove the early `if (events.length === 0) return null`. Replace the emoji label with:

```tsx
<History className="h-4 w-4" style={{ color: "#1ed760" }} />
```

Place this state block before the timeline:

```tsx
{state === "loading" && (
  <div className="flex flex-1 items-center justify-center gap-2 py-8 text-sm text-white/50">
    <Loader2 className="h-4 w-4 animate-spin" />
    正在整理这一天的音乐记忆…
  </div>
)}
{state === "error" && (
  <p className="py-8 text-center text-sm text-white/50">历史内容暂时无法获取</p>
)}
{state === "exhausted" && (
  <p className="py-8 text-center text-sm text-white/50">暂时没有新的音乐历史事件</p>
)}
```

Render the timeline only when `state === "ready"`. Below `artist`, add the source link:

```tsx
{evt.sourceUrl && (
  <a
    href={evt.sourceUrl}
    target="_blank"
    rel="noreferrer"
    className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/35 transition-colors hover:text-white/65"
    onClick={(event) => event.stopPropagation()}
  >
    查看来源 <ExternalLink className="h-3 w-3" />
  </a>
)}
```

- [ ] **Step 5: Run static and browser checks**

```powershell
npx tsc --noEmit
Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/calendar'
```

Expected: TypeScript exits 0 and page returns HTTP 200. In the browser, selecting a date shows loading, then events or an explicit empty/error state without hiding play statistics.

- [ ] **Step 6: Commit the frontend integration**

```powershell
git add src/hooks/useCalendar.ts src/app/calendar/page.tsx src/app/components/calendar/DayDetail.tsx src/app/components/calendar/HistoryToday.tsx
git commit -m "feat: display generated music history states"
```

---

### Task 7: Prepare TiDB Cloud before the Netlify deployment

**Files:**
- No repository file changes expected; use the committed migration from Task 3 in TiDB Cloud SQL Editor.

- [ ] **Step 1: Confirm the production environment variable without exposing its secret**

Open **Netlify dashboard → Site configuration → Environment variables** and confirm that a `DATABASE_URL` key exists for the production context. Do not copy the value into terminal output, chat, logs, screenshots, or Git.

- [ ] **Step 2: Confirm the TiDB URL was created for Prisma and TLS**

In the Netlify dashboard, verify the value came from TiDB Cloud’s **Connect → Prisma** flow and includes the TLS settings required by the chosen TiDB Cloud plan. Do not log the connection string.

- [ ] **Step 3: Check whether the target table already exists**

In the TiDB Cloud SQL Editor, run:

```sql
SHOW TABLES LIKE 'MusicHistoryEntry';
```

Expected before the first deployment: no result. If the table already exists, inspect its definition with:

```sql
SHOW CREATE TABLE MusicHistoryEntry;
```

If the existing definition differs from the Task 3 migration, stop and reconcile it before deploying. Do not drop or overwrite an existing table.

- [ ] **Step 4: Apply the single feature migration in TiDB Cloud**

If the table is absent, execute this exact SQL in TiDB Cloud SQL Editor:

```sql
CREATE TABLE `MusicHistoryEntry` (
  `id` VARCHAR(191) NOT NULL,
  `monthDay` CHAR(5) NOT NULL,
  `displayYear` INTEGER NOT NULL,
  `slot` INTEGER NOT NULL,
  `eventYear` INTEGER NOT NULL,
  `event` TEXT NOT NULL,
  `artist` VARCHAR(191) NULL,
  `sourceType` VARCHAR(16) NOT NULL,
  `sourceTitle` VARCHAR(191) NOT NULL,
  `sourceUrl` TEXT NULL,
  `fingerprint` CHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `uq_music_history_batch_slot`(`monthDay`, `displayYear`, `slot`),
  UNIQUE INDEX `uq_music_history_fingerprint`(`monthDay`, `fingerprint`),
  INDEX `idx_music_history_batch`(`monthDay`, `displayYear`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

- [ ] **Step 5: Verify the production table without writing user data**

```sql
SHOW CREATE TABLE MusicHistoryEntry;
SELECT COUNT(*) AS rowCount FROM MusicHistoryEntry;
```

Expected: the table definition includes both unique indexes and the initial row count is `0`.

- [ ] **Step 6: Keep the existing Netlify build command and run it locally**

Do not modify `netlify.toml`; it remains:

```toml
command = "npx prisma generate && npm run build"
```

```powershell
npm run build
```

Expected: Next.js build succeeds. This command does not target TiDB Cloud because the local environment retains the local MySQL `DATABASE_URL`.

---

### Task 8: Final verification and deployment handoff

**Files:**
- No new files expected.

- [ ] **Step 1: Run the complete local verification set**

```powershell
npm run test:music-history
npx prisma validate
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all tests and checks pass; unrelated pre-existing lint findings are reported separately rather than changed.

- [ ] **Step 2: Verify local persistence and yearly uniqueness**

Request one date twice for 2026 and once for 2027. Confirm:

```text
2026 first request: generated and saved
2026 second request: identical stored records
2027 request: no fingerprint/event repeated from 2026, or exhausted=true
```

- [ ] **Step 3: Inspect only feature-related Git changes**

```powershell
git status --short
git log --oneline -8
```

Expected: feature files are committed in focused commits; unrelated user changes remain untouched.

- [ ] **Step 4: Push only after user confirmation**

```powershell
git push origin main
```

Expected: push succeeds and triggers the existing Netlify site deployment.

- [ ] **Step 5: Verify the Netlify deploy and TiDB persistence**

After Netlify reports success:

1. Open the deployed Claudio `/calendar` page.
2. Select a date with a known music event.
3. Confirm the history card renders up to three events and source links.
4. Refresh and confirm the same batch is returned.
5. In TiDB Cloud SQL Editor, run:

```sql
SELECT monthDay, displayYear, slot, eventYear, sourceType
FROM MusicHistoryEntry
ORDER BY createdAt DESC
LIMIT 10;
```

Expected: the production request created records in TiDB Cloud, not local MySQL.

- [ ] **Step 6: Record deployment result**

Report the pushed commit, Netlify deployment status, tested live URL, and whether TiDB rows were confirmed. Do not include database credentials.
