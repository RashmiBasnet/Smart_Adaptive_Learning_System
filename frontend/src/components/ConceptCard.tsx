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

export function ConceptCard({ concept }: { concept: OverviewConcept }) {
  const assessed = concept.attempts > 0;

  return (
    <Link
      href={`/concepts/${concept.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{concept.name}</h3>
        {assessed ? (
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

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <p className="text-xs text-slate-500">
          {assessed
            ? `${concept.attempts} quiz${concept.attempts === 1 ? "" : "zes"} taken`
            : "Take your first quiz to get an estimate"}
        </p>
        <span className="text-sm font-medium text-indigo-600 transition-transform duration-200 group-hover:translate-x-0.5">
          {assessed ? "Study →" : "Start →"}
        </span>
      </div>
    </Link>
  );
}
