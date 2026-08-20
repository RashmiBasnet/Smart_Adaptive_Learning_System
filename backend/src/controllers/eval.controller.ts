import { Request, Response } from "express";
import { evalSubmitSchema } from "../validators/eval.validator";
import {
  getHeldOutQuestions,
  gradeHeldOutSubmission,
} from "../services/eval.service";
import { HttpError } from "../utils/httpError";

function parseConceptSlug(req: Request): string {
  const slug = req.params.conceptSlug;
  if (typeof slug !== "string" || slug.trim() === "") {
    throw new HttpError(400, "Invalid concept slug");
  }
  return slug;
}

export async function questions(req: Request, res: Response) {
  const conceptSlug = parseConceptSlug(req);
  const result = await getHeldOutQuestions(conceptSlug);
  res.json(result);
}

export async function submit(req: Request, res: Response) {
  const conceptSlug = parseConceptSlug(req);
  const input = evalSubmitSchema.parse(req.body);
  // studentId is attached by requireAuth (same accessor as the quiz controller).
  const result = await gradeHeldOutSubmission(req.studentId!, conceptSlug, input);
  res.json(result);
}
