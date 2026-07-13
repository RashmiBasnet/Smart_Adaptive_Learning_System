import { prisma } from "../../config/prisma";
import { ELO, isMastered } from "./mastery";
import {
  RecommendationType,
  selectRecommendation,
  buildRecommendationReason,
} from "./recommendation";
import {
  buildConceptGraph,
  traceRootCause,
  buildRootCauseReason,
} from "./rootCause";

export interface GenerateRecommendationResult {
  type: RecommendationType;
  persisted: boolean; // false for ALL_MASTERED (nothing stored)
  targetConceptId: number | null;
  reason: string;
  recommendationId: number | null;
}

// Generate and persist the next recommendation for a student.
//
// `triggerConceptId` is the concept the student just quizzed on (when this runs
// after an attempt). It drives the root-cause trace only — the selection,
// target, and type are unchanged by it.
export async function generateRecommendation(
  studentId: number,
  triggeredByAttemptId: number | null = null,
  triggerConceptId: number | null = null
): Promise<GenerateRecommendationResult> {
  const [concepts, edges, masteryRows] = await Promise.all([
    prisma.concept.findMany({ select: { id: true, slug: true, title: true } }),
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
  const baseReason = buildRecommendationReason({
    type: selection.type,
    conceptTitle: titleById.get(targetId) ?? "",
    dependentTitle:
      selection.dependentConceptId != null
        ? titleById.get(selection.dependentConceptId)
        : undefined,
    targetRating: ratingByConceptId.get(targetId) ?? ELO.COLD_START_RATING,
  });

  // Enrich the reason with a root-cause trace of the concept the student just
  // quizzed on. The engine already picks the most foundational gap globally, so
  // tracing the *surface* concept the student experienced is what adds signal:
  // it walks the broken chain down to the root gap the recommendation targets.
  // We only prefer the trace when it stays coherent with the persisted target,
  // so the reason can never contradict what the recommendation points at.
  const reason = rootCauseReason(
    triggerConceptId,
    targetId,
    concepts,
    edges,
    ratingByConceptId,
    titleById
  ) ?? baseReason;

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

// Build a root-cause reason for the just-quizzed concept, or null to fall back
// to the plain recommendation reason. Returns null when there is no triggering
// concept, when that concept isn't actually weak (nothing to diagnose), or when
// the trace's roots don't line up with the recommendation's target (which would
// make the reason talk about a different concept than the one being suggested).
function rootCauseReason(
  triggerConceptId: number | null,
  targetId: number,
  concepts: { id: number; slug: string; title: string }[],
  edges: { conceptId: number; prerequisiteId: number }[],
  ratingByConceptId: Map<number, number>,
  titleById: Map<number, string>
): string | null {
  if (triggerConceptId == null) return null;

  const triggerRating = ratingByConceptId.get(triggerConceptId) ?? ELO.COLD_START_RATING;
  if (isMastered(triggerRating)) return null; // did fine — no gap to trace

  const triggerName = titleById.get(triggerConceptId);
  if (triggerName === undefined) return null;

  const graph = buildConceptGraph(concepts, edges);
  const trace = traceRootCause(triggerConceptId, graph, ratingByConceptId);

  // Only enrich when the trace surfaces a genuine deeper root gap AND that root
  // is what the recommendation targets. When the weakness is in the concept
  // itself (selfIsGap), the plain recommendation reason is already correct and
  // more actionable, so we leave it alone rather than downgrade it.
  const coherent = !trace.selfIsGap && trace.roots.some((r) => r.conceptId === targetId);
  if (!coherent) return null;

  return buildRootCauseReason(triggerName, trace);
}

// Latest stored recommendation, for the dashboard to display.
export async function getLatestRecommendation(studentId: number) {
  return prisma.recommendation.findFirst({
    where: { studentId },
    orderBy: { createdAt: "desc" },
  });
}
