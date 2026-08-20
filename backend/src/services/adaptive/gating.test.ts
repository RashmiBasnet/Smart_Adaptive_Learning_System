import { test } from "node:test";
import assert from "node:assert/strict";
import { ELO } from "./mastery";
import {
  prerequisiteState,
  unmetPrerequisites,
  buildLockReason,
  deriveLockState,
} from "./gating";

const arrays = { id: 1, slug: "arrays", title: "Arrays" };
const queues = { id: 4, slug: "queues", title: "Queues" };

// 1. Locked/unlocked exactly at the mastery-unlock boundary.
test("gate flips exactly at the unlock rating", () => {
  const justBelow = prerequisiteState(arrays, ELO.MASTERY_UNLOCK_RATING - 1); // 1299
  const exactlyAt = prerequisiteState(arrays, ELO.MASTERY_UNLOCK_RATING); // 1300

  assert.equal(justBelow.mastered, false);
  assert.equal(exactlyAt.mastered, true);
  assert.equal(deriveLockState("Linked Lists", [justBelow]).locked, true);
  assert.equal(deriveLockState("Linked Lists", [exactlyAt]).locked, false);
});

// 2. Multi-prerequisite concepts: locked if ANY prerequisite is unmet.
test("any unmet prerequisite locks the concept", () => {
  const mastered = prerequisiteState(arrays, 1350);
  const unmet = prerequisiteState(queues, 1250);

  const { locked, unmet: blocking } = deriveLockState("Graphs", [mastered, unmet]);
  assert.equal(locked, true);
  assert.deepEqual(blocking.map((p) => p.slug), ["queues"]);

  const bothMastered = deriveLockState("Graphs", [mastered, prerequisiteState(queues, 1300)]);
  assert.equal(bothMastered.locked, false);
  assert.equal(bothMastered.lockReason, null);
});

// 3. Root concepts (no prerequisites) are never locked.
test("a concept with no prerequisites is never locked", () => {
  const state = deriveLockState("Arrays", []);
  assert.equal(state.locked, false);
  assert.equal(state.lockReason, null);
  assert.deepEqual(unmetPrerequisites([]), []);
});

// 4. Reason strings: assessed prerequisites show their mastery percent;
//    unassessed ones say so instead of implying a measured value.
test("lock reason shows percent for assessed and 'not assessed' for new prerequisites", () => {
  const assessed = prerequisiteState(arrays, 1216); // some real rating
  const reason = buildLockReason("Linked Lists", [assessed]);
  assert.match(reason!, /^Locked — Linked Lists requires Arrays \(currently \d+%\)\.$/);

  const unassessed = prerequisiteState(arrays, null); // no mastery row
  assert.equal(unassessed.assessed, false);
  assert.equal(
    buildLockReason("Linked Lists", [unassessed]),
    "Locked — Linked Lists requires Arrays (not assessed yet)."
  );
});

// 5. Multiple unmet prerequisites are all listed in one reason.
test("lock reason lists every unmet prerequisite", () => {
  const reason = buildLockReason("Graphs", [
    prerequisiteState({ id: 6, slug: "trees", title: "Trees" }, 1250),
    prerequisiteState(queues, null),
  ]);
  assert.match(reason!, /Trees \(currently \d+%\) and Queues \(not assessed yet\)/);
});

// 6. Cold start: a student with no mastery row on the prerequisite is treated
//    at the cold-start rating, which is below the unlock threshold → locked.
test("unassessed prerequisite means locked", () => {
  const state = prerequisiteState(arrays, null);
  assert.equal(state.rating, ELO.COLD_START_RATING);
  assert.equal(state.mastered, false);
  assert.equal(deriveLockState("Linked Lists", [state]).locked, true);
});
