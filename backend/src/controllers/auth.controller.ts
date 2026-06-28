// Auth controllers: validate the request, call the service, send the result.
import { Request, Response } from "express";
import { registerSchema, loginSchema } from "../validators/auth.validator";
import { registerStudent, loginStudent } from "../services/auth.service";
import { prisma } from "../config/prisma";
import { HttpError } from "../utils/httpError";

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await registerStudent(input);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await loginStudent(input);
  res.json(result);
}

/** Current authenticated student (requires requireAuth). */
export async function me(req: Request, res: Response) {
  const student = await prisma.student.findUnique({
    where: { id: req.studentId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!student) {
    throw new HttpError(404, "Student not found");
  }
  res.json({ student });
}
