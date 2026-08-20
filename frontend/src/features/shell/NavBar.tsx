"use client";

// Persistent top navigation for authenticated pages: brand wordmark home link
// plus the signed-in student and logout. Kept in features/ (not components/)
// because it reads auth state.

import Link from "next/link";
import { useAuth } from "../../providers/auth-provider";

export function NavBar() {
  const { student, signOut } = useAuth();

  return (
    <nav className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--paper)]/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/dashboard" className="flex items-baseline gap-2.5">
          <span className="font-serif text-xl font-bold tracking-tight text-[var(--ink)]">
            SALS
          </span>
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)] sm:inline">
            Smart Adaptive Learning
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {student && (
            <span className="hidden text-sm text-[var(--ink-soft)] sm:inline">
              {student.name}
            </span>
          )}
          <button
            onClick={signOut}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
