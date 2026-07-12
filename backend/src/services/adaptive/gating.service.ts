// Applies the gating engine (gating.ts) to the database: resolves a concept's
// direct prerequisites and the student's mastery of them, and enforces the
// quiz gate. Lessons are never gated.

import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/httpError";
import {
  PrerequisiteState,
  prerequisiteState,
  deriveLockState,
} from "./gating";

// The student's state for every direct prerequisite of a concept.
export async function prerequisiteStates(
  studentId: number,
  conceptId: number
): Promise<PrerequisiteState[]> {
  const edges = await prisma.conceptPrerequisite.findMany({
    where: { conceptId },
    select: {
      prerequisite: { select: { id: true, slug: true, title: true } },
    },
  });
  if (edges.length === 0) return []; // graph root: never locked

  const prereqIds = edges.map((e) => e.prerequisite.id);
  const masteryRows = await prisma.conceptMastery.findMany({
    where: { studentId, conceptId: { in: prereqIds } },
    select: { conceptId: true, masteryScore: true },
  });
  const ratingByConceptId = new Map(masteryRows.map((m) => [m.conceptId, m.masteryScore]));

  return edges.map((e) =>
    prerequisiteState(e.prerequisite, ratingByConceptId.get(e.prerequisite.id) ?? null)
  );
}

// Unmastered direct prerequisites (empty list = quiz unlocked).
export async function lockedPrerequisites(
  studentId: number,
  conceptId: number
): Promise<PrerequisiteState[]> {
  const prereqs = await prerequisiteStates(studentId, conceptId);
  return prereqs.filter((p) => !p.mastered);
}

// Throws 403 with the graph-derived reason when the concept's quiz is locked.
// The reason is returned as a first-class lockReason field on the error body.
export async function assertQuizUnlocked(
  studentId: number,
  concept: { id: number; title: string }
): Promise<void> {
  const prereqs = await prerequisiteStates(studentId, concept.id);
  const { locked, lockReason } = deriveLockState(concept.title, prereqs);
  if (locked && lockReason) {
    throw new HttpError(403, "Quiz locked", { lockReason });
  }
}
