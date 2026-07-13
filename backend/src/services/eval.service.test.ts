// Pure-function tests for the held-out evaluation instrument.
// Built-in node:test runner. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { toEvalQuestion, gradeHeldOut } from "./eval.service";

// A full held-out question as it exists in the DB, including the answer key and
// explanation the student must never see during evaluation.
const fullQuestion = {
  id: 10,
  difficulty: "medium",
  stem: "What does enqueue do?",
  explanation: "It adds an element to the back of the queue.",
  options: [
    { id: 100, text: "adds to the back", isCorrect: true },
    { id: 101, text: "removes from the front", isCorrect: false },
    { id: 102, text: "peeks at the front", isCorrect: false },
    { id: 103, text: "clears the queue", isCorrect: false },
  ],
};

test("toEvalQuestion never leaks isCorrect or explanation", () => {
  const safe = toEvalQuestion(fullQuestion);

  assert.deepEqual(Object.keys(safe).sort(), ["difficulty", "id", "options", "stem"]);
  assert.equal("explanation" in safe, false);
  // Serialised (what actually goes over the wire) contains no answer key.
  const wire = JSON.stringify(safe);
  assert.equal(wire.includes("isCorrect"), false);
  assert.equal(wire.includes("explanation"), false);
  for (const o of safe.options) {
    assert.deepEqual(Object.keys(o).sort(), ["id", "text"]);
  }
});

test("gradeHeldOut scores correct-out-of-total against the held-out set", () => {
  const heldOut = [
    { id: 1, options: [{ id: 11, isCorrect: true }, { id: 12, isCorrect: false }] },
    { id: 2, options: [{ id: 21, isCorrect: false }, { id: 22, isCorrect: true }] },
    { id: 3, options: [{ id: 31, isCorrect: true }, { id: 32, isCorrect: false }] },
  ];
  const answers = [
    { questionId: 1, selectedOptionId: 11 }, // correct
    { questionId: 2, selectedOptionId: 21 }, // wrong
    { questionId: 3, selectedOptionId: 31 }, // correct
  ];

  assert.deepEqual(gradeHeldOut(heldOut, answers), { correct: 2, total: 3 });
});

test("gradeHeldOut counts unanswered held-out questions as incorrect", () => {
  const heldOut = [
    { id: 1, options: [{ id: 11, isCorrect: true }] },
    { id: 2, options: [{ id: 21, isCorrect: true }] },
  ];
  // Only question 1 answered; total still reflects the full instrument size.
  const answers = [{ questionId: 1, selectedOptionId: 11 }];

  assert.deepEqual(gradeHeldOut(heldOut, answers), { correct: 1, total: 2 });
});

test("gradeHeldOut ignores a null/blank selection", () => {
  const heldOut = [{ id: 1, options: [{ id: 11, isCorrect: true }] }];
  assert.deepEqual(
    gradeHeldOut(heldOut, [{ questionId: 1, selectedOptionId: null }]),
    { correct: 0, total: 1 }
  );
});
