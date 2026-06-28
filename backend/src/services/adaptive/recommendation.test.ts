// Unit tests for the pure recommendation engine (RECOMMENDATION_ENGINE_BRIEF.md).
// Built-in node:test runner. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ConceptNode,
  PrerequisiteEdge,
  computeDepths,
  selectRecommendation,
  buildRecommendationReason,
} from "./recommendation";

// The seeded Data Structures graph (ids match the seed order).
const concepts: ConceptNode[] = [
  { id: 1, title: "Arrays" },
  { id: 2, title: "Linked Lists" },
  { id: 3, title: "Stacks" },
  { id: 4, title: "Queues" },
  { id: 5, title: "Hash Tables" },
  { id: 6, title: "Trees" },
  { id: 7, title: "Graphs" },
];
const edges: PrerequisiteEdge[] = [
  { conceptId: 2, prerequisiteId: 1 },
  { conceptId: 3, prerequisiteId: 1 },
  { conceptId: 4, prerequisiteId: 1 },
  { conceptId: 5, prerequisiteId: 1 },
  { conceptId: 6, prerequisiteId: 2 },
  { conceptId: 7, prerequisiteId: 6 },
  { conceptId: 7, prerequisiteId: 4 },
];

const MASTERED = 1350; // >= unlock threshold (1300)
const WEAK = 1100;

/** Ratings map where everything is mastered except the given overrides. */
const allMasteredExcept = (overrides: Record<number, number>) => {
  const m = new Map<number, number>();
  for (const c of concepts) m.set(c.id, MASTERED);
  for (const [id, r] of Object.entries(overrides)) m.set(Number(id), r);
  return m;
};

test("computeDepths: longest path from a root", () => {
  const d = computeDepths(concepts, edges);
  assert.equal(d.get(1), 0); // Arrays (root)
  assert.equal(d.get(2), 1); // Linked Lists
  assert.equal(d.get(3), 1); // Stacks
  assert.equal(d.get(4), 1); // Queues
  assert.equal(d.get(5), 1); // Hash Tables
  assert.equal(d.get(6), 2); // Trees
  assert.equal(d.get(7), 3); // Graphs = max(Trees+1, Queues+1)
});

test("cold-start (no ratings): most foundational weak concept = Arrays -> REVISE_PREREQUISITE", () => {
  const sel = selectRecommendation({ concepts, edges, ratingByConceptId: new Map() });
  assert.equal(sel.type, "REVISE_PREREQUISITE");
  assert.equal(sel.targetConceptId, 1); // Arrays
  assert.equal(sel.dependentConceptId, 2); // lowest-depth, lowest-id dependent = Linked Lists
});

test("Arrays mastered: next foundational gap = Linked Lists, blocks Trees", () => {
  const sel = selectRecommendation({
    concepts,
    edges,
    ratingByConceptId: allMasteredExcept({ 2: WEAK, 6: WEAK, 7: WEAK }),
  });
  assert.equal(sel.type, "REVISE_PREREQUISITE");
  assert.equal(sel.targetConceptId, 2); // Linked Lists
  assert.equal(sel.dependentConceptId, 6); // Trees
});

test("only a leaf weak (Hash Tables), prereqs mastered -> ADVANCE_NEXT", () => {
  const sel = selectRecommendation({
    concepts,
    edges,
    ratingByConceptId: allMasteredExcept({ 5: WEAK }),
  });
  assert.equal(sel.type, "ADVANCE_NEXT");
  assert.equal(sel.targetConceptId, 5); // Hash Tables (no dependents)
  assert.equal(sel.dependentConceptId, null);
});

test("all mastered -> ALL_MASTERED (no target)", () => {
  const sel = selectRecommendation({
    concepts,
    edges,
    ratingByConceptId: allMasteredExcept({}),
  });
  assert.equal(sel.type, "ALL_MASTERED");
  assert.equal(sel.targetConceptId, null);
});

test("depth tie-break: a shallower weak concept wins over a deeper one", () => {
  // Stacks (depth 1) and Trees (depth 2) both weak; Stacks should win.
  const sel = selectRecommendation({
    concepts,
    edges,
    ratingByConceptId: allMasteredExcept({ 3: WEAK, 6: WEAK }),
  });
  assert.equal(sel.targetConceptId, 3); // Stacks
  assert.equal(sel.type, "ADVANCE_NEXT"); // Stacks has no dependents
});

test("mastery tie-break within a depth: lower mastery wins", () => {
  // Stacks (1250) and Queues (1100) both depth 1; Queues is weaker -> chosen.
  const sel = selectRecommendation({
    concepts,
    edges,
    ratingByConceptId: allMasteredExcept({ 3: 1250, 4: 1100, 7: WEAK }),
  });
  assert.equal(sel.targetConceptId, 4); // Queues
  assert.equal(sel.type, "REVISE_PREREQUISITE"); // Queues -> Graphs
  assert.equal(sel.dependentConceptId, 7); // Graphs
});

test("standalone concept (no prereqs, no dependents) -> PRACTISE_CURRENT", () => {
  const solo: ConceptNode[] = [{ id: 99, title: "Recursion" }];
  const sel = selectRecommendation({
    concepts: solo,
    edges: [],
    ratingByConceptId: new Map([[99, WEAK]]),
  });
  assert.equal(sel.type, "PRACTISE_CURRENT");
  assert.equal(sel.targetConceptId, 99);
});

test("reason strings match the approved templates", () => {
  assert.equal(
    buildRecommendationReason({
      type: "REVISE_PREREQUISITE",
      conceptTitle: "Arrays",
      dependentTitle: "Linked Lists",
      targetRating: 1100,
    }),
    "You're at 36% on Arrays, which Linked Lists depends on. We recommend revising Arrays first."
  );
  assert.equal(
    buildRecommendationReason({
      type: "ADVANCE_NEXT",
      conceptTitle: "Hash Tables",
      targetRating: 1200,
    }),
    "You've mastered the prerequisites for Hash Tables, so you're ready to study it next. You're currently at 50%."
  );
});
