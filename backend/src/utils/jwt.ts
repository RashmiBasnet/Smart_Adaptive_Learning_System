// JWT helpers: issue and verify tokens carrying the student id in the `sub` claim.
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export function signToken(studentId: number): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign({ sub: studentId }, env.JWT_SECRET, options);
}

/** Verify a token and return the student id, or throw if invalid/expired. */
export function verifyToken(token: string): { studentId: number } {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  const sub = typeof decoded === "string" ? decoded : decoded.sub;
  const studentId = Number(sub);
  if (!Number.isInteger(studentId)) {
    throw new Error("Token has no valid subject");
  }
  return { studentId };
}
