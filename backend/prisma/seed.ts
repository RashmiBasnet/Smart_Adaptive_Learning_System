import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DOMAIN = "Data Structures";

// Graph nodes.
const concepts: { slug: string; title: string }[] = [
  { slug: "arrays", title: "Arrays" },
  { slug: "linked-lists", title: "Linked Lists" },
  { slug: "stacks", title: "Stacks" },
  { slug: "queues", title: "Queues" },
  { slug: "hash-tables", title: "Hash Tables" },
  { slug: "trees", title: "Trees" },
  { slug: "graphs", title: "Graphs" },
];

// Directed edges: "<concept slug> depends on <prerequisite slug>".
const prerequisiteEdges: { concept: string; prerequisite: string }[] = [
  { concept: "linked-lists", prerequisite: "arrays" },
  { concept: "stacks", prerequisite: "arrays" },
  { concept: "queues", prerequisite: "arrays" },
  { concept: "hash-tables", prerequisite: "arrays" },
  { concept: "trees", prerequisite: "linked-lists" },
  { concept: "graphs", prerequisite: "trees" },
  { concept: "graphs", prerequisite: "queues" },
];

async function main() {
  // Upsert concepts by their unique slug.
  for (const c of concepts) {
    await prisma.concept.upsert({
      where: { slug: c.slug },
      update: { title: c.title, domain: DOMAIN },
      create: { slug: c.slug, title: c.title, domain: DOMAIN },
    });
  }

  // Resolve slugs -> ids for edge creation.
  const all = await prisma.concept.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(all.map((c) => [c.slug, c.id]));

  // Upsert edges by the (concept_id, prerequisite_id) unique pair.
  for (const e of prerequisiteEdges) {
    const conceptId = idBySlug.get(e.concept);
    const prerequisiteId = idBySlug.get(e.prerequisite);
    if (conceptId == null || prerequisiteId == null) {
      throw new Error(`Unknown concept in edge: ${e.concept} -> ${e.prerequisite}`);
    }
    await prisma.conceptPrerequisite.upsert({
      where: { conceptId_prerequisiteId: { conceptId, prerequisiteId } },
      update: {},
      create: { conceptId, prerequisiteId },
    });
  }

  const conceptCount = await prisma.concept.count();
  const edgeCount = await prisma.conceptPrerequisite.count();
  console.log(`Seed complete: ${conceptCount} concepts, ${edgeCount} prerequisite edges.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
