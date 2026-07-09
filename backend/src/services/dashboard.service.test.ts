import { test } from "node:test";
import assert from "node:assert/strict";
import { ELO, masteryPercent } from "./adaptive/mastery";
import {
  buildOverviewConcepts,
  buildStrengths,
  buildHistoryPoints,
  OverviewConcept,
} from "./dashboard.service";

const concepts = [
  { id: 1, slug: "arrays", title: "Arrays" },
  { id: 2, slug: "linked-lists", title: "Linked Lists" },
  { id: 3, slug: "stacks", title: "Stacks" },
  { id: 4, slug: "queues", title: "Queues" },
  { id: 5, slug: "hash-tables", title: "Hash Tables" },
  { id: 6, slug: "trees", title: "Trees" },
  { id: 7, slug: "graphs", title: "Graphs" },
];

// 1. Overview includes every concept; unattempted ones carry cold-start defaults.
test("overview covers all concepts with cold-start defaults for unattempted", () => {
  const masteryRows = [{ conceptId: 1, masteryScore: 1350 }];
  const attemptStats = [{ conceptId: 1, attempts: 4, lastAttemptAt: new Date() }];

  const overview = buildOverviewConcepts(concepts, masteryRows, attemptStats);
  assert.equal(overview.length, 7);

  const attempted = overview.find((c) => c.conceptId === 1)!;
  assert.equal(attempted.rating, 1350);
  assert.equal(attempted.band, "strong");
  assert.equal(attempted.mastered, true);
  assert.equal(attempted.attempts, 4);

  for (const c of overview.filter((c) => c.conceptId !== 1)) {
    assert.equal(c.rating, ELO.COLD_START_RATING);
    assert.equal(c.band, "medium"); // cold-start = medium, never weak
    assert.equal(c.mastered, false);
    assert.equal(c.attempts, 0);
    assert.equal(c.lastAttemptAt, null);
    assert.equal(c.masteryPercent, masteryPercent(ELO.COLD_START_RATING));
  }
});

// 2. Strengths: banding correct, zero-attempt concepts excluded, medium excluded.
test("strengths exclude medium and zero-attempt concepts", () => {
  const masteryRows = [
    { conceptId: 1, masteryScore: 1150 }, // weak, attempted
    { conceptId: 2, masteryScore: 1250 }, // medium, attempted
    { conceptId: 3, masteryScore: 1350 }, // strong, attempted
    { conceptId: 4, masteryScore: 1100 }, // weak, but ZERO attempts
  ];
  const attemptStats = [
    { conceptId: 1, attempts: 2, lastAttemptAt: new Date() },
    { conceptId: 2, attempts: 1, lastAttemptAt: new Date() },
    { conceptId: 3, attempts: 3, lastAttemptAt: new Date() },
  ];

  const overview = buildOverviewConcepts(concepts, masteryRows, attemptStats);
  const { weak, strong } = buildStrengths(overview);

  assert.deepEqual(weak.map((c) => c.conceptId), [1]); // 4 excluded: no attempts
  assert.deepEqual(strong.map((c) => c.conceptId), [3]); // 2 excluded: medium
  assert.equal(weak[0].band, "weak");
  assert.equal(strong[0].band, "strong");
});

// 3. Mastery-history points keep row order (service queries oldest → newest)
//    and expose rating + the canonical percent.
test("history points preserve order and derive percent canonically", () => {
  const rows = [
    { masteryScore: 1216, recordedAt: new Date("2026-07-01T10:00:00Z") },
    { masteryScore: 1248, recordedAt: new Date("2026-07-03T10:00:00Z") },
    { masteryScore: 1230, recordedAt: new Date("2026-07-05T10:00:00Z") },
  ];
  const points = buildHistoryPoints(rows);

  assert.equal(points.length, 3);
  assert.deepEqual(points.map((p) => p.ratingAfter), [1216, 1248, 1230]);
  assert.deepEqual(points.map((p) => p.attemptAt), rows.map((r) => r.recordedAt));
  for (const [i, p] of points.entries()) {
    assert.equal(p.masteryPercentAfter, masteryPercent(rows[i].masteryScore));
  }
});

// 4. masteredCount logic: mastered flag flips exactly at the unlock rating.
test("mastered flag anchors to the single unlock threshold", () => {
  const masteryRows = [
    { conceptId: 1, masteryScore: ELO.MASTERY_UNLOCK_RATING }, // exactly at
    { conceptId: 2, masteryScore: ELO.MASTERY_UNLOCK_RATING - 1 }, // just below
  ];
  const overview = buildOverviewConcepts(concepts, masteryRows, []);
  assert.equal(overview.find((c) => c.conceptId === 1)!.mastered, true);
  assert.equal(overview.find((c) => c.conceptId === 2)!.mastered, false);
  assert.equal(overview.filter((c) => c.mastered).length, 1);
});

// 5. Strength entries expose rating (raw Elo), never a quiz score.
test("strength entries carry the raw rating", () => {
  const overview: OverviewConcept[] = buildOverviewConcepts(
    concepts,
    [{ conceptId: 1, masteryScore: 1350.5 }],
    [{ conceptId: 1, attempts: 1, lastAttemptAt: new Date() }]
  );
  const { strong } = buildStrengths(overview);
  assert.equal(strong[0].rating, 1350.5);
});
