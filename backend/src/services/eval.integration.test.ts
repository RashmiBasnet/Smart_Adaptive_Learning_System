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

test("held-out POST persists an inert, item-graded submission", async (t) => {
  const ctx = await context();
  if (!ctx) return t.skip("database unavailable or not seeded with held-out flags");

  const heldOut = await prisma.question.findMany({
    where: { conceptId: ctx.concept.id, heldOut: true },
    select: { id: true, options: { select: { id: true, isCorrect: true } } },
  });

  // Answer the first question WRONG (when a wrong option exists) and the rest
  // correctly, so the test proves per-item grading in both directions.
  const expectedByQuestion = new Map<number, boolean>();
  const answers = heldOut.map((q, i) => {
    const correctOpt = q.options.find((o) => o.isCorrect)!;
    const wrongOpt = q.options.find((o) => !o.isCorrect);
    const pick = i === 0 && wrongOpt ? wrongOpt : correctOpt;
    expectedByQuestion.set(q.id, pick.isCorrect);
    return { questionId: q.id, selectedOptionId: pick.id };
  });
  const expectedCorrect = [...expectedByQuestion.values()].filter(Boolean).length;

  // A throwaway student to satisfy the submission's FK; removed in cleanup.
  const student = await prisma.student.create({
    data: {
      email: `eval-int-${Date.now()}@example.test`,
      passwordHash: "x",
      name: "Eval Integration",
    },
  });

  // Snapshot the adaptive tables to prove the eval flow writes to none of them.
  const before = {
    attempts: await prisma.quizAttempt.count(),
    mastery: await prisma.conceptMastery.count(),
    history: await prisma.masteryHistory.count(),
    recommendations: await prisma.recommendation.count(),
  };

  try {
    const result = await gradeHeldOutSubmission(student.id, SLUG, {
      phase: "PRE",
      studyMode: "transparent",
      answers,
    });

    // (1) Score is correct-out-of-total.
    assert.equal(result.correct, expectedCorrect);
    assert.equal(result.total, heldOut.length);

    // Exactly one submission, with the expected fields persisted.
    const submissions = await prisma.evalSubmission.findMany({
      where: { studentId: student.id },
      include: { responses: true },
    });
    assert.equal(submissions.length, 1);
    const sub = submissions[0];
    assert.equal(sub.id, result.submissionId);
    assert.equal(sub.conceptId, ctx.concept.id);
    assert.equal(sub.phase, "PRE");
    assert.equal(sub.studyMode, "transparent");
    assert.equal(sub.correct, expectedCorrect);
    assert.equal(sub.total, heldOut.length);

    // (2) One response per submitted answer; isCorrect matches the held-out key.
    assert.equal(sub.responses.length, answers.length);
    for (const r of sub.responses) {
      assert.equal(r.isCorrect, expectedByQuestion.get(r.questionId));
    }

    // (3) Inertness: no QuizAttempt / ConceptMastery / MasteryHistory /
    // Recommendation rows were created. This is the guarantee an examiner probes.
    assert.equal(await prisma.quizAttempt.count(), before.attempts);
    assert.equal(await prisma.conceptMastery.count(), before.mastery);
    assert.equal(await prisma.masteryHistory.count(), before.history);
    assert.equal(await prisma.recommendation.count(), before.recommendations);
  } finally {
    // Cascade removes the submission's responses; then remove the student.
    await prisma.evalSubmission.deleteMany({ where: { studentId: student.id } });
    await prisma.student.delete({ where: { id: student.id } });
  }
});

test("held-out POST rejects a non-held-out (practice) question", async (t) => {
  const ctx = await context();
  if (!ctx) return t.skip("database unavailable or not seeded with held-out flags");

  const practice = await prisma.question.findFirst({
    where: { conceptId: ctx.concept.id, heldOut: false },
    select: { id: true, options: { select: { id: true } } },
  });
  assert.ok(practice, "expected a practice question to exist");

  // Rejects before any write, so the sentinel id (no such student) is safe.
  await assert.rejects(
    () =>
      gradeHeldOutSubmission(FRESH_STUDENT_ID, SLUG, {
        phase: "PRE",
        answers: [{ questionId: practice!.id, selectedOptionId: practice!.options[0].id }],
      }),
    /not held-out questions/
  );
});
