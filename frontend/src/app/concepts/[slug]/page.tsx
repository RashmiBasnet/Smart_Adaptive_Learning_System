"use client";

// Concept page: lesson content + quiz flow for one concept, addressed by slug.
//
// The quiz API is keyed by numeric concept id; the slug from the URL is
// resolved via the overview endpoint (which returns id + slug for every
// concept) rather than adding a new backend lookup route.

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { RequireAuth } from "../../../features/auth/RequireAuth";
import { NavBar } from "../../../features/shell/NavBar";
import { useOverview } from "../../../features/dashboard/hooks";
import { useConceptMaterials } from "../../../features/concepts/hooks";
import { QuizRunner } from "../../../features/quiz/QuizRunner";
import { BandBadge } from "../../../components/BandBadge";
import { LessonContent } from "../../../components/LessonContent";

function ConceptPageBody() {
  const params = useParams<{ slug: string }>();
  const overview = useOverview();
  const [quizStarted, setQuizStarted] = useState(false);

  const concept = overview.data?.concepts.find((c) => c.slug === params.slug);
  const materials = useConceptMaterials(concept?.conceptId ?? null);

  if (overview.isLoading) {
    return <p className="py-24 text-center text-slate-500">Loading…</p>;
  }
  if (!concept) {
    return (
      <div className="py-24 text-center">
        <p className="font-medium text-slate-700">Concept not found.</p>
        <Link
          href="/dashboard"
          className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <header>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
        >
          ← Dashboard
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {concept.name}
          </h1>
          {/* No band badge before the first quiz — cold-start is a neutral
              prior, not an assessment (same display rule as ConceptCard). */}
          {concept.attempts > 0 && <BandBadge band={concept.band} />}
        </div>
        <p className="mt-1.5 text-sm text-slate-500">
          {concept.attempts > 0 ? (
            <>
              Mastery:{" "}
              <span className="font-semibold tabular-nums text-slate-700">
                {concept.masteryPercent}%
              </span>
              <span className="ml-2 text-slate-400">
                · {concept.attempts} quiz{concept.attempts === 1 ? "" : "zes"} taken
              </span>
            </>
          ) : (
            <>Not assessed yet — read the lesson, then take your first quiz.</>
          )}
        </p>
      </header>

      {quizStarted ? (
        <QuizRunner conceptId={concept.conceptId} />
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Lesson
            </h2>
            {materials.isLoading ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading lesson…</p>
            ) : materials.isError ? (
              <p className="py-6 text-center text-sm text-rose-600">
                Couldn&apos;t load the lesson.
              </p>
            ) : (
              <LessonContent materials={materials.data?.materials ?? []} />
            )}
          </div>
          <button
            onClick={() => setQuizStarted(true)}
            className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-indigo-700"
          >
            Take quiz
          </button>
        </>
      )}
    </div>
  );
}

export default function ConceptPage() {
  return (
    <RequireAuth>
      <NavBar />
      <ConceptPageBody />
    </RequireAuth>
  );
}
