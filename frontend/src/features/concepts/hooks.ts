// Concept-page data hooks.

import { useQuery } from "@tanstack/react-query";
import { getConceptMaterials } from "../../lib/api/concepts";

export function useConceptMaterials(conceptId: number | null) {
  return useQuery({
    queryKey: ["concept-materials", conceptId],
    queryFn: () => getConceptMaterials(conceptId!),
    enabled: conceptId !== null,
    // Lesson content only changes when the database is reseeded.
    staleTime: Infinity,
  });
}
