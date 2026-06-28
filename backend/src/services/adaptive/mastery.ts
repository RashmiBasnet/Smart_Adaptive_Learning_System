// Elo mastery engine: pure functions that compute rating changes per (student, concept).
// No database access — persistence is handled in mastery.service.ts.

// Tunable constants. Do not change without project-chat approval.
export const ELO = {
  COLD_START_RATING: 1200, // starting rating for an unseen concept
  K_FACTOR: 32, // how strongly one answer moves the rating
  DIVISOR: 400, // Elo logistic divisor
  MASTERY_UNLOCK_RATING: 1300, // rating at/above which a concept is "mastered"
  MIN_GRADED_QUESTIONS: 5, // fewer than this is too noisy to score
  DISPLAY_REFERENCE_DIFFICULTY: 1200, // difficulty the display percentage is measured against
} as const;

// Question difficulty ratings, derived from the difficulty tag.
export const QUESTION_DIFFICULTY = {
  easy: 1000,
  medium: 1200,
  hard: 1400,
} as const;

export type DifficultyLabel = keyof typeof QUESTION_DIFFICULTY;

// Probability (0..1) that the student answers this question correctly.
export function expectedScore(studentRating: number, questionDifficulty: number): number {
  return 1 / (1 + Math.pow(10, (questionDifficulty - studentRating) / ELO.DIVISOR));
}

// New rating after answering one question.
export function updatedRating(
  studentRating: number,
  questionDifficulty: number,
  correct: boolean
): number {
  const expected = expectedScore(studentRating, questionDifficulty);
  const actual = correct ? 1 : 0;
  return studentRating + ELO.K_FACTOR * (actual - expected);
}

export interface GradedAnswer {
  questionDifficulty: number;
  correct: boolean;
}

// The rating change caused by a single answer.
export interface RatingStep {
  oldRating: number;
  newRating: number;
  questionDifficulty: number;
  correct: boolean;
  expected: number;
}

// Apply a quiz's answers in order, updating the rating after each one.
export function applyQuiz(startingRating: number, answers: GradedAnswer[]): {
  finalRating: number;
  steps: RatingStep[];
} {
  let rating = startingRating;
  const steps: RatingStep[] = [];
  for (const a of answers) {
    const expected = expectedScore(rating, a.questionDifficulty);
    const newRating = rating + ELO.K_FACTOR * ((a.correct ? 1 : 0) - expected);
    steps.push({
      oldRating: rating,
      newRating,
      questionDifficulty: a.questionDifficulty,
      correct: a.correct,
      expected,
    });
    rating = newRating;
  }
  return { finalRating: rating, steps };
}

// Whether a quiz has enough graded questions for the concept to count.
export function hasEnoughQuestions(gradedQuestionCount: number): boolean {
  return gradedQuestionCount >= ELO.MIN_GRADED_QUESTIONS;
}

// Whether a concept is mastered enough to unlock its dependents.
export function isMastered(rating: number): boolean {
  return rating >= ELO.MASTERY_UNLOCK_RATING;
}

// Rating converted to the 0–100% shown to the student.
export function masteryPercent(rating: number): number {
  return Math.round(100 * expectedScore(rating, ELO.DISPLAY_REFERENCE_DIFFICULTY));
}

// Reason string for a single answer's rating change.
export function buildMasteryReason(params: {
  concept: string;
  difficulty: DifficultyLabel;
  correct: boolean;
  oldRating: number;
  newRating: number;
}): string {
  const { concept, difficulty, correct, oldRating, newRating } = params;
  const verdict = correct ? "correctly" : "incorrectly";
  return (
    `You answered a ${difficulty} ${concept} question ${verdict}. ` +
    `Your ${concept} mastery moved from ${masteryPercent(oldRating)}% to ${masteryPercent(newRating)}%.`
  );
}

// Reason string for a whole quiz's rating change (one per concept per quiz).
export function buildAttemptMasteryReason(params: {
  concept: string;
  correctCount: number;
  totalCount: number;
  oldRating: number;
  newRating: number;
}): string {
  const { concept, correctCount, totalCount, oldRating, newRating } = params;
  return (
    `You completed a quiz on ${concept} (${correctCount}/${totalCount} correct). ` +
    `Your ${concept} mastery moved from ${masteryPercent(oldRating)}% to ${masteryPercent(newRating)}%.`
  );
}
