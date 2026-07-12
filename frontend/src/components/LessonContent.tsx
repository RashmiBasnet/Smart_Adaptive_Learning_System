// Renders a lesson body. Lessons are markdown-lite: blank-line-separated
// blocks, where a block is a "## " section heading, a "- " bullet list, or a
// paragraph; inline **bold** and `code` are supported. Rendered with a tiny
// purpose-built formatter instead of a markdown dependency (the stack is
// fixed; this is all the syntax the content uses).

import { Fragment, ReactNode } from "react";
import type { LearningMaterialDto } from "../lib/types/api";

// Split inline text into plain, <strong> (**x**) and <code> (`x`) segments.
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*.+?\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] text-slate-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function renderBlock(block: string, key: number) {
  if (block.startsWith("## ")) {
    return (
      <h3 key={key} className="mt-2 text-base font-bold tracking-tight text-slate-900">
        {renderInline(block.slice(3))}
      </h3>
    );
  }
  const lines = block.split("\n");
  if (lines.every((l) => l.startsWith("- "))) {
    return (
      <ul key={key} className="flex list-disc flex-col gap-1.5 pl-5">
        {lines.map((l, i) => (
          <li key={i} className="text-[15px] leading-relaxed text-slate-700">
            {renderInline(l.slice(2))}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p key={key} className="text-[15px] leading-relaxed text-slate-700">
      {renderInline(block)}
    </p>
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
    <div className="flex flex-col gap-4">
      {materials.map((material) => (
        <article key={material.id} className="flex flex-col gap-3">
          {material.body
            .split(/\n\n+/)
            .map((block, i) => renderBlock(block.trim(), i))}
        </article>
      ))}
    </div>
  );
}
