import { prisma } from "../config/prisma";
import { ELO, isMastered, masteryPercent } from "./adaptive/mastery";
import { bandForRating } from "./quiz.service";
import { getLatestRecommendation } from "./adaptive/recommendation.service";
import { HttpError } from "../utils/httpError";

// Read-only dashboard endpoints (build-order step 8). Pure assembly functions
// are exported for unit tests; the exported get* functions do the DB reads.

interface ConceptRow {
  id: number;
  slug: string;
  title: string;
}

interface MasteryRow {
  conceptId: number;
  masteryScore: number;
}

interface AttemptStats {
  conceptId: number;
  attempts: number;
  lastAttemptAt: Date | null;
}

export interface OverviewConcept {
  conceptId: number;
  slug: string;
  name: string;
  rating: number;
  masteryPercent: number;
  band: ReturnType<typeof bandForRating>;
  mastered: boolean;
  attempts: number;
  lastAttemptAt: Date | null;
}

// One entry per concept; concepts without a mastery row get cold-start values
// (rating 1200 → medium band, 0 attempts) so the client always sees every concept.
export function buildOverviewConcepts(
  concepts: ConceptRow[],
  masteryRows: MasteryRow[],
  attemptStats: AttemptStats[]
): OverviewConcept[] {
  const ratingByConceptId = new Map(masteryRows.map((m) => [m.conceptId, m.masteryScore]));
  const statsByConceptId = new Map(attemptStats.map((s) => [s.conceptId, s]));

  return concepts.map((c) => {
    const rating = ratingByConceptId.get(c.id) ?? ELO.COLD_START_RATING;
    const stats = statsByConceptId.get(c.id);
    return {
      conceptId: c.id,
      slug: c.slug,
      name: c.title,
      rating,
      masteryPercent: masteryPercent(rating),
      band: bandForRating(rating),
      mastered: isMastered(rating),
      attempts: stats?.attempts ?? 0,
      lastAttemptAt: stats?.lastAttemptAt ?? null,
    };
  });
}

// Weak/strong lists for the dashboard. Medium concepts appear in neither list,
// and concepts with zero attempts are excluded entirely (no evidence ≠ weak).
export function buildStrengths(concepts: OverviewConcept[]) {
  const attempted = concepts.filter((c) => c.attempts > 0);
  const entry = (c: OverviewConcept) => ({
    conceptId: c.conceptId,
    slug: c.slug,
    name: c.name,
    rating: c.rating,
    band: c.band,
  });
  return {
    weak: attempted.filter((c) => c.band === "weak").map(entry),
    strong: attempted.filter((c) => c.band === "strong").map(entry),
  };
}

// Mastery-history rows shaped for the frontend chart, oldest → newest.
export function buildHistoryPoints(
  rows: { masteryScore: number; recordedAt: Date }[]
) {
  return rows.map((r) => ({
    attemptAt: r.recordedAt,
    ratingAfter: r.masteryScore,
    masteryPercentAfter: masteryPercent(r.masteryScore),
  }));
}

// GET /dashboard/overview
export async function getOverview(studentId: number) {
  const [student, concepts, masteryRows, attemptGroups] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, name: true },
    }),
    prisma.concept.findMany({
      select: { id: true, slug: true, title: true },
      orderBy: { id: "asc" },
    }),
    prisma.conceptMastery.findMany({
      where: { studentId },
      select: { conceptId: true, masteryScore: true },
    }),
    prisma.quizAttempt.groupBy({
      by: ["conceptId"],
      where: { studentId },
      _count: { _all: true },
      _max: { completedAt: true },
    }),
  ]);
  if (!student) throw new HttpError(404, "Student not found");

  const attemptStats: AttemptStats[] = attemptGroups.map((g) => ({
    conceptId: g.conceptId,
    attempts: g._count._all,
    lastAttemptAt: g._max.completedAt,
  }));

  const overviewConcepts = buildOverviewConcepts(concepts, masteryRows, attemptStats);

  return {
    student,
    concepts: overviewConcepts,
    totalAttempts: attemptStats.reduce((sum, s) => sum + s.attempts, 0),
    masteredCount: overviewConcepts.filter((c) => c.mastered).length,
  };
}

// GET /dashboard/concepts/strengths
export async function getStrengths(studentId: number) {
  const { concepts } = await getOverview(studentId);
  return buildStrengths(concepts);
}

// GET /dashboard/recommendation — the latest persisted recommendation, served
// verbatim (the reason string is the stored explanation, never regenerated).
export async function getRecommendation(studentId: number) {
  const latest = await getLatestRecommendation(studentId);
  if (!latest) return null;

  const concept = await prisma.concept.findUnique({
    where: { id: latest.conceptId },
    select: { id: true, slug: true, title: true },
  });

  return {
    conceptId: latest.conceptId,
    conceptSlug: concept?.slug ?? null,
    conceptName: concept?.title ?? null,
    reason: latest.reason,
    generatedAt: latest.createdAt,
  };
}

// GET /dashboard/mastery-history/:conceptId
export async function getMasteryHistory(studentId: number, conceptId: number) {
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: { id: true, slug: true },
  });
  if (!concept) throw new HttpError(404, "Concept not found");

  const rows = await prisma.masteryHistory.findMany({
    where: { studentId, conceptId },
    select: { masteryScore: true, recordedAt: true },
    orderBy: { recordedAt: "asc" },
  });

  return {
    conceptId: concept.id,
    conceptSlug: concept.slug,
    points: buildHistoryPoints(rows),
  };
}
