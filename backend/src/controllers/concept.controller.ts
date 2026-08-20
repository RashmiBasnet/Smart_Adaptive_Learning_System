import { Request, Response } from "express";
import { getConceptMaterials } from "../services/concept.service";
import { HttpError } from "../utils/httpError";

function parseConceptId(req: Request): number {
  const id = Number(req.params.conceptId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid concept id");
  return id;
}

export async function materials(req: Request, res: Response) {
  const conceptId = parseConceptId(req);
  res.json(await getConceptMaterials(conceptId));
}
