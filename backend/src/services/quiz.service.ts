import { prisma } from "../config/prisma";
import { ELO, QUESTION_DIFFICULTY } from "./adaptive/mastery";
import { recordConceptMastery } from "./adaptive/mastery.service";
import { generateRecommendation } from "./adaptive/recommendation.service";
import { assertQuizUnlocked } from "./adaptive/gating.service";
import { HttpError } from "../utils/httpError";
import type { SubmitInput } from "../validators/quiz.validator";

const QUESTIONS_PER_QUIZ = 6;

type Band = "weak" | "medium" | "strong";
type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

// How many questions of each difficulty to serve per mastery band (approved
// step-5 bands). Each row sums to QUESTIONS_PER_QUIZ and never zeroes out a
// difficulty, so every quiz contains at least one question of each difficulty.
export const BAND_MIX: Record<Band, Record<Difficulty, number>> = {
  weak: { easy: 3, medium: 2, hard: 1 },
  medium: { easy: 2, medium: 2, hard: 2 },
  strong: { easy: 1, medium: 2, hard: 3 },
};

// Nearest-difficulty order used to backfill a shortfall in a difficulty.
const NEAREST_DIFFICULTY: Record<Difficulty, Difficulty[]> = {
  easy: ["medium", "hard"],
  medium: ["easy", "hard"],
  hard: ["medium", "easy"],
};

// Mastery band from the persisted Elo rating. Bands are defined directly in
// rating and anchored to the existing engine constants: below cold-start is
// weak; cold-start up to (not including) the mastery-unlock rating is medium;
// at/above the unlock rating (the single "mastered" threshold) is strong.
export function bandForRating(rating: number): Band {
  if (rating < ELO.COLD_START_RATING) return "weak";
  if (rating < ELO.MASTERY_UNLOCK_RATING) return "medium";
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

// Pick the quiz's questions for a band: draw the requested count of each
// difficulty at random without replacement, then backfill any shortfall from
// the nearest difficulty so the quiz still holds QUESTIONS_PER_QUIZ questions
// whenever the concept's overall pool is large enough.
export function selectQuestions<T extends { difficulty: string }>(
  questions: T[],
  band: Band
): T[] {
  const mix = BAND_MIX[band];
  const pools: Record<Difficulty, T[]> = { easy: [], medium: [], hard: [] };
  for (const q of questions) {
    if (q.difficulty in pools) pools[q.difficulty as Difficulty].push(q);
  }
  for (const d of DIFFICULTIES) pools[d] = shuffle(pools[d]);

  const selected: T[] = [];
  const shortfall: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };

  // First pass: take as many of each difficulty as requested (and available).
  for (const d of DIFFICULTIES) {
    const take = pools[d].splice(0, mix[d]);
    selected.push(...take);
    shortfall[d] = mix[d] - take.length;
  }

  // Backfill any shortfall from the nearest difficulty that still has questions.
  for (const d of DIFFICULTIES) {
    while (shortfall[d] > 0) {
      const donor = NEAREST_DIFFICULTY[d].find((n) => pools[n].length > 0);
      if (!donor) break; // nothing left anywhere in the concept's pool
      selected.push(pools[donor].shift()!);
      shortfall[d]--;
    }
  }

  return selected;
}

// The student's current band for a concept. A student with no mastery row is
// treated as the cold-start rating (which falls in the medium band); there is
// no placement test — cold-start is deferred to future work.
async function currentBand(studentId: number, conceptId: number): Promise<Band> {
  const mastery = await prisma.conceptMastery.findUnique({
    where: { studentId_conceptId: { studentId, conceptId } },
    select: { masteryScore: true },
  });
  const rating = mastery?.masteryScore ?? ELO.COLD_START_RATING;
  return bandForRating(rating);
}

// Assemble a 6-question quiz for a concept, banded by the student's mastery.
// Correct options are never included in the response.
export async function serveQuiz(studentId: number, conceptId: number) {
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: { id: true, slug: true, title: true },
  });
  if (!concept) throw new HttpError(404, "Concept not found");

  // Prerequisite gate (approved Option B): assessment is blocked until every
  // direct prerequisite is mastered. Lessons stay open; this is the API-side
  // enforcement — the UI lock is only the polite surface.
  await assertQuizUnlocked(studentId, concept);

  const band = await currentBand(studentId, conceptId);

  const questions = await prisma.question.findMany({
    where: { conceptId },
    select: {
      id: true,
      difficulty: true,
      stem: true,
      options: { select: { id: true, text: true } },
    },
  });

  const selected = selectQuestions(questions, band);

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

  // Same gate as serving: without this, posting answers directly would bypass
  // the lock and record an attempt on a concept whose prerequisites are unmet.
  await assertQuizUnlocked(studentId, concept);

  const questionIds = answers.map((a) => a.questionId);
  if (new Set(questionIds).size !== questionIds.length) {
    throw new HttpError(400, "Duplicate question in answers");
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds }, conceptId },
    include: { options: { select: { id: true, text: true, isCorrect: true } } },
    // explanation rides along via include's default scalar selection
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
  // Per-question feedback returned to the student (formative assessment):
  // what they picked, whether it was right, and the correct answer if not.
  const review: {
    questionId: number;
    stem: string;
    difficulty: string;
    isCorrect: boolean;
    selectedOptionText: string | null;
    correctOptionText: string;
    explanation: string | null;
  }[] = [];
  let correctCount = 0;

  for (const answer of answers) {
    const question = questionById.get(answer.questionId)!;
    const selectedOptionId = answer.selectedOptionId ?? null;

    const selectedOption =
      selectedOptionId !== null
        ? question.options.find((o) => o.id === selectedOptionId)
        : undefined;
    if (selectedOptionId !== null && !selectedOption) {
      throw new HttpError(400, "Selected option does not belong to its question");
    }

    const isCorrect = selectedOption?.isCorrect ?? false;
    if (isCorrect) correctCount++;

    responsesData.push({
      questionId: question.id,
      selectedOptionId,
      isCorrect,
      timeTakenSeconds: answer.timeTakenSeconds ?? null,
    });
    gradedAnswers.push({ questionDifficulty: difficultyRating(question.difficulty), correct: isCorrect });
    review.push({
      questionId: question.id,
      stem: question.stem,
      difficulty: question.difficulty,
      isCorrect,
      selectedOptionText: selectedOption?.text ?? null,
      correctOptionText: question.options.find((o) => o.isCorrect)!.text,
      explanation: question.explanation,
    });
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
  const recommendation = await generateRecommendation(studentId, attempt.id, conceptId);

  return {
    attemptId: attempt.id,
    // This attempt's score — distinct from the Elo-derived mastery percentage.
    quizScorePercent,
    correctCount,
    totalQuestions: total,
    review,
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
