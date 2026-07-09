import { prisma } from "../config/prisma";
import { QUESTION_DIFFICULTY, masteryPercent } from "./adaptive/mastery";
import { recordConceptMastery } from "./adaptive/mastery.service";
import { generateRecommendation } from "./adaptive/recommendation.service";
import { HttpError } from "../utils/httpError";
import type { SubmitInput } from "../validators/quiz.validator";

const QUESTIONS_PER_QUIZ = 6;

type Band = "weak" | "medium" | "strong";

// How many questions of each difficulty to serve per mastery band.
const BAND_MIX: Record<Band, { easy: number; medium: number; hard: number }> = {
  weak: { easy: 3, medium: 3, hard: 0 },
  medium: { easy: 2, medium: 2, hard: 2 },
  strong: { easy: 0, medium: 3, hard: 3 },
};

function bandFor(masteryPct: number): Band {
  if (masteryPct < 40) return "weak";
  if (masteryPct <= 70) return "medium";
  return "strong";
}

// Numeric Elo difficulty for a question's difficulty tag.
function difficultyRating(tag: string): number {
  return (QUESTION_DIFFICULTY as Record<string, number>)[tag] ?? QUESTION_DIFFICULTY.medium;
}

function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The student's current band for a concept (cold-start = weak).
async function currentBand(studentId: number, conceptId: number): Promise<Band> {
  const mastery = await prisma.conceptMastery.findUnique({
    where: { studentId_conceptId: { studentId, conceptId } },
    select: { masteryScore: true },
  });
  return mastery ? bandFor(masteryPercent(mastery.masteryScore)) : "weak";
}

// Assemble a 6-question quiz for a concept, banded by the student's mastery.
// Correct options are never included in the response.
export async function serveQuiz(studentId: number, conceptId: number) {
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: { id: true, slug: true, title: true },
  });
  if (!concept) throw new HttpError(404, "Concept not found");

  const band = await currentBand(studentId, conceptId);
  const mix = BAND_MIX[band];

  const questions = await prisma.question.findMany({
    where: { conceptId },
    select: {
      id: true,
      difficulty: true,
      stem: true,
      options: { select: { id: true, text: true } },
    },
  });

  const byDifficulty: Record<string, typeof questions> = { easy: [], medium: [], hard: [] };
  for (const q of questions) (byDifficulty[q.difficulty] ??= []).push(q);

  const selected: typeof questions = [];
  for (const tag of ["easy", "medium", "hard"] as const) {
    const pool = shuffle(byDifficulty[tag] ?? []);
    selected.push(...pool.slice(0, mix[tag]));
  }

  return {
    conceptId: concept.id,
    conceptSlug: concept.slug,
    conceptTitle: concept.title,
    band,
    totalQuestions: selected.length,
    questions: shuffle(selected).map((q) => ({
      id: q.id,
      difficulty: q.difficulty,
      stem: q.stem,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  };
}

// Grade a submitted quiz, persist the attempt + responses, and update mastery and
// the recommendation through the existing services.
export async function submitQuiz(
  studentId: number,
  conceptId: number,
  answers: SubmitInput["answers"]
) {
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: { id: true, title: true },
  });
  if (!concept) throw new HttpError(404, "Concept not found");

  const questionIds = answers.map((a) => a.questionId);
  if (new Set(questionIds).size !== questionIds.length) {
    throw new HttpError(400, "Duplicate question in answers");
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds }, conceptId },
    include: { options: { select: { id: true, isCorrect: true } } },
  });
  if (questions.length !== questionIds.length) {
    throw new HttpError(400, "One or more questions do not belong to this concept");
  }
  const questionById = new Map(questions.map((q) => [q.id, q]));

  // Band the student was on before this attempt (for evaluation data).
  const servedBand = await currentBand(studentId, conceptId);

  const responsesData: {
    questionId: number;
    selectedOptionId: number | null;
    isCorrect: boolean;
    timeTakenSeconds: number | null;
  }[] = [];
  const gradedAnswers: { questionDifficulty: number; correct: boolean }[] = [];
  let correctCount = 0;

  for (const answer of answers) {
    const question = questionById.get(answer.questionId)!;
    const selectedOptionId = answer.selectedOptionId ?? null;

    if (selectedOptionId !== null && !question.options.some((o) => o.id === selectedOptionId)) {
      throw new HttpError(400, "Selected option does not belong to its question");
    }

    const isCorrect =
      selectedOptionId !== null &&
      question.options.some((o) => o.id === selectedOptionId && o.isCorrect);
    if (isCorrect) correctCount++;

    responsesData.push({
      questionId: question.id,
      selectedOptionId,
      isCorrect,
      timeTakenSeconds: answer.timeTakenSeconds ?? null,
    });
    gradedAnswers.push({ questionDifficulty: difficultyRating(question.difficulty), correct: isCorrect });
  }

  const total = answers.length;
  const quizScorePercent = Math.round((correctCount / total) * 100);

  const attempt = await prisma.quizAttempt.create({
    data: {
      studentId,
      conceptId,
      isPlacement: false,
      difficultyServed: servedBand,
      score: quizScorePercent,
      completedAt: new Date(),
      responses: { create: responsesData },
    },
    select: { id: true },
  });

  // Elo mastery update, then the next recommendation — both via existing services.
  const mastery = await recordConceptMastery({
    studentId,
    conceptId,
    conceptTitle: concept.title,
    attemptId: attempt.id,
    answers: gradedAnswers,
  });
  const recommendation = await generateRecommendation(studentId, attempt.id);

  return {
    attemptId: attempt.id,
    // This attempt's score — distinct from the Elo-derived mastery percentage.
    quizScorePercent,
    correctCount,
    totalQuestions: total,
    mastery: {
      updated: mastery.updated,
      oldPercent: mastery.oldPercent,
      newPercent: mastery.newPercent,
      mastered: mastery.mastered,
      reason: mastery.reason,
    },
    recommendation: {
      type: recommendation.type,
      targetConceptId: recommendation.targetConceptId,
      reason: recommendation.reason,
      persisted: recommendation.persisted,
    },
  };
}
