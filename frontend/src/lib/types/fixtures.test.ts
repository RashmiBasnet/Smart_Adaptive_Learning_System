// Type-level safety net: captured sample responses for each endpoint, typed
// against the interfaces in api.ts. If the declared types drift from the real
// API shapes, this file stops compiling — the assertions at runtime are
// intentionally trivial.

import { describe, it, expect } from "vitest";
import type {
  AuthResult,
  DashboardOverview,
  Strengths,
  DashboardRecommendation,
  MasteryHistory,
  ConceptMaterials,
  ServedQuiz,
  QuizResult,
} from "./api";

const authFixture: AuthResult = {
  student: { id: 1, email: "rashmi@example.com", name: "Rashmi" },
  token: "eyJhbGciOiJIUzI1NiJ9.sample.token",
};

const overviewFixture: DashboardOverview = {
  student: { id: 1, name: "Rashmi" },
  concepts: [
    {
      conceptId: 1,
      slug: "arrays",
      name: "Arrays",
      rating: 1240.5,
      masteryPercent: 55,
      band: "medium",
      mastered: false,
      attempts: 3,
      lastAttemptAt: "2026-07-08T10:00:00.000Z",
    },
    {
      conceptId: 7,
      slug: "graphs",
      name: "Graphs",
      rating: 1200,
      masteryPercent: 50,
      band: "medium",
      mastered: false,
      attempts: 0,
      lastAttemptAt: null,
    },
  ],
  totalAttempts: 3,
  masteredCount: 0,
};

const strengthsFixture: Strengths = {
  weak: [{ conceptId: 3, slug: "stacks", name: "Stacks", rating: 1150, band: "weak" }],
  strong: [{ conceptId: 1, slug: "arrays", name: "Arrays", rating: 1350, band: "strong" }],
};

const recommendationFixture: DashboardRecommendation | null = {
  conceptId: 1,
  conceptSlug: "arrays",
  conceptName: "Arrays",
  reason:
    "You're at 35% on Arrays, which Linked Lists depends on. We recommend strengthening Arrays first.",
  generatedAt: "2026-07-08T10:00:00.000Z",
};

const historyFixture: MasteryHistory = {
  conceptId: 1,
  conceptSlug: "arrays",
  points: [
    { attemptAt: "2026-07-01T10:00:00.000Z", ratingAfter: 1216, masteryPercentAfter: 52 },
    { attemptAt: "2026-07-03T10:00:00.000Z", ratingAfter: 1248, masteryPercentAfter: 56 },
  ],
};

const materialsFixture: ConceptMaterials = {
  conceptId: 1,
  conceptSlug: "arrays",
  conceptTitle: "Arrays",
  materials: [
    {
      id: 1,
      type: "theory",
      difficultyTier: "standard",
      body: "An array stores a list of elements in one continuous block of memory.",
      orderIndex: 0,
    },
  ],
};

const servedQuizFixture: ServedQuiz = {
  conceptId: 1,
  conceptSlug: "arrays",
  conceptTitle: "Arrays",
  band: "medium",
  totalQuestions: 6,
  questions: [
    {
      id: 11,
      difficulty: "easy",
      stem: "What is the index of the first element of an array?",
      options: [
        { id: 41, text: "0" },
        { id: 42, text: "1" },
        { id: 43, text: "-1" },
        { id: 44, text: "Depends on the length" },
      ],
    },
  ],
};

const quizResultFixture: QuizResult = {
  attemptId: 9,
  quizScorePercent: 67,
  correctCount: 4,
  totalQuestions: 6,
  mastery: {
    updated: true,
    oldPercent: 52,
    newPercent: 56,
    mastered: false,
    reason:
      "You completed a quiz on Arrays (4/6 correct). Your Arrays mastery moved from 52% to 56%.",
  },
  recommendation: {
    type: "PRACTISE_CURRENT",
    targetConceptId: 1,
    reason: "You're at 56% on Arrays. Keep practising to unlock Linked Lists.",
    persisted: true,
  },
};

describe("API type fixtures", () => {
  it("compile against the declared response types", () => {
    // The real check happened at compile time; these keep vitest satisfied.
    expect(authFixture.token).toBeTruthy();
    expect(overviewFixture.concepts).toHaveLength(2);
    expect(strengthsFixture.weak[0].band).toBe("weak");
    expect(recommendationFixture?.reason).toContain("Arrays");
    expect(historyFixture.points[0].ratingAfter).toBe(1216);
    expect(materialsFixture.materials[0].type).toBe("theory");
    expect(servedQuizFixture.questions[0].options).toHaveLength(4);
    expect(quizResultFixture.mastery.newPercent).toBe(56);
  });
});
