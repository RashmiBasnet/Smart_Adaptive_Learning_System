// Dashboard data hooks: thin TanStack Query wrappers over lib/api/dashboard.
// Components receive this data via props; only hooks talk to the API layer.

import { useQuery } from "@tanstack/react-query";
import {
  getOverview,
  getStrengths,
  getRecommendation,
  getMasteryHistory,
} from "../../lib/api/dashboard";

export function useOverview() {
  return useQuery({ queryKey: ["overview"], queryFn: getOverview });
}

export function useStrengths() {
  return useQuery({ queryKey: ["strengths"], queryFn: getStrengths });
}

export function useRecommendation() {
  return useQuery({ queryKey: ["recommendation"], queryFn: getRecommendation });
}

export function useMasteryHistory(conceptId: number | null) {
  return useQuery({
    queryKey: ["mastery-history", conceptId],
    queryFn: () => getMasteryHistory(conceptId!),
    enabled: conceptId !== null,
  });
}
