// Unit tests for the Elo mastery engine (MASTERY_ENGINE.md §7 stop-gate).
// Uses Node's built-in test runner (no test-framework dependency).
// Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ELO,
  QUESTION_DIFFICULTY,
  expectedScore,
  updatedRating,
  applyQuiz,
  masteryPercent,
  isMastered,
  buildMasteryReason,
  buildAttemptMasteryReason,
} from "./mastery";

const approx = (actual: number, expected: number, tol = 0.1) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ~${expected}, got ${actual}`);

// ── Worked example 1 (§7): rating 1200, hard question (1400), correct ──────────
test("worked example 1: pass a hard question -> solid jump up", () => {
  const e = expectedScore(1200, QUESTION_DIFFICULTY.hard);
  approx(e, 0.24, 0.005);
  const r = updatedRating(1200, QUESTION_DIFFICULTY.hard, true);
  approx(r, 1224.3, 0.2);
});

// ── Worked example 2 (§7 sanity): rating 1200, easy question (1000), wrong ─────
test("worked example 2: fail an easy question -> noticeable drop", () => {
  const e = expectedScore(1200, QUESTION_DIFFICULTY.easy);
  approx(e, 0.76, 0.005);
  const r = updatedRating(1200, QUESTION_DIFFICULTY.easy, false);
  approx(r, 1175.7, 0.2);
});

// ── Symmetry / sanity ─────────────────────────────────────────────────────────
test("a medium question (= student rating) gives ~50% expected", () => {
  approx(expectedScore(1200, QUESTION_DIFFICULTY.medium), 0.5, 1e-9);
});

test("correct raises rating, incorrect lowers it", () => {
  assert.ok(updatedRating(1200, 1200, true) > 1200);
  assert.ok(updatedRating(1200, 1200, false) < 1200);
});

// ── Sequential quiz processing (§3): later answers see the updated rating ──────
test("applyQuiz updates sequentially and traces every step", () => {
  const { finalRating, steps } = applyQuiz(1200, [
    { questionDifficulty: QUESTION_DIFFICULTY.hard, correct: true },
    { questionDifficulty: QUESTION_DIFFICULTY.easy, correct: false },
  ]);
  assert.equal(steps.length, 2);
  // step 1 matches worked example 1
  approx(steps[0].newRating, 1224.3, 0.2);
  // step 2 starts from step 1's result (not from 1200)
  assert.equal(steps[1].oldRating, steps[0].newRating);
  assert.equal(finalRating, steps[1].newRating);
});

// ── Display percentage mapping (§6) ───────────────────────────────────────────
test("masteryPercent: 1200->50, 1300->~64, 1400->~76", () => {
  assert.equal(masteryPercent(1200), 50);
  assert.equal(masteryPercent(1300), 64);
  assert.equal(masteryPercent(1400), 76);
});

// ── Mastery unlock threshold (§4) ─────────────────────────────────────────────
test("isMastered gates on the unlock rating", () => {
  assert.equal(isMastered(ELO.MASTERY_UNLOCK_RATING - 0.01), false);
  assert.equal(isMastered(ELO.MASTERY_UNLOCK_RATING), true);
});

// ── Reason string (§6) — the research contribution ────────────────────────────
test("buildMasteryReason fills the §6 template with display percentages", () => {
  const reason = buildMasteryReason({
    concept: "Stacks",
    difficulty: "hard",
    correct: true,
    oldRating: 1200,
    newRating: 1224.3,
  });
  assert.equal(
    reason,
    "You answered a hard Stacks question correctly. Your Stacks mastery moved from 50% to 53%."
  );
});

test("buildAttemptMasteryReason summarizes a quiz at attempt level", () => {
  const reason = buildAttemptMasteryReason({
    concept: "Arrays",
    correctCount: 3,
    totalCount: 5,
    oldRating: 1200,
    newRating: 1220.8,
  });
  assert.equal(
    reason,
    "You completed a quiz on Arrays (3/5 correct). Your Arrays mastery moved from 50% to 53%."
  );
});
