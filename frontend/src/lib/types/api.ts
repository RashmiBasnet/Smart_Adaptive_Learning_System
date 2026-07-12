// API response types — these mirror the Express API's responses EXACTLY.
// Single source of truth for shapes; never redeclare these inline elsewhere.
// If the API changes shape, this file (and only this file) changes with it.

export type Band = "weak" | "medium" | "strong";

export type RecommendationType =
  | "REVISE_PREREQUISITE"
  | "PRACTISE_CURRENT"
  | "ADVANCE_NEXT"
  | "ALL_MASTERED";

// --- auth ---

export interface PublicStudent {
  id: number;
  email: string;
  name: string;
}

export interface AuthResult {
  student: PublicStudent;
  token: string;
}

// --- dashboard ---

export interface OverviewConcept {
  conceptId: number;
  slug: string;
  name: string;
  rating: number;
  masteryPercent: number;
  band: Band;
  mastered: boolean;
  attempts: number;
  lastAttemptAt: string | null;
}

export interface DashboardOverview {
  student: { id: number; name: string };
  concepts: OverviewConcept[];
  totalAttempts: number;
  masteredCount: number;
}

export interface StrengthEntry {
  conceptId: number;
  slug: string;
  name: string;
  rating: number;
  band: Band;
}

export interface Strengths {
  weak: StrengthEntry[];
  strong: StrengthEntry[];
}

// The endpoint returns null (with 200) when the student has no recommendation yet.
export interface DashboardRecommendation {
  conceptId: number;
  conceptSlug: string | null;
  conceptName: string | null;
  reason: string;
  generatedAt: string;
}

export interface MasteryHistoryPoint {
  attemptAt: string;
  ratingAfter: number;
  masteryPercentAfter: number;
}

export interface MasteryHistory {
  conceptId: number;
  conceptSlug: string;
  points: MasteryHistoryPoint[];
}

// --- concept materials ---

export interface LearningMaterialDto {
  id: number;
  type: string;
  difficultyTier: string;
  body: string;
  orderIndex: number;
}

export interface ConceptMaterials {
  conceptId: number;
  conceptSlug: string;
  conceptTitle: string;
  materials: LearningMaterialDto[];
}

// --- quiz ---

export interface QuizOptionDto {
  id: number;
  text: string;
}

export interface QuizQuestionDto {
  id: number;
  difficulty: string;
  stem: string;
  options: QuizOptionDto[];
}

export interface ServedQuiz {
  conceptId: number;
  conceptSlug: string;
  conceptTitle: string;
  band: Band;
  totalQuestions: number;
  questions: QuizQuestionDto[];
}

export interface SubmitAnswer {
  questionId: number;
  selectedOptionId: number | null;
  timeTakenSeconds?: number;
}

// Note: quizScorePercent (this attempt's score) and mastery percentages are
// DIFFERENT numbers and must stay separate in the UI as well.
export interface QuizResult {
  attemptId: number;
  quizScorePercent: number;
  correctCount: number;
  totalQuestions: number;
  mastery: {
    updated: boolean;
    oldPercent: number;
    newPercent: number;
    mastered: boolean;
    reason: string | null;
  };
  recommendation: {
    type: RecommendationType;
    targetConceptId: number | null;
    reason: string;
    persisted: boolean;
  };
}
