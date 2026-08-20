// Prerequisite gating engine: pure functions that decide whether a concept's
// quiz is locked, derived from the prerequisite graph + per-concept mastery.
// Lessons are never gated — only assessment is (approved Option B decision).
//
// The gate rule reuses the single existing mastery threshold
// (ELO.MASTERY_UNLOCK_RATING via isMastered): a quiz is locked while ANY
// direct prerequisite is unmastered. No DB access here — persistence lives in
// gating.service.ts, and the dashboard derives lock state through these same
// functions so reasons are identical everywhere.

import { ELO, isMastered, masteryPercent } from "./mastery";

export interface PrerequisiteState {
  conceptId: number;
  slug: string;
  name: string;
  rating: number; // cold-start rating when the student has no mastery row
  assessed: boolean; // false when the student has never quizzed the prerequisite
  mastered: boolean;
}

// Resolve one prerequisite's state from its concept row and the student's
// rating (null when no mastery row exists yet).
export function prerequisiteState(
  concept: { id: number; slug: string; title: string },
  rating: number | null
): PrerequisiteState {
  const effectiveRating = rating ?? ELO.COLD_START_RATING;
  return {
    conceptId: concept.id,
    slug: concept.slug,
    name: concept.title,
    rating: effectiveRating,
    assessed: rating !== null,
    mastered: isMastered(effectiveRating),
  };
}

// The prerequisites that currently block the quiz (empty = unlocked).
// A concept with no prerequisites (graph root) is never locked.
export function unmetPrerequisites(prereqs: PrerequisiteState[]): PrerequisiteState[] {
  return prereqs.filter((p) => !p.mastered);
}

// Human-readable lock reason — an OLM artifact shown to the student verbatim.
// Unassessed prerequisites say "not assessed yet" (consistent with the
// dashboard, which shows no percentage before the first quiz).
export function buildLockReason(
  conceptTitle: string,
  unmet: PrerequisiteState[]
): string | null {
  if (unmet.length === 0) return null;
  const requirements = unmet
    .map((p) =>
      p.assessed
        ? `${p.name} (currently ${masteryPercent(p.rating)}%)`
        : `${p.name} (not assessed yet)`
    )
    .join(" and ");
  return `Locked — ${conceptTitle} requires ${requirements}.`;
}

// Full lock state for one concept, used by both quiz serving and the dashboard.
export function deriveLockState(
  conceptTitle: string,
  prereqs: PrerequisiteState[]
): { locked: boolean; unmet: PrerequisiteState[]; lockReason: string | null } {
  const unmet = unmetPrerequisites(prereqs);
  return {
    locked: unmet.length > 0,
    unmet,
    lockReason: buildLockReason(conceptTitle, unmet),
  };
}
