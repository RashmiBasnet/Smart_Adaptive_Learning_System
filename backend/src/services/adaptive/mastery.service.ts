// Applies the Elo engine (mastery.ts) to the database: reads the current rating,
// runs the engine, and writes the updated mastery + a history row.

import { prisma } from "../../config/prisma";
import {
  ELO,
  GradedAnswer,
  applyQuiz,
  masteryPercent,
  isMastered,
  hasEnoughQuestions,
  buildAttemptMasteryReason,
} from "./mastery";

export interface RecordConceptMasteryInput {
  studentId: number;
  conceptId: number;
  conceptTitle: string; // used in the reason string
  attemptId: number; // the graded quiz attempt that triggered this update
  answers: GradedAnswer[]; // this concept's graded answers, in order
}

export interface RecordConceptMasteryResult {
  updated: boolean; // false when skipped for too few questions
  oldRating: number;
  newRating: number;
  oldPercent: number;
  newPercent: number;
  mastered: boolean;
  reason: string | null;
}

// Apply a graded quiz's answers for one concept and persist the new mastery
// (upsert concept_mastery + add a mastery_history row), in one transaction.
export async function recordConceptMastery(
  input: RecordConceptMasteryInput
): Promise<RecordConceptMasteryResult> {
  const { studentId, conceptId, conceptTitle, attemptId, answers } = input;

  // Current rating, or cold-start if this concept is new to the student.
  const existing = await prisma.conceptMastery.findUnique({
    where: { studentId_conceptId: { studentId, conceptId } },
    select: { masteryScore: true },
  });
  const oldRating = existing?.masteryScore ?? ELO.COLD_START_RATING;

  // Too few graded questions to trust the score: skip the update.
  if (!hasEnoughQuestions(answers.length)) {
    return {
      updated: false,
      oldRating,
      newRating: oldRating,
      oldPercent: masteryPercent(oldRating),
      newPercent: masteryPercent(oldRating),
      mastered: isMastered(oldRating),
      reason: null,
    };
  }

  const { finalRating } = applyQuiz(oldRating, answers);
  const correctCount = answers.filter((a) => a.correct).length;
  const reason = buildAttemptMasteryReason({
    concept: conceptTitle,
    correctCount,
    totalCount: answers.length,
    oldRating,
    newRating: finalRating,
  });

  await prisma.$transaction([
    prisma.conceptMastery.upsert({
      where: { studentId_conceptId: { studentId, conceptId } },
      create: {
        studentId,
        conceptId,
        masteryScore: finalRating,
        attemptsCount: 1,
      },
      update: {
        masteryScore: finalRating,
        attemptsCount: { increment: 1 },
      },
    }),
    prisma.masteryHistory.create({
      data: {
        studentId,
        conceptId,
        masteryScore: finalRating,
        previousScore: oldRating,
        reason,
        attemptId,
      },
    }),
  ]);

  return {
    updated: true,
    oldRating,
    newRating: finalRating,
    oldPercent: masteryPercent(oldRating),
    newPercent: masteryPercent(finalRating),
    mastered: isMastered(finalRating),
    reason,
  };
}
