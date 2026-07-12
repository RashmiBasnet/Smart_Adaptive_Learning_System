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
    return <p className="py-12 text-center text-slate-500">Preparing your quiz…</p>;
  }
  if (quiz.isError || !shuffledQuiz) {
    // A 403 from the quiz gate carries the graph-derived lock reason —
    // surface it verbatim rather than a generic failure message.
    const lockReason =
      quiz.error instanceof ApiError ? quiz.error.lockReason : undefined;
    if (lockReason) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-semibold text-slate-800">Quiz locked</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{lockReason}</p>
        </div>
      );
    }
    return (
      <p className="py-12 text-center text-rose-600">Couldn&apos;t load the quiz.</p>
    );
  }

  if (result) return <QuizResultScreen result={result} />;

  const { questions } = shuffledQuiz;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress: answered count + bar */}
      <div className="sticky top-14 z-10 -mx-1 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {answeredCount} of {questions.length} answered
          </span>
          <span className="tabular-nums text-slate-500">
            {Math.round((answeredCount / questions.length) * 100)}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-300"
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
        className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submit.isPending
          ? "Submitting…"
          : allAnswered
            ? "Submit quiz"
            : `Answer ${questions.length - answeredCount} more to submit`}
      </button>
      {submit.isError && (
        <p className="text-center text-sm text-rose-600">
          Submission failed — try again.
        </p>
      )}
    </div>
  );
}

// Result screen. Wording rule (thesis-critical): the quiz result is a SCORE;
// the mastery percentages are MASTERY. They are different numbers from the
// API and must never be conflated or relabelled.
function QuizResultScreen({ result }: { result: QuizResult }) {
  const { correctCount, totalQuestions, mastery, recommendation, review } = result;
  const masteryWentUp = mastery.newPercent >= mastery.oldPercent;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Quiz score */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Quiz score
        </p>
        <p className="mt-2 text-5xl font-bold tabular-nums tracking-tight text-slate-900">
          {correctCount}
          <span className="text-2xl font-medium text-slate-400">/{totalQuestions}</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {correctCount === totalQuestions
            ? "Perfect round!"
            : correctCount >= totalQuestions / 2
              ? "Nice work — keep going."
              : "Every attempt sharpens the picture."}
        </p>
      </div>

      {/* 2. Mastery change */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Mastery
        </p>
        {mastery.updated ? (
          <p className="mt-2 flex items-baseline gap-2 text-2xl font-bold tabular-nums text-slate-900">
            <span className="text-slate-400 line-through decoration-2">
              {mastery.oldPercent}%
            </span>
            <span aria-hidden="true" className={masteryWentUp ? "text-emerald-600" : "text-rose-500"}>
              →
            </span>
            <span className={masteryWentUp ? "text-emerald-600" : "text-rose-500"}>
              {mastery.newPercent}%
            </span>
            {mastery.mastered && (
              <span className="text-sm font-semibold text-emerald-600">✓ mastered</span>
            )}
          </p>
        ) : (
          <p className="mt-2 text-slate-600">
            This quiz was too short to update your mastery.
          </p>
        )}
        {mastery.reason && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{mastery.reason}</p>
        )}
      </div>

      {/* Per-question review: what was right, what was wrong, and the correct
          answer where it matters — the feedback that lets a student learn. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Your answers
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {review.map((item, i) => (
            <li
              key={item.questionId}
              className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5"
            >
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                  item.isCorrect ? "bg-emerald-500" : "bg-rose-500"
                }`}
              >
                {item.isCorrect ? "✓" : "✗"}
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-900">
                  {i + 1}. {item.stem}
                </p>
                <p className={`mt-1 ${item.isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                  Your answer: {item.selectedOptionText ?? "(not answered)"}
                </p>
                {!item.isCorrect && (
                  <p className="mt-0.5 text-slate-600">
                    Correct answer:{" "}
                    <span className="font-medium text-slate-900">{item.correctOptionText}</span>
                  </p>
                )}
                {item.explanation && (
                  <p className="mt-1.5 border-l-2 border-slate-200 pl-2.5 text-[13px] leading-relaxed text-slate-500">
                    {item.explanation}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 3. New recommendation — verbatim persisted reason, prominent. */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200">
          What next
        </p>
        <p className="mt-2 text-base leading-relaxed text-indigo-50">
          {recommendation.reason}
        </p>
      </div>

      <Link
        href="/dashboard"
        className="rounded-xl bg-slate-900 px-5 py-3 text-center font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-slate-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
