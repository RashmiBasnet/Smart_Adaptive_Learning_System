// Typed wrapper for the concept-materials endpoint (lesson content).

import { request } from "./client";
import type { ConceptMaterials } from "../types/api";

export function getConceptMaterials(conceptId: number): Promise<ConceptMaterials> {
  return request<ConceptMaterials>(`/concepts/${conceptId}/materials`);
}
