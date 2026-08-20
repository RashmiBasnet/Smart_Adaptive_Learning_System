import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

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

// Directed edges: "<concept> depends on <prerequisite>".
const prerequisiteEdges: { concept: string; prerequisite: string }[] = [
  { concept: "linked-lists", prerequisite: "arrays" },
  { concept: "stacks", prerequisite: "arrays" },
  { concept: "queues", prerequisite: "arrays" },
  { concept: "hash-tables", prerequisite: "arrays" },
  { concept: "trees", prerequisite: "linked-lists" },
  { concept: "graphs", prerequisite: "trees" },
  { concept: "graphs", prerequisite: "queues" },
];

// Shape of the question bank file (only the fields we use).
interface QuestionBank {
  concepts: {
    slug: string;
    lesson: string;
    questions: {
      difficulty: string;
      marks: number;
      text: string;
      explanation?: string;
      options: string[];
      correctIndex: number;
      heldOut?: boolean; // evaluation-only questions; absent = practice pool
    }[];
  }[];
}

// Seed the graph (concepts + prerequisite edges). Returns slug -> id.
async function seedGraph(): Promise<Map<string, number>> {
  for (const c of concepts) {
    await prisma.concept.upsert({
      where: { slug: c.slug },
      update: { title: c.title, domain: DOMAIN },
      create: { slug: c.slug, title: c.title, domain: DOMAIN },
    });
  }

  const all = await prisma.concept.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(all.map((c) => [c.slug, c.id]));

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

  return idBySlug;
}

// Seed lessons + questions from the question bank file. Idempotent: lessons are
// upserted, questions are created only if a matching stem doesn't already exist.
// (The file's prerequisites are intentionally ignored — the graph above is the
// source of truth.)
async function seedContent(idBySlug: Map<string, number>) {
  const bank: QuestionBank = JSON.parse(
    readFileSync(join(__dirname, "question-bank.json"), "utf-8")
  );

  let questionsCreated = 0;
  let lessonsSeeded = 0;

  for (const c of bank.concepts) {
    const conceptId = idBySlug.get(c.slug);
    if (conceptId == null) throw new Error(`Question bank concept not in graph: ${c.slug}`);

    // Lesson -> a single theory learning material.
    const existingLesson = await prisma.learningMaterial.findFirst({
      where: { conceptId, type: "theory", orderIndex: 0 },
    });
    if (existingLesson) {
      await prisma.learningMaterial.update({
        where: { id: existingLesson.id },
        data: { body: c.lesson },
      });
    } else {
      await prisma.learningMaterial.create({
        data: {
          conceptId,
          type: "theory",
          difficultyTier: "standard",
          body: c.lesson,
          orderIndex: 0,
        },
      });
    }
    lessonsSeeded++;

    // Questions (single-correct MCQ, 4 options, 1 mark). Existing questions
    // (matched by stem) get their explanation and held-out flag refreshed to
    // match the bank; new ones are created. Re-seeding only updates flags — it
    // never duplicates a question or touches recorded responses.
    for (const q of c.questions) {
      const heldOut = q.heldOut ?? false;
      const exists = await prisma.question.findFirst({
        where: { conceptId, stem: q.text },
        select: { id: true, explanation: true, heldOut: true },
      });
      if (exists) {
        if (
          exists.explanation !== (q.explanation ?? null) ||
          exists.heldOut !== heldOut
        ) {
          await prisma.question.update({
            where: { id: exists.id },
            data: { explanation: q.explanation ?? null, heldOut },
          });
        }
        continue;
      }

      await prisma.question.create({
        data: {
          conceptId,
          difficulty: q.difficulty,
          stem: q.text,
          explanation: q.explanation ?? null,
          marks: q.marks,
          heldOut,
          options: {
            create: q.options.map((text, i) => ({
              text,
              isCorrect: i === q.correctIndex,
            })),
          },
        },
      });
      questionsCreated++;
    }
  }

  return { questionsCreated, lessonsSeeded };
}

async function main() {
  const idBySlug = await seedGraph();
  const { questionsCreated, lessonsSeeded } = await seedContent(idBySlug);

  const conceptCount = await prisma.concept.count();
  const edgeCount = await prisma.conceptPrerequisite.count();
  const questionCount = await prisma.question.count();
  console.log(
    `Seed complete: ${conceptCount} concepts, ${edgeCount} edges, ` +
      `${questionCount} questions total (${questionsCreated} new), ${lessonsSeeded} lessons.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
