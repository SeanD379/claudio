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

test("HistoryCandidate permits a null source URL for local fallbacks", () => {
  const localCandidate: HistoryCandidate = {
    eventYear: 1965,
    event: "本地音乐事件",
    artist: null,
    sourceType: "local",
    sourceTitle: "本地数据",
    sourceUrl: null,
    fingerprint: "local",
  };

  assert.equal(localCandidate.sourceUrl, null);
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
