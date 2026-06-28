// Registration and login: password hashing, uniqueness checks, and token issuance.
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { signToken } from "../utils/jwt";
import { HttpError } from "../utils/httpError";
import type { RegisterInput, LoginInput } from "../validators/auth.validator";

const BCRYPT_ROUNDS = 10;

// Shape returned to the client — never includes the password hash.
export interface PublicStudent {
  id: number;
  email: string;
  name: string;
}

export interface AuthResult {
  student: PublicStudent;
  token: string;
}

export async function registerStudent(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.student.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const student = await prisma.student.create({
    data: { email: input.email, passwordHash, name: input.name },
  });

  return {
    student: { id: student.id, email: student.email, name: student.name },
    token: signToken(student.id),
  };
}

export async function loginStudent(input: LoginInput): Promise<AuthResult> {
  const student = await prisma.student.findUnique({ where: { email: input.email } });
  // Same message for unknown email and wrong password, so we don't reveal which accounts exist.
  if (!student || !(await bcrypt.compare(input.password, student.passwordHash))) {
    throw new HttpError(401, "Invalid email or password");
  }

  return {
    student: { id: student.id, email: student.email, name: student.name },
    token: signToken(student.id),
  };
}
