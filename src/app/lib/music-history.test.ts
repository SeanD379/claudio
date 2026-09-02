import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  allocateUnseenCandidates,
  buildHistoryFingerprint,
  buildMusicKnowledgeCandidates,
  buildMusicHistoryNarrative,
  buildLocalCandidates,
  parseHistoryDate,
  parseMusicHistoryWikitext,
  type HistoryCandidate,
} from "./music-history";

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL ??= "mysql://test@127.0.0.1:1/claudio_test";

let prisma: typeof import("./db").prisma;
let getOrCreateHistoryBatch: typeof import("./music-history-service").getOrCreateHistoryBatch;

test.after(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = originalDatabaseUrl;
});

interface StoredHistoryEntry {
  eventYear: number;
  event: string;
  artist: string | null;
  sourceUrl: string | null;
}

interface UsedFingerprintEntry {
  fingerprint: string;
}

interface HistoryEntryCreateInput {
  data: StoredHistoryEntry &
    UsedFingerprintEntry & {
      sourceType: "local" | "wikimedia";
    };
}

interface ServicePrisma {
  musicHistoryEntry: {
    findMany: (
      args: unknown,
    ) => Promise<Array<StoredHistoryEntry | UsedFingerprintEntry>>;
    create: (args: unknown) => Promise<StoredHistoryEntry>;
  };
  $transaction: (operations: unknown[]) => Promise<unknown>;
}

let servicePrisma: ServicePrisma;

test.before(async () => {
  ({ prisma } = await import("./db"));
  ({ getOrCreateHistoryBatch } = await import("./music-history-service"));
  servicePrisma = prisma as unknown as ServicePrisma;
});

function installServiceMocks(
  findMany: ServicePrisma["musicHistoryEntry"]["findMany"],
  create: ServicePrisma["musicHistoryEntry"]["create"],
  transaction: ServicePrisma["$transaction"],
  fetchStub: typeof fetch,
) {
  const originalFindMany = servicePrisma.musicHistoryEntry.findMany;
  const originalCreate = servicePrisma.musicHistoryEntry.create;
  const originalTransaction = servicePrisma.$transaction;
  const originalFetch = globalThis.fetch;

  servicePrisma.musicHistoryEntry.findMany = findMany;
  servicePrisma.musicHistoryEntry.create = create;
  servicePrisma.$transaction = transaction;
  globalThis.fetch = fetchStub;

  return () => {
    servicePrisma.musicHistoryEntry.findMany = originalFindMany;
    servicePrisma.musicHistoryEntry.create = originalCreate;
    servicePrisma.$transaction = originalTransaction;
    globalThis.fetch = originalFetch;
  };
}

function wikiResponse(wikitext: string): Response {
  return new Response(
    JSON.stringify({
      query: {
        pages: [{ revisions: [{ slots: { main: { content: wikitext } } }] }],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function articleSummaryResponse(
  title: string,
  extract: string,
  sourceUrl: string,
): Response {
  return new Response(
    JSON.stringify({
      title,
      extract,
      content_urls: { desktop: { page: sourceUrl } },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const historyDate = {
  displayYear: 2026,
  month: 8,
  day: 30,
  monthDay: "08-30",
};

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

test("parseHistoryDate rejects missing values and year zero", () => {
  assert.equal(parseHistoryDate(null, "08", "30"), null);
  assert.equal(parseHistoryDate("2026", null, "30"), null);
  assert.equal(parseHistoryDate("2026", "08", null), null);
  assert.equal(parseHistoryDate("0000", "08", "30"), null);
});

test("parseMusicHistoryWikitext keeps music events and cleans wiki markup", () => {
  const source = `
== 大事记 ==
* [[1965年]]：[[鲍勃·迪伦]]发行专辑《Highway 61 Revisited》。<ref>source</ref>
* [[2011年]]：日本大型女子偶像组合-[[乃木坂46]]出道。
* [[1997年]]：某国举行议会选举。
== 出生 ==
* [[1943年]]：[[约翰·艾略特·加德纳]]，英国指挥家。
`;

  assert.deepEqual(parseMusicHistoryWikitext(source, "08-30"), [
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
      articleTitle: "鲍勃·迪伦",
    },
    {
      eventYear: 2011,
      event: "日本大型女子偶像组合-乃木坂46出道。",
      artist: null,
      sourceType: "wikimedia",
      sourceTitle: "8月30日",
      sourceUrl: "https://zh.wikipedia.org/wiki/8月30日",
      fingerprint: buildHistoryFingerprint(
        "08-30",
        2011,
        "日本大型女子偶像组合-乃木坂46出道。",
      ),
      articleTitle: "乃木坂46",
    },
  ]);
});

test("parseMusicHistoryWikitext requires a music keyword beyond 发行", () => {
  const source = `
* [[2000年]]：某国发行新版护照。
* [[2001年]]：歌手发行单曲。
`;

  assert.deepEqual(
    parseMusicHistoryWikitext(source, "08-30").map((item) => item.event),
    ["歌手发行单曲。"],
  );
});

test("parseMusicHistoryWikitext converts every candidate to simplified Chinese", () => {
  const source = "* [[1960年]]：[[林秋離]]，臺灣作詞家、唱片製作人（2022年逝世）。";

  assert.deepEqual(
    parseMusicHistoryWikitext(source, "08-21").map((item) => item.event),
    [],
  );
});

test("buildMusicHistoryNarrative turns a music debut into a concise impact note", () => {
  const historyCandidate = candidate(2011, "日本大型女子偶像组合-乃木坂46出道。", "nogizaka");

  assert.deepEqual(
    buildMusicHistoryNarrative(historyCandidate, {
      title: "乃木坂46",
      extract: "乃木坂46是日本大型女子偶像团体，成立于2011年8月21日；其出道时定位为另一女子偶像组合AKB48的“官方对手”，并与其他团体构成坂道系列。",
      sourceUrl: "https://zh.wikipedia.org/wiki/乃木坂46",
    }),
    {
      ...historyCandidate,
      event: "乃木坂46出道。日本大型女子偶像团体；其出道时定位为另一女子偶像组合AKB48的“官方对手”。",
      artist: null,
      sourceUrl: "https://zh.wikipedia.org/wiki/乃木坂46",
    },
  );
});

test("buildHistoryFingerprint uses SHA-256 and normalizes equivalent event text", () => {
  const expected = "4970330000b005a0c0c674ae3f0a263fcf81dde00177dcc6c0a26009a3f01903";

  assert.equal(
    buildHistoryFingerprint("08-30", 1965, "ＡＢＣ， 歌手！"),
    expected,
  );
  assert.equal(buildHistoryFingerprint("08-30", 1965, "abc歌手"), expected);
});

test("buildLocalCandidates creates local fallback candidates", () => {
  assert.deepEqual(
    buildLocalCandidates("08-30", [
      { year: 1965, event: "  一张重要专辑发行  ", artist: "示例音乐人" },
    ]),
    [
      {
        eventYear: 1965,
        event: "一张重要专辑发行",
        artist: "示例音乐人",
        sourceType: "local",
        sourceTitle: "Claudio 音乐历史资料",
        sourceUrl: null,
        fingerprint: buildHistoryFingerprint("08-30", 1965, "一张重要专辑发行"),
      },
    ],
  );
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

test("allocateUnseenCandidates deduplicates and accepts readonly used fingerprints", () => {
  const candidates: HistoryCandidate[] = [
    candidate(1970, "事件 B", "b"),
    candidate(1965, "事件 A", "a"),
    candidate(1966, "重复事件 A", "a"),
    candidate(1960, "已使用事件", "used"),
  ];
  const usedFingerprints: ReadonlySet<string> = new Set(["used"]);

  assert.deepEqual(
    allocateUnseenCandidates(candidates, usedFingerprints, 3).map(
      (item) => [item.eventYear, item.fingerprint],
    ),
    [
      [1965, "a"],
      [1970, "b"],
    ],
  );
});

test("allocateUnseenCandidates rejects non-positive and non-finite limits", () => {
  const candidates: HistoryCandidate[] = [
    candidate(1965, "事件 A", "a"),
    candidate(1970, "事件 B", "b"),
  ];

  for (const count of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(allocateUnseenCandidates(candidates, new Set(), count), []);
  }
});

test("parseMusicHistoryWikitext supports year separators and ignores numbered lines", () => {
  const source = `
* [[1960年]]：音乐专辑发行甲
* [[1961年]]:音乐专辑发行乙
* [[1962年]]—音乐专辑发行丙
* [[1963年]]–音乐专辑发行丁
* [[1964年]]-音乐专辑发行戊
* [[1965年]]音乐专辑发行己
# [[1966年]]：音乐专辑发行庚
`;

  assert.deepEqual(
    parseMusicHistoryWikitext(source, "08-30").map((item) => item.eventYear),
    [1960, 1961, 1962, 1963, 1964, 1965],
  );
});

test("getOrCreateHistoryBatch fills a short stored batch to three entries without fetching", async () => {
  const restore = installServiceMocks(
    async () => [
      {
        eventYear: 1970,
        event: "第二个事件",
        artist: null,
        sourceUrl: null,
      },
      {
        eventYear: 1965,
        event: "第一个事件",
        artist: "示例音乐人",
        sourceUrl: "https://example.com/first",
      },
    ],
    async () => {
      throw new Error("stored batch must not create rows");
    },
    async () => {
      throw new Error("stored batch must not write a transaction");
    },
    async () => {
      throw new Error("stored batch must not fetch");
    },
  );

  try {
    const result = await getOrCreateHistoryBatch(historyDate);
    assert.equal(result.events.length, 3);
    assert.deepEqual(result.events.slice(0, 2), [
      { year: 1970, event: "第二个事件", artist: null, sourceUrl: null },
      { year: 1965, event: "第一个事件", artist: "示例音乐人", sourceUrl: "https://example.com/first" },
    ]);
    assert.equal(result.source, "stored");
    assert.equal(result.saved, true);
    assert.equal(result.exhausted, false);
  } finally {
    restore();
  }
});

test("buildMusicKnowledgeCandidates supplies labelled music knowledge cards", () => {
  const candidates = buildMusicKnowledgeCandidates("08-21", 2026, [
    { year: 1967, event: "The Beatles 发行《Sgt. Pepper's Lonely Hearts Club Band》" },
    { year: 1979, event: "索尼推出第一款 Walkman 随身听，开启个人便携音乐时代" },
    { year: 1981, event: "MTV 开播，音乐录像带成为流行文化的重要媒介" },
  ]);

  assert.equal(candidates.length, 3);
  assert.equal(candidates.every((item) => item.event.startsWith("音乐知识回顾｜")), true);
  assert.equal(candidates.every((item) => item.sourceType === "local"), true);
});

test("getOrCreateHistoryBatch replaces legacy birth listings with a meaningful music event", async () => {
  let findManyCalls = 0;
  const restore = installServiceMocks(
    async () => {
      findManyCalls += 1;
      if (findManyCalls === 1) {
        return [
          {
            eventYear: 1959,
            event: "新居昭乃，日本歌手",
            artist: null,
            sourceUrl: "https://zh.wikipedia.org/wiki/8月21日",
          },
        ];
      }

      return [];
    },
    async () => {
      throw new Error("legacy batch must not create rows");
    },
    async () => {
      throw new Error("legacy batch must not write a transaction");
    },
    async (input) => {
      const url = String(input);
      if (url.includes("w/api.php")) {
        return wikiResponse(
          "* [[2011年]]：日本大型女子偶像组合-[[乃木坂46]]出道。",
        );
      }

      assert.match(url, /page\/summary/);
      return articleSummaryResponse(
        "乃木坂46",
        "乃木坂46是日本大型女子偶像团体，成立于2011年8月21日；其出道时定位为另一女子偶像组合AKB48的“官方对手”，并与其他团体构成坂道系列。",
        "https://zh.wikipedia.org/wiki/乃木坂46",
      );
    },
  );

  try {
    const result = await getOrCreateHistoryBatch({
      displayYear: 2026,
      month: 8,
      day: 21,
      monthDay: "08-21",
    });
    assert.equal(result.events.length, 3);
    assert.match(result.events[0].event, /^乃木坂46出道。/);
    assert.equal(result.events.slice(1).every((event) => event.isKnowledge), true);
    assert.equal(result.source, "wikimedia");
    assert.equal(result.saved, false);
    assert.equal(result.exhausted, false);
  } finally {
    restore();
  }
});

test("getOrCreateHistoryBatch reallocates after P2002 and saves unseen Wikimedia candidates", async () => {
  const wikitext = `
* [[1960年]]：歌手甲发行专辑。
* [[1970年]]：歌手乙发行专辑。
* [[1980年]]：歌手丙发行专辑。
`;
  const conflictingFingerprint = buildHistoryFingerprint(
    "08-30",
    1960,
    "歌手甲发行专辑。",
  );
  const persisted: StoredHistoryEntry[] = [];
  const savedFingerprints: string[] = [];
  const createPayloads: Array<HistoryEntryCreateInput["data"]> = [];
  const transactionSizes: number[] = [];
  let findManyCalls = 0;

  const restore = installServiceMocks(
    async () => {
      findManyCalls += 1;
      if (
        findManyCalls === 1 ||
        findManyCalls === 2 ||
        findManyCalls === 3
      ) {
        return [];
      }
      if (findManyCalls === 4) {
        return [{ fingerprint: conflictingFingerprint }];
      }
      if (findManyCalls === 5) {
        return persisted;
      }

      throw new Error(`unexpected findMany call ${findManyCalls}`);
    },
    async (input) => {
      const { data } = input as HistoryEntryCreateInput;
      savedFingerprints.push(data.fingerprint);
      createPayloads.push(data);
      return data;
    },
    async (operations) => {
      transactionSizes.push(operations.length);
      if (transactionSizes.length === 1) {
        throw new Prisma.PrismaClientKnownRequestError("conflict", {
          code: "P2002",
          clientVersion: "test",
        });
      }

      persisted.push(
        ...createPayloads.slice(-3).map((data) => ({
          eventYear: data.eventYear,
          event: data.event,
          artist: data.artist,
          sourceUrl: data.sourceUrl,
        })),
      );
    },
    async () => wikiResponse(wikitext),
  );

  try {
    const result = await getOrCreateHistoryBatch(historyDate);

    assert.deepEqual(transactionSizes, [3, 3]);
    assert.equal(savedFingerprints.includes(conflictingFingerprint), true);
    assert.equal(
      savedFingerprints.slice(-2).includes(conflictingFingerprint),
      false,
    );
    assert.equal(result.events.length, 3);
    assert.equal(result.source, "wikimedia");
    assert.equal(result.saved, true);
    assert.equal(result.exhausted, false);
  } finally {
    restore();
  }
});

test("getOrCreateHistoryBatch supplies three knowledge cards when the day has no usable events", async () => {
  const persisted: StoredHistoryEntry[] = [];
  const createPayloads: Array<HistoryEntryCreateInput["data"]> = [];
  let findManyCalls = 0;

  const restore = installServiceMocks(
    async () => {
      findManyCalls += 1;
      return findManyCalls === 3 ? persisted : [];
    },
    async (input) => {
      const { data } = input as HistoryEntryCreateInput;
      createPayloads.push(data);
      return data;
    },
    async () => {
      persisted.push(
        ...createPayloads.map((data) => ({
          eventYear: data.eventYear,
          event: data.event,
          artist: data.artist,
          sourceUrl: data.sourceUrl,
        })),
      );
    },
    async () => wikiResponse(""),
  );

  try {
    const result = await getOrCreateHistoryBatch(historyDate);
    assert.equal(result.events.length, 3);
    assert.equal(result.events.every((event) => event.isKnowledge), true);
    assert.equal(result.exhausted, false);
  } finally {
    restore();
  }
});

test("getOrCreateHistoryBatch falls back to unused local candidates after used Wikimedia candidates", async () => {
  const localHistoryDate = {
    displayYear: 2026,
    month: 8,
    day: 29,
    monthDay: "08-29",
  };
  const wikitext = "* [[1960年]]：歌手甲发行专辑。";
  const usedFingerprint = buildHistoryFingerprint(
    "08-29",
    1960,
    "歌手甲发行专辑。",
  );
  const persisted: StoredHistoryEntry[] = [];
  const createPayloads: Array<HistoryEntryCreateInput["data"]> = [];
  let findManyCalls = 0;
  let transactionAttempts = 0;

  const restore = installServiceMocks(
    async () => {
      findManyCalls += 1;
      if (findManyCalls === 1) {
        return [];
      }
      if (findManyCalls === 2) {
        return [{ fingerprint: usedFingerprint }];
      }
      if (findManyCalls === 3) {
        return persisted;
      }
      if (findManyCalls === 4) {
        return [{ fingerprint: usedFingerprint }];
      }
      if (findManyCalls === 5) {
        return persisted;
      }

      throw new Error(`unexpected findMany call ${findManyCalls}`);
    },
    async (input) => {
      const { data } = input as HistoryEntryCreateInput;
      createPayloads.push(data);
      return data;
    },
    async () => {
      transactionAttempts += 1;
      if (transactionAttempts === 1) {
        throw new Prisma.PrismaClientKnownRequestError("conflict", {
          code: "P2002",
          clientVersion: "test",
        });
      }

      persisted.push(
        ...createPayloads.slice(-3).map((data) => ({
          eventYear: data.eventYear,
          event: data.event,
          artist: data.artist,
          sourceUrl: data.sourceUrl,
        })),
      );
    },
    async () => wikiResponse(wikitext),
  );

  try {
    const result = await getOrCreateHistoryBatch(localHistoryDate);
    assert.equal(result.events.length, 3);
    assert.equal(result.events.every((event) => event.isKnowledge), true);
    assert.equal(result.source, "local");
    assert.equal(result.saved, true);
    assert.equal(result.exhausted, false);
    assert.equal(createPayloads.some((data) => data.fingerprint === usedFingerprint), false);
  } finally {
    restore();
  }
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
