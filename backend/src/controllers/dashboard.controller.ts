import { Request, Response } from "express";
import { conceptIdParamSchema } from "../validators/dashboard.validator";
import {
  getOverview,
  getStrengths,
  getRecommendation,
  getMasteryHistory,
} from "../services/dashboard.service";

export async function overview(req: Request, res: Response) {
  res.json(await getOverview(req.studentId!));
}

export async function strengths(req: Request, res: Response) {
  res.json(await getStrengths(req.studentId!));
}

export async function recommendation(req: Request, res: Response) {
  // null body with 200 when no recommendation exists yet (empty state).
  res.json(await getRecommendation(req.studentId!));
}

export async function masteryHistory(req: Request, res: Response) {
  const { conceptId } = conceptIdParamSchema.parse(req.params);
  res.json(await getMasteryHistory(req.studentId!, conceptId));
}
