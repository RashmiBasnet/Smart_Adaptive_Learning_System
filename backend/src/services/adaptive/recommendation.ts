// Recommendation engine: pure functions that pick the next recommendation from
// the prerequisite graph + per-concept mastery. No database access — persistence
// lives in recommendation.service.ts.

import { ELO, isMastered, masteryPercent } from "./mastery";

export type RecommendationType =
  | "REVISE_PREREQUISITE"
  | "PRACTISE_CURRENT"
  | "ADVANCE_NEXT"
  | "ALL_MASTERED";

export interface ConceptNode {
  id: number;
  title: string;
}

// One directed edge: conceptId depends on prerequisiteId.
export interface PrerequisiteEdge {
  conceptId: number;
  prerequisiteId: number;
}

export interface SelectRecommendationInput {
  concepts: ConceptNode[];
  edges: PrerequisiteEdge[];
  ratingByConceptId: Map<number, number>; // missing concept = cold-start rating
}

export interface RecommendationSelection {
  type: RecommendationType;
  targetConceptId: number | null; // null only for ALL_MASTERED
  dependentConceptId: number | null; // set for REVISE_PREREQUISITE
}

// Depth of each concept = longest path from a root (concept with no prerequisites).
// Roots are depth 0; a concept is always deeper than its prerequisites.
export function computeDepths(
  concepts: ConceptNode[],
  edges: PrerequisiteEdge[]
): Map<number, number> {
  const prereqsOf = new Map<number, number[]>();
  for (const c of concepts) prereqsOf.set(c.id, []);
  for (const e of edges) prereqsOf.get(e.conceptId)?.push(e.prerequisiteId);

  const memo = new Map<number, number>();
  const depth = (id: number): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    let d = 0;
    for (const p of prereqsOf.get(id) ?? []) d = Math.max(d, depth(p) + 1);
    memo.set(id, d);
    return d;
  };
  for (const c of concepts) depth(c.id);
  return memo;
}

// Pick the single next recommendation from the graph + mastery.
export function selectRecommendation(
  input: SelectRecommendationInput
): RecommendationSelection {
  const { concepts, edges, ratingByConceptId } = input;
  const depths = computeDepths(concepts, edges);

  const ratingOf = (id: number) =>
    ratingByConceptId.get(id) ?? ELO.COLD_START_RATING;
  const hasPrereqs = (id: number) => edges.some((e) => e.conceptId === id);
  const dependentsOf = (id: number) =>
    edges.filter((e) => e.prerequisiteId === id).map((e) => e.conceptId);

  // Unmastered concepts, most foundational and weakest first.
  const candidates = concepts
    .filter((c) => !isMastered(ratingOf(c.id)))
    .sort(
      (a, b) =>
        (depths.get(a.id)! - depths.get(b.id)!) ||
        (ratingOf(a.id) - ratingOf(b.id)) ||
        (a.id - b.id)
    );

  if (candidates.length === 0) {
    return { type: "ALL_MASTERED", targetConceptId: null, dependentConceptId: null };
  }

  const target = candidates[0];
  const dependents = dependentsOf(target.id);

  // The target's prerequisites are already mastered, so classify by its role.
  if (dependents.length > 0) {
    // Name the most foundational dependent in the reason.
    const dependent = dependents
      .slice()
      .sort((a, b) => (depths.get(a)! - depths.get(b)!) || (a - b))[0];
    return {
      type: "REVISE_PREREQUISITE",
      targetConceptId: target.id,
      dependentConceptId: dependent,
    };
  }
  if (hasPrereqs(target.id)) {
    return { type: "ADVANCE_NEXT", targetConceptId: target.id, dependentConceptId: null };
  }
  return { type: "PRACTISE_CURRENT", targetConceptId: target.id, dependentConceptId: null };
}

// Reason string saved with the recommendation.
export function buildRecommendationReason(params: {
  type: RecommendationType;
  conceptTitle: string;
  dependentTitle?: string;
  targetRating: number;
}): string {
  const { type, conceptTitle, dependentTitle, targetRating } = params;
  const percent = masteryPercent(targetRating);
  switch (type) {
    case "REVISE_PREREQUISITE":
      return (
        `You're at ${percent}% on ${conceptTitle}, which ${dependentTitle} depends on. ` +
        `We recommend revising ${conceptTitle} first.`
      );
    case "ADVANCE_NEXT":
      return (
        `You've mastered the prerequisites for ${conceptTitle}, so you're ready to ` +
        `study it next. You're currently at ${percent}%.`
      );
    case "PRACTISE_CURRENT":
      return (
        `You're at ${percent}% on ${conceptTitle}. ` +
        `We recommend practising it to build a solid foundation.`
      );
    case "ALL_MASTERED":
      return `You've mastered every concept in this domain — excellent work!`;
  }
}
