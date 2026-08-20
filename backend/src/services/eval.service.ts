import { prisma } from "../config/prisma";
import { HttpError } from "../utils/httpError";
import type { EvalSubmitInput } from "../validators/eval.validator";

// The held-out evaluation instrument: read + grade the questions flagged
// heldOut on each concept. This is deliberately NOT a second quiz engine — it
// has no adaptivity, never reveals answers or explanations, and has no mastery
// or recommendation side-effects. It exists only so the study has a clean
// pre/post test that the practice pool (re-takeable, explanations shown) can't
// contaminate.

// A held-out question as returned to the student: no isCorrect, no explanation.
// Same shape as a served practice quiz question.
export interface EvalQuestion {
  id: number;
  difficulty: string;
  stem: string;
  options: { id: number; text: string }[];
}

// Strip a question down to the safe eval shape. Written to accept the full
// question (with isCorrect/explanation) so it is provably impossible for those
// fields to reach the response — see the leak test.
export function toEvalQuestion(q: {
  id: number;
  difficulty: string;
  stem: string;
  explanation?: string | null;
  options: { id: number; text: string; isCorrect?: boolean }[];
}): EvalQuestion {
  return {
    id: q.id,
    difficulty: q.difficulty,
    stem: q.stem,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  };
}

// Grade a set of answers against the concept's held-out questions. Pure: the
// score is correct-out-of-total, where total is the size of the held-out set
// (an unanswered held-out question counts as incorrect). No answers are
// revealed and nothing is persisted here.
export function gradeHeldOut(
  heldOutQuestions: { id: number; options: { id: number; isCorrect: boolean }[] }[],
  answers: { questionId: number; selectedOptionId?: number | null }[]
): { correct: number; total: number } {
  const selectedByQuestion = new Map(
    answers.map((a) => [a.questionId, a.selectedOptionId ?? null])
  );

  let correct = 0;
  for (const q of heldOutQuestions) {
    const selectedOptionId = selectedByQuestion.get(q.id);
    if (selectedOptionId == null) continue; // not answered → incorrect
    const chosen = q.options.find((o) => o.id === selectedOptionId);
    if (chosen?.isCorrect) correct++;
  }

  return { correct, total: heldOutQuestions.length };
}

// Resolve a concept by slug (eval endpoints address concepts by slug, unlike
// the numeric-id quiz routes).
async function resolveConcept(conceptSlug: string) {
  const concept = await prisma.concept.findUnique({
    where: { slug: conceptSlug },
    select: { id: true, slug: true, title: true },
  });
  if (!concept) throw new HttpError(404, "Concept not found");
  return concept;
}

// GET: the held-out questions for a concept, safe shape only. No prerequisite
// gating — the study administers the pre-test before anything is mastered.
export async function getHeldOutQuestions(conceptSlug: string) {
  const concept = await resolveConcept(conceptSlug);

  const questions = await prisma.question.findMany({
    where: { conceptId: concept.id, heldOut: true },
    select: {
      id: true,
      difficulty: true,
      stem: true,
      options: { select: { id: true, text: true } },
    },
  });

  return {
    conceptId: concept.id,
    conceptSlug: concept.slug,
    conceptTitle: concept.title,
    totalQuestions: questions.length,
    questions: questions.map(toEvalQuestion),
  };
}

// POST: grade held-out answers, PERSIST the sitting, and return the score. The
// submission and its per-question responses are the only rows written. It is
// intentionally inert with respect to the adaptive flow: it does NOT create a
// QuizAttempt, update ConceptMastery, write MasteryHistory, or generate a
// Recommendation. That inertness is asserted in the integration test.
export async function gradeHeldOutSubmission(
  studentId: number,
  conceptSlug: string,
  input: EvalSubmitInput
) {
  const concept = await resolveConcept(conceptSlug);

  const heldOut = await prisma.question.findMany({
    where: { conceptId: concept.id, heldOut: true },
    select: { id: true, options: { select: { id: true, isCorrect: true } } },
  });

  // Answers may only reference this concept's held-out questions — keeps the
  // instrument clean and rejects practice questions submitted by mistake.
  const heldOutById = new Map(heldOut.map((q) => [q.id, q]));
  if (input.answers.some((a) => !heldOutById.has(a.questionId))) {
    throw new HttpError(400, "One or more answers are not held-out questions for this concept");
  }

  const { correct, total } = gradeHeldOut(heldOut, input.answers);

  // Per-answer correctness, using the same rule as gradeHeldOut: a chosen
  // option counts only if it is the correct option OF THAT question.
  const answerIsCorrect = (a: EvalSubmitInput["answers"][number]): boolean => {
    if (a.selectedOptionId == null) return false;
    const chosen = heldOutById
      .get(a.questionId)
      ?.options.find((o) => o.id === a.selectedOptionId);
    return chosen?.isCorrect === true;
  };

  // One atomic write via a nested create: the submission plus its response
  // rows, and nothing else. (A single nested create is transactional, which is
  // why the response rows can carry the new submission's id without a manual
  // two-step $transaction.)
  const submission = await prisma.evalSubmission.create({
    data: {
      studentId,
      conceptId: concept.id,
      phase: input.phase,
      studyMode: input.studyMode ?? null,
      correct,
      total,
      responses: {
        create: input.answers.map((a) => ({
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId ?? null,
          isCorrect: answerIsCorrect(a),
        })),
      },
    },
    select: { id: true },
  });

  return {
    submissionId: submission.id,
    conceptSlug: concept.slug,
    conceptTitle: concept.title,
    correct,
    total,
  };
}
