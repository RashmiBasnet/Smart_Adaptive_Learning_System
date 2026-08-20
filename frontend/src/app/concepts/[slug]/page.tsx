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
import { useStudyMode } from "../../../providers/study-mode-provider";
import { QuizRunner } from "../../../features/quiz/QuizRunner";
import { BandBadge } from "../../../components/BandBadge";
import { LessonContent, extractHeadings } from "../../../components/LessonContent";

function ConceptPageBody() {
  const params = useParams<{ slug: string }>();
  const overview = useOverview();
  const { opaque } = useStudyMode();
  const [quizStarted, setQuizStarted] = useState(false);

  const concept = overview.data?.concepts.find((c) => c.slug === params.slug);
  const materials = useConceptMaterials(concept?.conceptId ?? null);

  if (overview.isLoading) {
    return <p className="py-24 text-center text-[var(--ink-soft)]">Loading…</p>;
  }
  if (!concept) {
    return (
      <div className="py-24 text-center">
        <p className="font-medium text-[var(--ink)]">Concept not found.</p>
        <Link
          href="/dashboard"
          className="mt-2 inline-block text-sm font-semibold text-[var(--prussian)] hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const allConcepts = overview.data?.concepts ?? [];
  const unlocks = allConcepts.filter((c) =>
    c.prerequisites.some((p) => p.conceptId === concept.conceptId)
  );
  const lessonMaterials = materials.data?.materials ?? [];
  const headings = extractHeadings(lessonMaterials);
  const assessed = concept.attempts > 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header>
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-[var(--prussian)] transition-colors hover:underline"
        >
          ← Dashboard
        </Link>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--brass-ink)]">
          Data Structures · Lesson
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <h1 className="font-serif text-[38px] font-bold leading-[1.1] tracking-tight text-[var(--ink)]">
            {concept.name}
          </h1>
          {/* No band badge before the first quiz — cold-start is a neutral
              prior, not an assessment. Hidden entirely in opaque mode (band is
              a learner-model signal). */}
          {assessed && !opaque && <BandBadge band={concept.band} />}
        </div>
        <p className="mt-3 text-sm text-[var(--ink-soft)]">
          {assessed ? (
            opaque ? (
              // Opaque mode: keep raw activity, drop the mastery estimate.
              <>
                {concept.attempts} quiz{concept.attempts === 1 ? "" : "zes"} taken
              </>
            ) : (
              <>
                Mastery:{" "}
                <span className="font-mono font-semibold tabular-nums text-[var(--ink)]">
                  {concept.masteryPercent}%
                </span>
                <span className="ml-2 text-[var(--ink-faint)]">
                  · {concept.attempts} quiz{concept.attempts === 1 ? "" : "zes"} taken
                </span>
              </>
            )
          ) : (
            <>Not assessed yet — read the lesson, then take your first quiz.</>
          )}
        </p>
        <hr className="mt-6 h-px border-0 bg-[var(--line)]" />
      </header>

      {quizStarted ? (
        <div className="mx-auto mt-8 max-w-2xl">
          <QuizRunner conceptId={concept.conceptId} />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_296px] lg:items-start">
          {/* Reading column */}
          <article className="max-w-[42rem]">
            {materials.isLoading ? (
              <p className="py-6 text-sm text-[var(--ink-soft)]">Loading lesson…</p>
            ) : materials.isError ? (
              <p className="py-6 text-sm text-[var(--band-weak)]">
                Couldn&apos;t load the lesson.
              </p>
            ) : (
              <LessonContent materials={lessonMaterials} />
            )}
          </article>

          {/* Sticky sidebar — concept meta, contents, and the quiz gate. */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-[74px]">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                This concept
              </p>
              {opaque ? (
                // Opaque mode: no mastery estimate on the panel. The graph facts
                // (builds on / unlocks) below still render in both modes.
                <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">
                  {assessed
                    ? "You've taken a quiz on this concept."
                    : "Not assessed yet — take a quiz when you're ready."}
                </p>
              ) : assessed ? (
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-[var(--ink-soft)]">Mastery</span>
                  <span className="font-mono text-[15px] font-semibold tabular-nums text-[var(--ink)]">
                    {concept.masteryPercent}%
                    {concept.mastered && (
                      <span className="ml-1.5 text-[var(--band-strong)]">✓</span>
                    )}
                  </span>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">
                  No mastery estimate yet — take a quiz to start measuring it.
                </p>
              )}
              <dl className="mt-3 flex flex-col gap-1.5 text-[13px]">
                {concept.prerequisites.length > 0 && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-[var(--ink-faint)]">Builds on:</dt>
                    <dd className="text-[var(--ink-soft)]">
                      {concept.prerequisites.map((p) => p.name).join(", ")}
                    </dd>
                  </div>
                )}
                {unlocks.length > 0 && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-[var(--ink-faint)]">Unlocks:</dt>
                    <dd className="text-[var(--ink-soft)]">
                      {unlocks.map((c) => c.name).join(", ")}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {headings.length > 1 && (
              <nav
                aria-label="Lesson contents"
                className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm"
              >
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  In this lesson
                </p>
                <ol className="flex flex-col gap-1.5 text-[13.5px]">
                  {headings.map((h) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        className="text-[var(--ink-soft)] transition-colors hover:text-[var(--prussian)]"
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            {concept.locked ? (
              // The quiz gate's explanation, shown verbatim (OLM artifact). The
              // API enforces the same rule with a 403 — this is just the surface.
              <div className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ink-faint)]"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <div>
                  <p className="font-semibold text-[var(--ink)]">Quiz locked</p>
                  {/* The lock is enforced in both modes; opaque mode hides the
                      graph-derived REASON (the learner-model explanation). */}
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">
                    {opaque
                      ? "This quiz isn't available yet."
                      : concept.lockReason}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
                <h2 className="font-serif text-base font-bold text-[var(--ink)]">
                  Ready to test yourself?
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                  A short adaptive quiz updates your mastery for {concept.name}.
                </p>
                <button
                  onClick={() => setQuizStarted(true)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--prussian)] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[var(--prussian-deep)]"
                >
                  Take quiz <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </aside>
        </div>
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
