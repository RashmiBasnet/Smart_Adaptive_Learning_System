// One MCQ question with radio-style options. Pure presentation: selection
// state lives in the quiz feature; this component reports choices upward.

import type { QuizQuestionDto } from "../lib/types/api";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuizQuestion({
  index,
  question,
  selectedOptionId,
  onSelect,
}: {
  index: number;
  question: QuizQuestionDto;
  selectedOptionId: number | null;
  onSelect: (optionId: number) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
      <legend className="sr-only">Question {index + 1}</legend>
      <p className="flex gap-3 font-medium text-[var(--ink)]">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] font-mono text-sm font-semibold text-[var(--prussian)]">
          {index + 1}
        </span>
        <span className="pt-0.5">{question.stem}</span>
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {question.options.map((option, i) => {
          const selected = selectedOptionId === option.id;
          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-sm transition-colors duration-150 ${
                selected
                  ? "border-[var(--prussian)] bg-[var(--prussian-tint)] ring-1 ring-[var(--prussian)]"
                  : "border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={selected}
                onChange={() => onSelect(option.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold transition-colors duration-150 ${
                  selected
                    ? "bg-[var(--prussian)] text-white"
                    : "bg-[var(--sunk)] text-[var(--ink-soft)]"
                }`}
              >
                {OPTION_LETTERS[i] ?? "•"}
              </span>
              <span className={selected ? "font-medium text-[var(--ink)]" : "text-[var(--ink-soft)]"}>
                {option.text}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
