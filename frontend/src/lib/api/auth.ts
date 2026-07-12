// Typed wrappers for the auth endpoints. Client-side forms validate for UX,
// but the API remains the source of truth for auth errors.

import { request } from "./client";
import type { AuthResult } from "../types/api";

export function login(email: string, password: string): Promise<AuthResult> {
  return request<AuthResult>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function register(
  name: string,
  email: string,
  password: string
): Promise<AuthResult> {
  return request<AuthResult>("/auth/register", {
    method: "POST",
    body: { name, email, password },
  });
}
