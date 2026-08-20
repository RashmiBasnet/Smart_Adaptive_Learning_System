"use client";

// The quiz flow for one concept: fetch the served quiz (single page, all six
// questions — chosen over one-at-a-time for simplicity), collect answers,
// submit, then show the result screen in the approved order:
//   quiz score → mastery change → new recommendation with its verbatim reason.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getQuiz, submitQuiz } from "../../lib/api/quiz";
import { ApiError } from "../../lib/api/client";
import type { QuizResult, ServedQuiz, SubmitAnswer } from "../../lib/types/api";
import { QuizQuestion } from "../../components/QuizQuestion";
import { useStudyMode } from "../../providers/study-mode-provider";

// Display-order shuffle for MCQ options. The API currently returns options in
// stored order, and the seeded bank stores the correct answer first — served
// as-is, "always pick A" would score 100% and poison the evaluation data.
// Shuffling here is presentation only (grading is by option id); the root
// cause (seed data / serving order) is escalated to the project chat.
function shuffleOptions(quiz: ServedQuiz): ServedQuiz {
  return {
    ...quiz,
    questions: quiz.questions.map((q) => {
      const options = q.options.slice();
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return { ...q, options };
    }),
  };
}

export function QuizRunner({ conceptId }: { conceptId: number }) {
  const queryClient = useQueryClient();
  const { opaque } = useStudyMode();
  const quiz = useQuery({
    queryKey: ["quiz", conceptId],
    queryFn: () => getQuiz(conceptId),
    // A quiz is a one-shot draw; don't refetch and shuffle it mid-attempt.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // questionId -> selectedOptionId
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  // Shuffle once per fetched quiz, stable across re-renders while answering.
  const shuffledQuiz = useMemo(
    () => (quiz.data ? shuffleOptions(quiz.data) : null),
    [quiz.data]
  );

  const submit = useMutation({
    mutationFn: (payload: SubmitAnswer[]) => submitQuiz(conceptId, payload),
    onSuccess: (data) => {
      setResult(data);
      // Mastery and the recommendation just changed server-side.
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["strengths"] });
      queryClient.invalidateQueries({ queryKey: ["recommendation"] });
      queryClient.invalidateQueries({ queryKey: ["mastery-history"] });
      queryClient.removeQueries({ queryKey: ["quiz", conceptId] });
    },
  });

  if (quiz.isLoading) {
    return <p className="py-12 text-center text-[var(--ink-soft)]">Preparing your quiz…</p>;
  }
  if (quiz.isError || !shuffledQuiz) {
    // A 403 from the quiz gate carries the graph-derived lock reason —
    // surface it verbatim rather than a generic failure message.
    const lockReason =
      quiz.error instanceof ApiError ? quiz.error.lockReason : undefined;
    if (lockReason) {
      return (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-5">
          <p className="font-semibold text-[var(--ink)]">Quiz locked</p>
          {/* Opaque mode hides the graph-derived reason; the lock still holds. */}
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">
            {opaque ? "This quiz isn't available yet." : lockReason}
          </p>
        </div>
      );
    }
    return (
      <p className="py-12 text-center text-[var(--band-weak)]">Couldn&apos;t load the quiz.</p>
    );
  }

  if (result) return <QuizResultScreen result={result} opaque={opaque} />;

  const { questions } = shuffledQuiz;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress: answered count + bar */}
      <div className="sticky top-14 z-10 -mx-1 rounded-xl border border-[var(--line)] bg-[var(--surface)]/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-[var(--ink)]">
            {answeredCount} of {questions.length} answered
          </span>
          <span className="font-mono tabular-nums text-[var(--ink-soft)]">
            {Math.round((answeredCount / questions.length) * 100)}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--sunk)]">
          <div
            className="h-full rounded-full bg-[var(--prussian)] transition-all duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {questions.map((q, i) => (
        <QuizQuestion
          key={q.id}
          index={i}
          question={q}
          selectedOptionId={answers[q.id] ?? null}
          onSelect={(optionId) => setAnswers((a) => ({ ...a, [q.id]: optionId }))}
        />
      ))}

      <button
        disabled={!allAnswered || submit.isPending}
        onClick={() =>
          submit.mutate(
            questions.map((q) => ({
              questionId: q.id,
              selectedOptionId: answers[q.id] ?? null,
            }))
          )
        }
        className="rounded-xl bg-[var(--prussian)] px-5 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[var(--prussian-deep)] disabled:cursor-not-allowed disabled:bg-[var(--line-strong)]"
      >
        {submit.isPending
          ? "Submitting…"
          : allAnswered
            ? "Submit quiz"
            : `Answer ${questions.length - answeredCount} more to submit`}
      </button>
      {submit.isError && (
        <p className="text-center text-sm text-[var(--band-weak)]">
          Submission failed — try again.
        </p>
      )}
    </div>
  );
}

// Result screen. Wording rule (thesis-critical): the quiz result is a SCORE;
// the mastery percentages are MASTERY. They are different numbers from the
// API and must never be conflated or relabelled.
//
// Opaque mode hides the two learner-model surfaces on this screen — the
// mastery-change block (old% → new%, the ✓ and the mastery reason) and the
// recommendation's verbatim reason. The quiz score and the per-question review
// stay in both modes: raw correctness feedback is not a model signal, and the
// adaptation that produced the quiz is unchanged.
export function QuizResultScreen({
  result,
  opaque = false,
}: {
  result: QuizResult;
  opaque?: boolean;
}) {
  const { correctCount, totalQuestions, mastery, recommendation, review } = result;
  const masteryWentUp = mastery.newPercent >= mastery.oldPercent;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Quiz score */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
          Quiz score
        </p>
        <p className="mt-2 font-mono text-5xl font-bold tabular-nums tracking-tight text-[var(--ink)]">
          {correctCount}
          <span className="text-2xl font-medium text-[var(--ink-faint)]">/{totalQuestions}</span>
        </p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          {correctCount === totalQuestions
            ? "Perfect round!"
            : correctCount >= totalQuestions / 2
              ? "Nice work — keep going."
              : "Every attempt sharpens the picture."}
        </p>
      </div>

      {/* 2. Mastery change — a learner-model surface, hidden in opaque mode. */}
      {!opaque && (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
          Mastery
        </p>
        {mastery.updated ? (
          <p className="mt-2 flex items-baseline gap-2 font-mono text-2xl font-bold tabular-nums text-[var(--ink)]">
            <span className="text-[var(--ink-faint)] line-through decoration-2">
              {mastery.oldPercent}%
            </span>
            <span
              aria-hidden="true"
              className={masteryWentUp ? "text-[var(--band-strong)]" : "text-[var(--band-weak)]"}
            >
              →
            </span>
            <span className={masteryWentUp ? "text-[var(--band-strong)]" : "text-[var(--band-weak)]"}>
              {mastery.newPercent}%
            </span>
            {mastery.mastered && (
              <span className="text-sm font-semibold text-[var(--band-strong)]">✓ mastered</span>
            )}
          </p>
        ) : (
          <p className="mt-2 text-[var(--ink-soft)]">
            This quiz was too short to update your mastery.
          </p>
        )}
        {mastery.reason && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{mastery.reason}</p>
        )}
      </div>
      )}

      {/* Per-question review: what was right, what was wrong, and the correct
          answer where it matters — the feedback that lets a student learn. */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
          Your answers
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {review.map((item, i) => (
            <li
              key={item.questionId}
              className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5"
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: item.isCorrect ? "var(--band-strong)" : "var(--band-weak)" }}
              >
                {item.isCorrect ? "✓" : "✗"}
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-medium text-[var(--ink)]">
                  {i + 1}. {item.stem}
                </p>
                <p
                  className="mt-1"
                  style={{ color: item.isCorrect ? "var(--band-strong)" : "var(--band-weak)" }}
                >
                  Your answer: {item.selectedOptionText ?? "(not answered)"}
                </p>
                {!item.isCorrect && (
                  <p className="mt-0.5 text-[var(--ink-soft)]">
                    Correct answer:{" "}
                    <span className="font-medium text-[var(--ink)]">{item.correctOptionText}</span>
                  </p>
                )}
                {item.explanation && (
                  <p className="mt-1.5 border-l-2 border-[var(--line-strong)] pl-2.5 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                    {item.explanation}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 3. New recommendation — verbatim persisted reason, prominent. In
          opaque mode the reason (the why) is replaced by a neutral pointer back
          to the dashboard, where the recommendation target still shows. */}
      <div className="rounded-2xl bg-[linear-gradient(158deg,var(--prussian)_0%,var(--prussian-deep)_100%)] p-6 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brass)]">
          What next
        </p>
        <p className="mt-2 text-base leading-relaxed text-[#DCE6F1]">
          {opaque
            ? "Head back to your dashboard for your next concept."
            : recommendation.reason}
        </p>
      </div>

      <Link
        href="/dashboard"
        className="rounded-xl bg-[var(--ink)] px-5 py-3 text-center font-semibold text-white shadow-sm transition-colors duration-200 hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
