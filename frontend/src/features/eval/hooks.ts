// Eval-instrument data hook.

import { useQuery } from "@tanstack/react-query";
import { getEvalQuestions } from "../../lib/api/eval";

export function useEvalQuestions(conceptSlug: string) {
  return useQuery({
    queryKey: ["eval-questions", conceptSlug],
    queryFn: () => getEvalQuestions(conceptSlug),
    // Held-out sets only change on a database reseed.
    staleTime: Infinity,
  });
}
