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
