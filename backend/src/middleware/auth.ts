// JWT guard: verifies the Bearer token and attaches the student id to the request.
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { HttpError } from "../utils/httpError";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing or invalid Authorization header");
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    req.studentId = verifyToken(token).studentId;
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
  next();
}
