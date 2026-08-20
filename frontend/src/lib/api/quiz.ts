// Typed wrappers for the quiz endpoints. The served quiz's difficulty mix is
// decided entirely by the backend from the student's mastery band.

import { request } from "./client";
import type { ServedQuiz, SubmitAnswer, QuizResult } from "../types/api";

export function getQuiz(conceptId: number): Promise<ServedQuiz> {
  return request<ServedQuiz>(`/quiz/${conceptId}`);
}

export function submitQuiz(
  conceptId: number,
  answers: SubmitAnswer[]
): Promise<QuizResult> {
  return request<QuizResult>(`/quiz/${conceptId}/submit`, {
    method: "POST",
    body: { answers },
  });
}
