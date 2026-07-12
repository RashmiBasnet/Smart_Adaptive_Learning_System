"use client";

// The dashboard page body. Approved layout order (top to bottom):
// 1. RecommendationBanner (most prominent — the Open Learner Model lead)
// 2. Concept grid
// 3. Strengths row (hidden when both lists are empty)
// 4. Mastery chart with concept selector

import { useState } from "react";
import { useAuth } from "../../providers/auth-provider";
import {
  useOverview,
  useStrengths,
  useRecommendation,
  useMasteryHistory,
} from "./hooks";
import { NavBar } from "../shell/NavBar";
import { RecommendationBanner } from "../../components/RecommendationBanner";
import { ConceptCard } from "../../components/ConceptCard";
import { BandBadge } from "../../components/BandBadge";
import { MasteryChart } from "../../components/MasteryChart";
import type { StrengthEntry } from "../../lib/types/api";

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      <span className="text-lg font-bold tabular-nums text-slate-900">{value}</span>
      <span className="ml-1.5 text-sm text-slate-500">{label}</span>
    </div>
  );
}

function StrengthList({
  title,
  entries,
  emptyText,
}: {
  title: string;
  entries: StrengthEntry[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 font-semibold text-slate-900">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {entries.map((c) => (
            <li key={c.conceptId} className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{c.name}</span>
              <BandBadge band={c.band} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardView() {
  const { student } = useAuth();
  const overview = useOverview();
  const strengths = useStrengths();
  const recommendation = useRecommendation();

  // Chart selector: default to the first concept once the overview loads.
  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(null);
  const conceptIdForChart =
    selectedConceptId ?? overview.data?.concepts[0]?.conceptId ?? null;
  const history = useMasteryHistory(conceptIdForChart);

  if (overview.isLoading) {
    return (
      <>
        <NavBar />
        <p className="py-24 text-center text-slate-500">Loading your dashboard…</p>
      </>
    );
  }
  if (overview.isError || !overview.data) {
    return (
      <>
        <NavBar />
        <p className="py-24 text-center text-rose-600">
          Couldn&apos;t load the dashboard. Is the API running?
        </p>
      </>
    );
  }

  const { concepts, totalAttempts, masteredCount } = overview.data;
  const weak = strengths.data?.weak ?? [];
  const strong = strengths.data?.strong ?? [];

  return (
    <>
      <NavBar />
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Hi, {student?.name ?? overview.data.student.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Here&apos;s where your learning stands today.
            </p>
          </div>
          <div className="flex gap-3">
            <StatChip label={totalAttempts === 1 ? "quiz taken" : "quizzes taken"} value={totalAttempts} />
            <StatChip label="mastered" value={masteredCount} />
          </div>
        </header>

        {/* 1. The recommendation + its persisted reason lead the page. */}
        <RecommendationBanner recommendation={recommendation.data ?? null} />

        {/* 2. All concepts, including unattempted ones (cold-start = medium). */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Concepts</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {concepts.map((c) => (
              <ConceptCard key={c.conceptId} concept={c} />
            ))}
          </div>
        </section>

        {/* 3. Strengths — hidden entirely when there is no evidence yet. */}
        {(weak.length > 0 || strong.length > 0) && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StrengthList
              title="Working on"
              entries={weak}
              emptyText="Nothing flagged right now."
            />
            <StrengthList
              title="Going well"
              entries={strong}
              emptyText="Keep practising to build strengths."
            />
          </section>
        )}

        {/* 4. Mastery trend per concept. */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Mastery over time</h2>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Concept
              <select
                value={conceptIdForChart ?? ""}
                onChange={(e) => setSelectedConceptId(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:border-slate-400"
              >
                {concepts.map((c) => (
                  <option key={c.conceptId} value={c.conceptId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {history.isLoading ? (
            <p className="py-12 text-center text-sm text-slate-500">Loading trend…</p>
          ) : (
            <MasteryChart points={history.data?.points ?? []} />
          )}
        </section>
      </div>
    </>
  );
}
