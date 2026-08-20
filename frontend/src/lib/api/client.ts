// The single fetch wrapper for the Express API: base URL, JWT header, and
// error normalization. Components never call fetch directly — every request
// goes through here so auth and error handling behave identically everywhere.
//
// The token lives in module memory (set by AuthProvider); a 401 from any call
// triggers the registered unauthorized handler (logout + redirect to login).

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Normalized error: every non-2xx response becomes one of these.
export class ApiError extends Error {
  status: number;
  details?: Record<string, string[] | undefined>;
  // Set on 403s from the quiz gate: the graph-derived explanation of why the
  // quiz is locked, shown to the student verbatim.
  lockReason?: string;

  constructor(
    status: number,
    message: string,
    details?: ApiError["details"],
    lockReason?: string
  ) {
    super(message);
    this.status = status;
    this.details = details;
    this.lockReason = lockReason;
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

// AuthProvider registers this; a 401 anywhere means the session is dead.
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!res.ok) {
    // The API's error shape is { error: string, details?, lockReason? }.
    let message = `Request failed (${res.status})`;
    let details: ApiError["details"];
    let lockReason: string | undefined;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      details = body?.details;
      lockReason = body?.lockReason;
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, message, details, lockReason);
  }

  return res.json() as Promise<T>;
}
