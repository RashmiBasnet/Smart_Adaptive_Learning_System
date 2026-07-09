import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Invalid request body/params caught by zod at the edge -> 400 with field errors.
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.flatten().fieldErrors,
    });
  }

  // Errors services raise deliberately (e.g. 401, 409) carry their own status.
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Anything else is unexpected: log it and return a generic 500.
  console.error(err);
  return res.status(500).json({ error: "Internal Server Error" });
}
