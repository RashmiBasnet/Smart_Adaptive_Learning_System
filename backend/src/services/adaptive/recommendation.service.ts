import { prisma } from "../../config/prisma";
import { ELO } from "./mastery";
import {
  RecommendationType,
  selectRecommendation,
  buildRecommendationReason,
} from "./recommendation";

export interface GenerateRecommendationResult {
  type: RecommendationType;
  persisted: boolean; // false for ALL_MASTERED (nothing stored)
  targetConceptId: number | null;
  reason: string;
  recommendationId: number | null;
}

// Generate and persist the next recommendation for a student.
export async function generateRecommendation(
  studentId: number,
  triggeredByAttemptId: number | null = null
): Promise<GenerateRecommendationResult> {
  const [concepts, edges, masteryRows] = await Promise.all([
    prisma.concept.findMany({ select: { id: true, title: true } }),
    prisma.conceptPrerequisite.findMany({
      select: { conceptId: true, prerequisiteId: true },
    }),
    prisma.conceptMastery.findMany({
      where: { studentId },
      select: { conceptId: true, masteryScore: true },
    }),
  ]);

  const ratingByConceptId = new Map(
    masteryRows.map((m) => [m.conceptId, m.masteryScore])
  );
  const titleById = new Map(concepts.map((c) => [c.id, c.title]));

  const selection = selectRecommendation({ concepts, edges, ratingByConceptId });

  // Nothing actionable to store.
  if (selection.type === "ALL_MASTERED" || selection.targetConceptId === null) {
    return {
      type: selection.type,
      persisted: false,
      targetConceptId: null,
      reason: buildRecommendationReason({
        type: "ALL_MASTERED",
        conceptTitle: "",
        targetRating: 0,
      }),
      recommendationId: null,
    };
  }

  const targetId = selection.targetConceptId;
  const reason = buildRecommendationReason({
    type: selection.type,
    conceptTitle: titleById.get(targetId) ?? "",
    dependentTitle:
      selection.dependentConceptId != null
        ? titleById.get(selection.dependentConceptId)
        : undefined,
    targetRating: ratingByConceptId.get(targetId) ?? ELO.COLD_START_RATING,
  });

  const created = await prisma.recommendation.create({
    data: {
      studentId,
      conceptId: targetId,
      type: selection.type,
      reason,
      triggeredByAttemptId,
    },
  });

  return {
    type: selection.type,
    persisted: true,
    targetConceptId: targetId,
    reason,
    recommendationId: created.id,
  };
}

// Latest stored recommendation, for the dashboard to display.
export async function getLatestRecommendation(studentId: number) {
  return prisma.recommendation.findFirst({
    where: { studentId },
    orderBy: { createdAt: "desc" },
  });
}
