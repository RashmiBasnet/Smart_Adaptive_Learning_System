import { test } from "node:test";
import assert from "node:assert/strict";
import { ELO } from "./adaptive/mastery";
import { bandForRating, selectQuestions, BAND_MIX } from "./quiz.service";

type Q = { id: number; difficulty: "easy" | "medium" | "hard" };

// Build a question pool with the given count of each difficulty.
function makePool(counts: { easy: number; medium: number; hard: number }): Q[] {
  const pool: Q[] = [];
  let id = 1;
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    for (let i = 0; i < counts[difficulty]; i++) pool.push({ id: id++, difficulty });
  }
  return pool;
}

function countByDifficulty(questions: Q[]) {
  return questions.reduce(
    (acc, q) => ({ ...acc, [q.difficulty]: acc[q.difficulty] + 1 }),
    { easy: 0, medium: 0, hard: 0 }
  );
}

// 1. Band classification at the approved boundaries (bands are defined in Elo
//    rating, anchored to the engine constants 1200 and 1300).
test("bandForRating classifies at the boundaries", () => {
  assert.equal(bandForRating(1199), "weak");
  assert.equal(bandForRating(1200), "medium");
  assert.equal(bandForRating(1299), "medium");
  assert.equal(bandForRating(1300), "strong");
  // Anchored to the shared constants, not hard-coded numbers.
  assert.equal(ELO.COLD_START_RATING, 1200);
  assert.equal(ELO.MASTERY_UNLOCK_RATING, 1300);
});

// 2. Each band serves the exact approved mix when the pool is large enough.
test("each band serves its exact difficulty mix", () => {
  const pool = makePool({ easy: 5, medium: 5, hard: 5 });
  for (const band of ["weak", "medium", "strong"] as const) {
    const counts = countByDifficulty(selectQuestions(pool, band));
    assert.deepEqual(counts, BAND_MIX[band], `mix for ${band} band`);
  }
});

// 3. Every quiz is exactly six questions (and each band mix sums to six).
test("every band produces six questions", () => {
  const pool = makePool({ easy: 5, medium: 5, hard: 5 });
  for (const band of ["weak", "medium", "strong"] as const) {
    assert.equal(selectQuestions(pool, band).length, 6);
    const mix = BAND_MIX[band];
    assert.equal(mix.easy + mix.medium + mix.hard, 6, `${band} mix sums to 6`);
  }
});

// 4. Backfill: a short difficulty pool is topped up from the nearest difficulty,
//    still totalling six.
test("backfills a short difficulty from the nearest one", () => {
  // strong wants 3 hard, but there are none: backfill from medium/easy.
  const pool = makePool({ easy: 5, medium: 5, hard: 0 });
  const selected = selectQuestions(pool, "strong");
  assert.equal(selected.length, 6);
  assert.equal(countByDifficulty(selected).hard, 0);
  // No duplicates were introduced while backfilling.
  assert.equal(new Set(selected.map((q) => q.id)).size, 6);
});

// 5. A new student (no mastery row → cold-start rating) lands in the medium band.
test("cold-start rating is the medium band", () => {
  assert.equal(bandForRating(ELO.COLD_START_RATING), "medium");
  const pool = makePool({ easy: 5, medium: 5, hard: 5 });
  const counts = countByDifficulty(selectQuestions(pool, bandForRating(ELO.COLD_START_RATING)));
  assert.deepEqual(counts, { easy: 2, medium: 2, hard: 2 });
});

// 6. When the whole pool is smaller than six, serve what exists (no duplicates).
test("serves the whole pool when fewer than six exist", () => {
  const pool = makePool({ easy: 2, medium: 1, hard: 1 });
  const selected = selectQuestions(pool, "medium");
  assert.equal(selected.length, 4);
  assert.equal(new Set(selected.map((q) => q.id)).size, 4);
});

// 7. After holding out 1 easy / 1 medium / 1 hard, the 12 remaining practice
//    questions still satisfy every band's exact mix (each band needs at most 3
//    of one difficulty, and 4 of each remain).
test("practice pool of 12 (4/4/4) still fills every band mix", () => {
  const practicePool = makePool({ easy: 4, medium: 4, hard: 4 });
  for (const band of ["weak", "medium", "strong"] as const) {
    const selected = selectQuestions(practicePool, band);
    assert.equal(selected.length, 6, `${band} still gets six`);
    assert.deepEqual(countByDifficulty(selected), BAND_MIX[band], `${band} exact mix`);
  }
});

// 8. selectQuestions only ever returns questions from the pool it is given.
//    serveQuiz feeds it the DB-filtered practice pool (heldOut: false), so this
//    subset property is what guarantees a held-out question can never be served.
test("selection is always a subset of the input pool", () => {
  const pool = makePool({ easy: 4, medium: 4, hard: 4 });
  const ids = new Set(pool.map((q) => q.id));
  for (const band of ["weak", "medium", "strong"] as const) {
    for (const q of selectQuestions(pool, band)) {
      assert.ok(ids.has(q.id), `${band}: returned id ${q.id} came from the pool`);
    }
  }
});
