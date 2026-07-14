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
  "w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--ink-faint)] shadow-sm transition-colors duration-150 focus:border-[var(--prussian)]";

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
    <div className="flex min-h-screen">
      {/* Editorial panel — the product's story, over a faint concept-graph
          motif. Desktop only; on small screens a compact wordmark stands in. */}
      <aside className="relative hidden w-[44%] overflow-hidden bg-[var(--prussian-deep)] text-white lg:block">
        <svg
          aria-hidden="true"
          viewBox="0 0 400 620"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
        >
          <g stroke="#ffffff" strokeWidth="1.4" fill="none">
            <path d="M70 96 L150 210" />
            <path d="M212 66 L150 210" />
            <path d="M212 66 L300 182" />
            <path d="M150 210 L104 372" />
            <path d="M150 210 L258 350" />
            <path d="M300 182 L258 350" />
            <path d="M104 372 L190 512" />
            <path d="M258 350 L190 512" />
            <path d="M258 350 L336 486" />
          </g>
          <g>
            <circle cx="70" cy="96" r="9" fill="#C99F55" />
            <circle cx="212" cy="66" r="9" fill="#ffffff" />
            <circle cx="300" cy="182" r="9" fill="#ffffff" />
            <circle cx="150" cy="210" r="11" fill="#C99F55" />
            <circle cx="104" cy="372" r="9" fill="#ffffff" />
            <circle cx="258" cy="350" r="9" fill="#ffffff" />
            <circle cx="190" cy="512" r="9" fill="#ffffff" />
            <circle cx="336" cy="486" r="8" fill="#ffffff" />
          </g>
        </svg>

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-2xl font-bold tracking-tight">SALS</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brass)]">
              Smart Adaptive Learning
            </span>
          </div>

          <div className="max-w-sm">
            <h2 className="text-balance font-serif text-[34px] font-bold leading-[1.15] tracking-tight">
              Learning that shows its reasoning.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#C6D2E1]">
              SALS adapts to how you&apos;re doing on data structures — and tells you
              why, at every step.
            </p>
            <ul className="mt-7 flex flex-col gap-3 text-[14px] text-[#DCE6F1]">
              {[
                "Every recommendation carries its reason.",
                "A living map of concepts, not a checklist.",
                "Adapts to your quiz performance, transparently.",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brass)]"
                    aria-hidden="true"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/45">Transparent, explainable adaptive learning.</p>
        </div>
      </aside>

      {/* Form column */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="font-serif text-2xl font-bold tracking-tight text-[var(--ink)]">SALS</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              Smart Adaptive Learning System
            </p>
          </div>

          <h1 className="font-serif text-[26px] font-bold tracking-tight text-[var(--ink)]">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--ink-soft)]">
            {mode === "login"
              ? "Log in to continue learning."
              : "Start learning data structures, adaptively."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4" noValidate>
          {mode === "register" && (
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
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
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
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
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
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
            <p
              role="alert"
              className="rounded-lg bg-[var(--band-weak-bg)] px-3 py-2 text-sm text-[var(--band-weak)]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-xl bg-[var(--prussian)] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[var(--prussian-deep)] disabled:cursor-not-allowed disabled:bg-[var(--line-strong)]"
          >
            {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
          </form>

          <p className="mt-6 text-sm text-[var(--ink-soft)]">
            {mode === "login" ? (
              <>
                No account?{" "}
                <Link href="/register" className="font-semibold text-[var(--prussian)] hover:underline">
                  Register
                </Link>
              </>
            ) : (
              <>
                Already registered?{" "}
                <Link href="/login" className="font-semibold text-[var(--prussian)] hover:underline">
                  Log in
                </Link>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
