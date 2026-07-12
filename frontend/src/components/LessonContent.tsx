// Renders a lesson body. Seeded lessons are markdown-lite: paragraphs
// separated by blank lines, with **bold** emphasis. Rendered with a tiny
// purpose-built formatter instead of a markdown dependency (the stack is
// fixed; this is all the syntax the content uses).

import { Fragment } from "react";
import type { LearningMaterialDto } from "../lib/types/api";

// Split "a **b** c" into text and <strong> segments.
function renderEmphasis(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-slate-900">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

export function LessonContent({ materials }: { materials: LearningMaterialDto[] }) {
  if (materials.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        No lesson content for this concept yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {materials.map((material) => (
        <article key={material.id} className="flex flex-col gap-3">
          {material.body.split(/\n\n+/).map((paragraph, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-slate-700">
              {renderEmphasis(paragraph)}
            </p>
          ))}
        </article>
      ))}
    </div>
  );
}
