"use client";

// Held-out pre/post evaluation screen — the study's outcome instrument, NOT a
// learning experience. It deliberately differs from the practice quiz:
//   - it shows the participant NO feedback (no score, no right/wrong, no review);
//   - it is not adaptive and shows no band / mastery / recommendation;
//   - it offers no retake;
//   - it looks and behaves IDENTICALLY in transparent and opaque mode — it is
//     the shared measuring stick across both conditions;
//   - answering is optional per question (an unanswered item is graded
//     incorrect by the backend).
//
// Phase (PRE / POST) comes from ?phase= in the URL and is never labelled on
// screen — it exists for the researcher, and a mislabelled sitting is
// unrecoverable data corruption, so an invalid phase blocks the test entirely.
// The researcher navigates here directly; the screen is intentionally unlinked
// from any participant-facing nav.

import { Suspense, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { RequireAuth } from "../../../features/auth/RequireAuth";
import { NavBar } from "../../../features/shell/NavBar";
import { useStudyMode } from "../../../providers/study-mode-provider";
import { useEvalQuestions } from "../../../features/eval/hooks";
import { submitEval } from "../../../lib/api/eval";
import { QuizQuestion } from "../../../components/QuizQuestion";
import type { EvalPhase } from "../../../lib/types/api";

type Step = "intro" | "quiz" | "done";

// Exported for unit tests, which render it directly under mocked navigation and
// api modules. The route uses the default export below.
export function EvalScreen() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  // Read the mode ONLY to record it — never to branch any UI. The instrument is
  // identical across conditions.
  const { mode } = useStudyMode();

  const query = useEvalQuestions(slug);

  const [step, setStep] = useState<Step>("intro");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showUnansweredConfirm, setShowUnansweredConfirm] = useState(false);
  // Guards against a double-submit creating a duplicate sitting. A ref (not
  // state) so two synchronous clicks can't both slip through before a re-render.
  const submittedRef = useRef(false);

  const rawPhase = searchParams.get("phase");
  const phase = (rawPhase ?? "").toUpperCase();
  const validPhase = phase === "PRE" || phase === "POST";

  const questions = query.data?.questions ?? [];
  const unansweredCount = questions.filter((q) => answers[q.id] == null).length;

  const mutation = useMutation({
    mutationFn: () =>
      submitEval(
        slug,
        // Only reachable once the phase is validated (the Submit button is
        // rendered only in that branch).
        phase as EvalPhase,
        questions.map((q) => ({
          questionId: q.id,
          selectedOptionId: answers[q.id] ?? null,
        })),
        mode
      ),
    onSuccess: () => setStep("done"),
    onError: () => {
      // Allow a retry without re-entering answers.
      submittedRef.current = false;
    },
  });

  function handleSubmit() {
    if (unansweredCount > 0 && !showUnansweredConfirm) {
      setShowUnansweredConfirm(true);
      return;
    }
    if (submittedRef.current || mutation.isPending) return;
    submittedRef.current = true;
    mutation.mutate();
  }

  // Researcher-facing configuration error — a missing/invalid phase must never
  // silently default, so the test does not render at all.
  if (!validPhase) {
    return (
      <Shell>
        <div className="rounded-2xl border border-[var(--band-weak)] bg-[var(--surface)] p-6 shadow-sm">
          <p className="font-semibold text-[var(--band-weak)]">
            Missing or invalid ?phase= (expected PRE or POST)
          </p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Add ?phase=PRE or ?phase=POST to the URL to run a sitting.
          </p>
        </div>
      </Shell>
    );
  }

  if (query.isLoading) {
    return (
      <Shell>
        <p className="py-16 text-center text-[var(--ink-soft)]">Loading…</p>
      </Shell>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Shell>
        <p className="py-16 text-center text-[var(--band-weak)]">
          Couldn&apos;t load the assessment. Is the API running?
        </p>
      </Shell>
    );
  }

  const set = query.data;

  if (step === "done") {
    return (
      <Shell>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <h1 className="font-serif text-2xl font-bold text-[var(--ink)]">
            Response recorded.
          </h1>
          <p className="mt-2 text-[var(--ink-soft)]">
            Please hand back to the researcher.
          </p>
        </div>
      </Shell>
    );
  }

  if (step === "intro") {
    return (
      <Shell>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Assessment
          </p>
          <h1 className="mt-2 font-serif text-[32px] font-bold leading-[1.1] tracking-tight text-[var(--ink)]">
            {set.conceptTitle}
          </h1>
          <p className="mt-4 max-w-prose leading-relaxed text-[var(--ink-soft)]">
            This is a short assessment. You will not be told which answers were
            right — it is measuring the system, not you.
          </p>
          <p className="mt-2 text-sm text-[var(--ink-faint)]">
            {set.totalQuestions} question{set.totalQuestions === 1 ? "" : "s"}.
          </p>
          <button
            onClick={() => setStep("quiz")}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--prussian)] px-5 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[var(--prussian-deep)]"
          >
            Begin <span aria-hidden="true">→</span>
          </button>
        </div>
      </Shell>
    );
  }

  // step === "quiz"
  return (
    <Shell>
      <div className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <QuizQuestion
            key={q.id}
            index={i}
            question={q}
            selectedOptionId={answers[q.id] ?? null}
            onSelect={(optionId) => setAnswers((a) => ({ ...a, [q.id]: optionId }))}
          />
        ))}

        {showUnansweredConfirm && unansweredCount > 0 && (
          <p className="text-sm text-[var(--ink-soft)]">
            {unansweredCount} question{unansweredCount === 1 ? "" : "s"} unanswered.
            Submit anyway?
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="rounded-xl bg-[var(--prussian)] px-5 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[var(--prussian-deep)] disabled:cursor-not-allowed disabled:bg-[var(--line-strong)]"
        >
          {mutation.isPending ? "Submitting…" : "Submit"}
        </button>

        {mutation.isError && (
          <p className="text-center text-sm text-[var(--band-weak)]">
            Submission failed — try again.
          </p>
        )}
      </div>
    </Shell>
  );
}

// Shared page frame so every state sits in the same column.
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-5 py-10">{children}</div>;
}

function EvalScreenFallback() {
  return (
    <Shell>
      <p className="py-16 text-center text-[var(--ink-soft)]">Loading…</p>
    </Shell>
  );
}

export default function EvalPage() {
  return (
    <RequireAuth>
      <NavBar />
      {/* useSearchParams must sit inside a Suspense boundary in the App Router. */}
      <Suspense fallback={<EvalScreenFallback />}>
        <EvalScreen />
      </Suspense>
    </RequireAuth>
  );
}
