import { Request, Response } from "express";
import { submitSchema } from "../validators/quiz.validator";
import { serveQuiz, submitQuiz } from "../services/quiz.service";
import { HttpError } from "../utils/httpError";

function parseConceptId(req: Request): number {
  const id = Number(req.params.conceptId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid concept id");
  return id;
}

export async function serve(req: Request, res: Response) {
  const conceptId = parseConceptId(req);
  const quiz = await serveQuiz(req.studentId!, conceptId);
  res.json(quiz);
}

export async function submit(req: Request, res: Response) {
  const conceptId = parseConceptId(req);
  const input = submitSchema.parse(req.body);
  const result = await submitQuiz(req.studentId!, conceptId, input.answers);
  res.status(201).json(result);
}
