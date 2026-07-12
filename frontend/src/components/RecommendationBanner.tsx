// The Open Learner Model banner — the most prominent element on the dashboard.
// The reason string is the PERSISTED explanation from the API, shown verbatim:
// never truncate, rewrite, or regenerate it client-side. This transparency is
// the thesis contribution; the banner exists to surface it.

import Link from "next/link";
import type { DashboardRecommendation } from "../lib/types/api";

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

export function RecommendationBanner({
  recommendation,
}: {
  recommendation: DashboardRecommendation | null;
}) {
  if (!recommendation) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-md sm:p-8">
        <div className="flex items-center gap-2 text-indigo-200">
          <CompassIcon />
          <h2 className="text-xs font-semibold uppercase tracking-widest">
            Recommended next
          </h2>
        </div>
        <p className="mt-3 text-lg text-indigo-50">
          Take your first quiz to get a recommendation.
        </p>
        <p className="mt-1 text-sm text-indigo-200">
          Every recommendation comes with the reason behind it.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-md sm:p-8">
      <div className="flex items-center gap-2 text-indigo-200">
        <CompassIcon />
        <h2 className="text-xs font-semibold uppercase tracking-widest">
          Recommended next
        </h2>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">
        {recommendation.conceptName ?? "A concept"}
      </p>
      {/* Verbatim persisted reason — body text, not small print. */}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-indigo-50">
        {recommendation.reason}
      </p>
      {recommendation.conceptSlug && (
        <Link
          href={`/concepts/${recommendation.conceptSlug}`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-colors duration-200 hover:bg-indigo-50"
        >
          Start studying
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
