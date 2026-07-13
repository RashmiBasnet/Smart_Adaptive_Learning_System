// Unit tests for root-cause tracing (ROOT_CAUSE_TRACING handoff).
// Pure-function tests against the real seeded Data Structures graph.
// Built-in node:test runner. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildConceptGraph,
  traceRootCause,
  buildRootCauseReason,
} from "./rootCause";

// The seeded graph (ids/slugs/titles match prisma/seed.ts).
const concepts = [
  { id: 1, slug: "arrays", title: "Arrays" },
  { id: 2, slug: "linked-lists", title: "Linked Lists" },
  { id: 3, slug: "stacks", title: "Stacks" },
  { id: 4, slug: "queues", title: "Queues" },
  { id: 5, slug: "hash-tables", title: "Hash Tables" },
  { id: 6, slug: "trees", title: "Trees" },
  { id: 7, slug: "graphs", title: "Graphs" },
];
// Directed edges: conceptId depends on prerequisiteId.
const edges = [
  { conceptId: 2, prerequisiteId: 1 }, // linked-lists -> arrays
  { conceptId: 3, prerequisiteId: 1 }, // stacks -> arrays
  { conceptId: 4, prerequisiteId: 1 }, // queues -> arrays
  { conceptId: 5, prerequisiteId: 1 }, // hash-tables -> arrays
  { conceptId: 6, prerequisiteId: 2 }, // trees -> linked-lists
  { conceptId: 7, prerequisiteId: 6 }, // graphs -> trees
  { conceptId: 7, prerequisiteId: 4 }, // graphs -> queues
];

const GRAPH = buildConceptGraph(concepts, edges);
const idOf = (slug: string) => concepts.find((c) => c.slug === slug)!.id;

const MASTERED = 1350; // >= unlock threshold (1300)
const WEAK = 1100;

// Ratings map where everything is mastered except the given slug overrides.
const masteredExcept = (weakSlugs: string[]) => {
  const m = new Map<number, number>();
  for (const c of concepts) m.set(c.id, MASTERED);
  for (const slug of weakSlugs) m.set(idOf(slug), WEAK);
  return m;
};

const rootSlugs = (roots: { slug: string }[]) => roots.map((r) => r.slug).sort();

test("3-level trace: weak Graphs, Arrays mastered -> root is Linked Lists", () => {
  // graphs weak; trees + linked-lists unmastered; arrays + queues mastered.
  const mastery = masteredExcept(["graphs", "trees", "linked-lists"]);
  const result = traceRootCause(idOf("graphs"), GRAPH, mastery);

  assert.equal(result.selfIsGap, false);
  assert.deepEqual(rootSlugs(result.roots), ["linked-lists"]);
  // Path runs from the weak concept down to the root.
  assert.deepEqual(result.roots[0].pathNames, ["Graphs", "Trees", "Linked Lists"]);

  assert.equal(
    buildRootCauseReason("Graphs", result),
    "You're weak on Graphs. The root gap is Linked Lists — Trees depends on it, and Graphs depends on Trees. Strengthen Linked Lists first."
  );
});

test("multiple independent roots: two broken chains under Graphs -> both reported", () => {
  // graphs, trees, linked-lists, queues weak; arrays mastered.
  // Chain via trees bottoms out at linked-lists; chain via queues bottoms out
  // at queues (its only prereq, arrays, is mastered).
  const mastery = masteredExcept(["graphs", "trees", "linked-lists", "queues"]);
  const result = traceRootCause(idOf("graphs"), GRAPH, mastery);

  assert.equal(result.selfIsGap, false);
  assert.deepEqual(rootSlugs(result.roots), ["linked-lists", "queues"]);
});

test("diamond dedupe: Arrays reached via many paths is named once", () => {
  // Everything on the graphs chain is weak, so both the trees branch and the
  // queues branch bottom out at arrays — it must appear only once.
  const mastery = masteredExcept([
    "graphs",
    "trees",
    "linked-lists",
    "queues",
    "arrays",
  ]);
  const result = traceRootCause(idOf("graphs"), GRAPH, mastery);

  assert.equal(result.selfIsGap, false);
  assert.deepEqual(rootSlugs(result.roots), ["arrays"]);
});

test("self-is-gap: weak Linked Lists with Arrays mastered -> no invented root", () => {
  const mastery = masteredExcept(["linked-lists"]);
  const result = traceRootCause(idOf("linked-lists"), GRAPH, mastery);

  assert.equal(result.selfIsGap, true);
  assert.equal(result.roots.length, 0);
  assert.equal(
    buildRootCauseReason("Linked Lists", result),
    "No prerequisite gap — the weakness is in Linked Lists itself."
  );
});

test("root concept weak: weak Arrays (no prerequisites) -> self-is-gap", () => {
  const mastery = masteredExcept(["arrays"]);
  const result = traceRootCause(idOf("arrays"), GRAPH, mastery);

  assert.equal(result.selfIsGap, true);
  assert.equal(result.roots.length, 0);
});

test("all prerequisites mastered but concept still weak -> self-is-gap", () => {
  // trees weak, its only prereq (linked-lists) mastered.
  const mastery = masteredExcept(["trees"]);
  const result = traceRootCause(idOf("trees"), GRAPH, mastery);

  assert.equal(result.selfIsGap, true);
  assert.equal(result.roots.length, 0);
});

test("unassessed prerequisite counts as unmastered (cold-start handling)", () => {
  // graphs weak and assessed; trees + linked-lists have no mastery row at all;
  // arrays + queues mastered. The missing rows must be treated as unmastered,
  // so the root is still Linked Lists.
  const mastery = new Map<number, number>([
    [idOf("graphs"), WEAK],
    [idOf("arrays"), MASTERED],
    [idOf("queues"), MASTERED],
    // trees, linked-lists, stacks, hash-tables: intentionally absent.
  ]);
  const result = traceRootCause(idOf("graphs"), GRAPH, mastery);

  assert.equal(result.selfIsGap, false);
  assert.deepEqual(rootSlugs(result.roots), ["linked-lists"]);
});

test("cycle guard: a cyclic graph does not infinite-loop", () => {
  // Synthetic cycle A -> B -> A, both unmastered.
  const cyclic = buildConceptGraph(
    [
      { id: 101, slug: "a", title: "A" },
      { id: 102, slug: "b", title: "B" },
    ],
    [
      { conceptId: 101, prerequisiteId: 102 },
      { conceptId: 102, prerequisiteId: 101 },
    ]
  );
  const mastery = new Map<number, number>([
    [101, WEAK],
    [102, WEAK],
  ]);

  // The assertion that matters is that this returns at all (no hang).
  const result = traceRootCause(101, cyclic, mastery);
  assert.equal(result.selfIsGap, false);
  assert.equal(result.roots.length, 0);
});

test("reason names each root with its own chain when there are multiple", () => {
  const mastery = masteredExcept(["graphs", "trees", "linked-lists", "queues"]);
  const result = traceRootCause(idOf("graphs"), GRAPH, mastery);
  const reason = buildRootCauseReason("Graphs", result);

  assert.match(reason, /^You're weak on Graphs\. The root gaps are /);
  assert.match(reason, /Linked Lists \(/);
  assert.match(reason, /Queues \(/);
  assert.match(reason, /Strengthen .* first\.$/);
});
