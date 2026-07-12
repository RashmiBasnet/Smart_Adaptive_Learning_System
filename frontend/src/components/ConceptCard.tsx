// One concept on the dashboard grid. All numbers come from the API and are
// never recomputed client-side (the progress bar width just renders the
// API's masteryPercent).
//
// Display rule: a concept with no attempts shows NO mastery number — the
// model's cold-start value is a neutral prior, not evidence, and presenting
// it as "50%" reads as measured progress. The underlying rating still drives
// quiz banding server-side; this is presentation only.
//
// Wording rule (thesis-critical): masteryPercent is MASTERY, not a "score".
// Quiz results are scores; mastery is the learner-model estimate. Never label
// mastery as "score" in this component.

import Link from "next/link";
import type { Band, OverviewConcept } from "../lib/types/api";
import { BandBadge } from "./BandBadge";

const BAR_COLORS: Record<Band, string> = {
  weak: "bg-rose-500",
  medium: "bg-amber-500",
  strong: "bg-emerald-500",
};

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function ConceptCard({ concept }: { concept: OverviewConcept }) {
  const assessed = concept.attempts > 0;

  return (
    <Link
      href={`/concepts/${concept.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{concept.name}</h3>
        {concept.locked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-300">
            <LockIcon className="h-3 w-3" />
            Locked
          </span>
        ) : assessed ? (
          <BandBadge band={concept.band} />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden="true" />
            Not started
          </span>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-slate-500">Mastery</span>
          {assessed ? (
            <span className="font-semibold tabular-nums text-slate-900">
              {concept.masteryPercent}%
              {concept.mastered && (
                <span className="ml-1.5 font-medium text-emerald-600">✓ mastered</span>
              )}
            </span>
          ) : (
            <span className="text-sm text-slate-400">Not assessed yet</span>
          )}
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={assessed ? concept.masteryPercent : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${concept.name} mastery`}
        >
          {assessed && (
            <div
              className={`h-full rounded-full transition-all duration-300 ${BAR_COLORS[concept.band]}`}
              style={{ width: `${concept.masteryPercent}%` }}
            />
          )}
        </div>
      </div>

      {/* The quiz gate's explanation — an OLM artifact, shown prominently and
          verbatim, never tucked into a tooltip. Lessons stay readable. */}
      {concept.locked && concept.lockReason && (
        <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-200">
          <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          {concept.lockReason}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <p className="text-xs text-slate-500">
          {concept.locked
            ? "Lesson open — quiz unlocks with its prerequisites"
            : assessed
              ? `${concept.attempts} quiz${concept.attempts === 1 ? "" : "zes"} taken`
              : "Take your first quiz to get an estimate"}
        </p>
        <span className="text-sm font-medium text-indigo-600 transition-transform duration-200 group-hover:translate-x-0.5">
          {concept.locked ? "Read lesson →" : assessed ? "Study →" : "Start →"}
        </span>
      </div>
    </Link>
  );
}
