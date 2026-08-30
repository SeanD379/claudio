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

test("buildHistoryFingerprint uses SHA-256 and normalizes equivalent event text", () => {
  const expected = "4970330000b005a0c0c674ae3f0a263fcf81dde00177dcc6c0a26009a3f01903";

  assert.equal(
    buildHistoryFingerprint("08-30", 1965, "ＡＢＣ， 歌手！"),
    expected,
  );
  assert.equal(buildHistoryFingerprint("08-30", 1965, "abc歌手"), expected);
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
* [[1960年]]：音乐事件甲
* [[1961年]]:音乐事件乙
* [[1962年]]—音乐事件丙
* [[1963年]]–音乐事件丁
* [[1964年]]-音乐事件戊
* [[1965年]]音乐事件己
# [[1966年]]：音乐事件庚
`;

  assert.deepEqual(
    parseMusicHistoryWikitext(source, "08-30").map((item) => item.eventYear),
    [1960, 1961, 1962, 1963, 1964, 1965],
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
