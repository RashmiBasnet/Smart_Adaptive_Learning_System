import { prisma } from "../config/prisma";
import { HttpError } from "../utils/httpError";

// Learning materials for one concept, in author-defined order. Read-only.
// No band-based selection here: adaptive material tiering is a pending design
// decision, so every student currently receives the same lesson content.
export async function getConceptMaterials(conceptId: number) {
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: { id: true, slug: true, title: true },
  });
  if (!concept) throw new HttpError(404, "Concept not found");

  const materials = await prisma.learningMaterial.findMany({
    where: { conceptId },
    select: {
      id: true,
      type: true,
      difficultyTier: true,
      body: true,
      orderIndex: true,
    },
    orderBy: { orderIndex: "asc" },
  });

  return {
    conceptId: concept.id,
    conceptSlug: concept.slug,
    conceptTitle: concept.title,
    materials,
  };
}
