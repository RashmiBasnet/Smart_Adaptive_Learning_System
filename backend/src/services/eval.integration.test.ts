// End-to-end checks for the held-out instrument against the real seeded DB.
// These verify the two guarantees a pure test can't: the serveQuiz `heldOut:
// false` filter, and that grading an eval submission has no adaptive side
// effects. Skipped cleanly when the database is unavailable or unseeded, so the
// pure suite still runs anywhere.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../config/prisma";
import { serveQuiz } from "./quiz.service";
import { getHeldOutQuestions, gradeHeldOutSubmission } from "./eval.service";

const SLUG = "arrays"; // a graph root: no prerequisites, so the quiz is unlocked
const FRESH_STUDENT_ID = 999_000_001; // no rows anywhere → read-only, side-effect free

// Resolve arrays + its held-out ids, or null when the DB isn't reachable/seeded.
async function context() {
  try {
    const concept = await prisma.concept.findUnique({ where: { slug: SLUG } });
    if (!concept) return null;
    const heldOut = await prisma.question.findMany({
      where: { conceptId: concept.id, heldOut: true },
      select: { id: true },
    });
    if (heldOut.length === 0) return null; // not seeded with held-out flags yet
    return { concept, heldOutIds: new Set(heldOut.map((q) => q.id)) };
  } catch {
    return null; // DB down
  }
}

after(async () => {
  await prisma.$disconnect();
});

test("serveQuiz never serves a held-out question", async (t) => {
  const ctx = await context();
  if (!ctx) return t.skip("database unavailable or not seeded with held-out flags");

  // Serve several times: the draw is random, so repeat to catch any leak.
  for (let i = 0; i < 10; i++) {
    const quiz = await serveQuiz(FRESH_STUDENT_ID, ctx.concept.id);
    for (const q of quiz.questions) {
      assert.equal(ctx.heldOutIds.has(q.id), false, `served held-out question ${q.id}`);
    }
  }
});

test("held-out GET returns only held-out questions and leaks no answer key", async (t) => {
  const ctx = await context();
  if (!ctx) return t.skip("database unavailable or not seeded with held-out flags");

  const result = await getHeldOutQuestions(SLUG);
  assert.equal(result.totalQuestions, ctx.heldOutIds.size);
  assert.equal(result.questions.length, ctx.heldOutIds.size);
  for (const q of result.questions) {
    assert.equal(ctx.heldOutIds.has(q.id), true);
  }
  // No isCorrect / explanation anywhere in the payload.
  const wire = JSON.stringify(result);
  assert.equal(wire.includes("isCorrect"), false);
  assert.equal(wire.includes("explanation"), false);
});

test("held-out POST returns a score and creates no attempt or recommendation", async (t) => {
  const ctx = await context();
  if (!ctx) return t.skip("database unavailable or not seeded with held-out flags");

  // Answer every held-out question correctly to verify grading end-to-end.
  const heldOut = await prisma.question.findMany({
    where: { conceptId: ctx.concept.id, heldOut: true },
    select: { id: true, options: { select: { id: true, isCorrect: true } } },
  });
  const answers = heldOut.map((q) => ({
    questionId: q.id,
    selectedOptionId: q.options.find((o) => o.isCorrect)!.id,
  }));

  const attemptsBefore = await prisma.quizAttempt.count();
  const recommendationsBefore = await prisma.recommendation.count();

  const result = await gradeHeldOutSubmission(SLUG, answers);

  assert.deepEqual(
    { correct: result.correct, total: result.total },
    { correct: heldOut.length, total: heldOut.length }
  );
  // The eval flow is inert with respect to the adaptive pipeline.
  assert.equal(await prisma.quizAttempt.count(), attemptsBefore);
  assert.equal(await prisma.recommendation.count(), recommendationsBefore);
});

test("held-out POST rejects a non-held-out (practice) question", async (t) => {
  const ctx = await context();
  if (!ctx) return t.skip("database unavailable or not seeded with held-out flags");

  const practice = await prisma.question.findFirst({
    where: { conceptId: ctx.concept.id, heldOut: false },
    select: { id: true, options: { select: { id: true } } },
  });
  assert.ok(practice, "expected a practice question to exist");

  await assert.rejects(
    () =>
      gradeHeldOutSubmission(SLUG, [
        { questionId: practice!.id, selectedOptionId: practice!.options[0].id },
      ]),
    /not held-out questions/
  );
});
