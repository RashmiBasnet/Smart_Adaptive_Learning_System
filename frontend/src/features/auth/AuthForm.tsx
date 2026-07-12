"use client";

// Shared login/register form. Client-side validation is UX-only (fast feedback
// on obvious mistakes); the API stays the source of truth — its error message
// is shown verbatim when a request fails.

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, register } from "../../lib/api/auth";
import { ApiError } from "../../lib/api/client";
import { useAuth } from "../../providers/auth-provider";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8; // matches the API's registration rule

const INPUT_CLASSES =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors duration-150 focus:border-indigo-500";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!EMAIL_PATTERN.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "register" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (mode === "register" && name.trim().length === 0) {
      setError("Enter your name.");
      return;
    }

    setPending(true);
    try {
      const result =
        mode === "login"
          ? await login(email, password)
          : await register(name.trim(), email, password);
      signIn(result);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Brand mark above the card */}
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 shadow-md">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </span>
        <div>
          <p className="text-lg font-bold leading-tight tracking-tight text-slate-900">SALS</p>
          <p className="text-xs text-slate-500">Smart Adaptive Learning System</p>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-md">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "login"
            ? "Log in to continue learning."
            : "Start learning data structures, adaptively."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          {mode === "register" && (
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLASSES}
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_CLASSES}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLASSES}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-slate-600">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-700">
              Register
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
              Log in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
