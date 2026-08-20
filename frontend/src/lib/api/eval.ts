// Typed wrappers for the held-out evaluation instrument. Unlike the quiz
// endpoints these are addressed by slug, are not prerequisite-gated, and
// return no per-question feedback by design.

import { request } from "./client";
import type { EvalQuestionSet, EvalSubmitAnswer, EvalResult } from "../types/api";

export function getEvalQuestions(conceptSlug: string): Promise<EvalQuestionSet> {
  return request<EvalQuestionSet>(`/eval/${conceptSlug}/questions`);
}

export function submitEval(
  conceptSlug: string,
  phase: "PRE" | "POST",
  answers: EvalSubmitAnswer[],
  studyMode?: "transparent" | "opaque"
): Promise<EvalResult> {
  return request<EvalResult>(`/eval/${conceptSlug}/submit`, {
    method: "POST",
    body: { phase, studyMode, answers },
  });
}
