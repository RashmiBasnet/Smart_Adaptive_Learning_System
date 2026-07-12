// Typed wrappers for the read-only dashboard endpoints. All values (bands,
// mastery percent, recommendations) are computed by the backend; the frontend
// only displays them.

import { request } from "./client";
import type {
  DashboardOverview,
  Strengths,
  DashboardRecommendation,
  MasteryHistory,
} from "../types/api";

export function getOverview(): Promise<DashboardOverview> {
  return request<DashboardOverview>("/dashboard/overview");
}

export function getStrengths(): Promise<Strengths> {
  return request<Strengths>("/dashboard/concepts/strengths");
}

// null (with 200) means "no recommendation yet" — an expected empty state.
export function getRecommendation(): Promise<DashboardRecommendation | null> {
  return request<DashboardRecommendation | null>("/dashboard/recommendation");
}

export function getMasteryHistory(conceptId: number): Promise<MasteryHistory> {
  return request<MasteryHistory>(`/dashboard/mastery-history/${conceptId}`);
}
