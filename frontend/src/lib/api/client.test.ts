import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  request,
  setAuthToken,
  setUnauthorizedHandler,
  ApiError,
} from "./client";

function mockFetchOnce(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("api client", () => {
  beforeEach(() => {
    setAuthToken(null);
    setUnauthorizedHandler(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches the JWT as a Bearer Authorization header", async () => {
    const fetchMock = mockFetchOnce(200, { ok: true });
    setAuthToken("test-token");

    await request("/dashboard/overview");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("sends no Authorization header when logged out", async () => {
    const fetchMock = mockFetchOnce(200, { ok: true });

    await request("/auth/login", { method: "POST", body: {} });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("normalizes a 401 into the unauthorized handler (logout) and an ApiError", async () => {
    mockFetchOnce(401, { error: "Invalid or expired token" });
    setAuthToken("stale-token");
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(request("/dashboard/overview")).rejects.toThrowError(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("surfaces the API's error message on non-401 failures", async () => {
    mockFetchOnce(409, { error: "Email already registered" });

    await expect(request("/auth/register", { method: "POST", body: {} }))
      .rejects.toMatchObject({ status: 409, message: "Email already registered" });
  });

  it("carries the quiz gate's lockReason through a 403", async () => {
    const lockReason = "Locked — Linked Lists requires Arrays (currently 38%).";
    mockFetchOnce(403, { error: "Quiz locked", lockReason });

    await expect(request("/quiz/2")).rejects.toMatchObject({
      status: 403,
      message: "Quiz locked",
      lockReason,
    });
  });
});
