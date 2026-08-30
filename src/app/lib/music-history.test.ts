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
