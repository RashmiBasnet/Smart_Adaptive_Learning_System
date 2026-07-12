"use client";

// Persistent top navigation for authenticated pages: brand wordmark home link
// plus the signed-in student and logout. Kept in features/ (not components/)
// because it reads auth state.

import Link from "next/link";
import { useAuth } from "../../providers/auth-provider";

export function NavBar() {
  const { student, signOut } = useAuth();

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* Book glyph — inline SVG, consistent 2px stroke */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-indigo-600"
            aria-hidden="true"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span className="text-lg font-bold tracking-tight text-slate-900">SALS</span>
        </Link>

        <div className="flex items-center gap-3">
          {student && (
            <span className="hidden text-sm text-slate-600 sm:inline">{student.name}</span>
          )}
          <button
            onClick={signOut}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
