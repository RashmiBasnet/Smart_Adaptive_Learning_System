// Renders a lesson body as an editorial reading column. Lessons are
// markdown-lite: blank-line-separated blocks, where a block is a "## " section
// heading, a "- " bullet list, or a paragraph; inline **bold** and `code` are
// supported. Rendered with a tiny purpose-built formatter instead of a markdown
// dependency (the stack is fixed; this is all the syntax the content uses).

import { Fragment, ReactNode } from "react";
import type { LearningMaterialDto } from "../lib/types/api";

// Split inline text into plain, <strong> (**x**) and <code> (`x`) segments.
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*.+?\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[var(--ink)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--prussian)] ring-1 ring-inset ring-[var(--line)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function isBullets(block: string): boolean {
  return block.split("\n").every((l) => l.startsWith("- "));
}

// Strip inline **bold** / `code` markers to plain text (for ids + contents).
function plainText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}

export function slugifyHeading(text: string): string {
  return plainText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The "## " section headings across all materials, for a contents list.
export function extractHeadings(
  materials: LearningMaterialDto[]
): { id: string; text: string }[] {
  const headings: { id: string; text: string }[] = [];
  for (const material of materials) {
    for (const raw of material.body.split(/\n\n+/)) {
      const block = raw.trim();
      if (block.startsWith("## ")) {
        const text = plainText(block.slice(3));
        headings.push({ id: slugifyHeading(text), text });
      }
    }
  }
  return headings;
}

function renderBlock(block: string, key: number, isLead: boolean) {
  if (block.startsWith("## ")) {
    const text = block.slice(3);
    return (
      <h3
        key={key}
        id={slugifyHeading(text)}
        className="mt-4 scroll-mt-20 font-serif text-[22px] font-bold leading-snug tracking-tight text-[var(--ink)]"
      >
        {renderInline(text)}
      </h3>
    );
  }
  if (isBullets(block)) {
    return (
      <ul
        key={key}
        className="flex list-disc flex-col gap-2 pl-5 marker:text-[var(--brass-deep)]"
      >
        {block.split("\n").map((l, i) => (
          <li key={i} className="text-[16.5px] leading-[1.7] text-[var(--ink-soft)]">
            {renderInline(l.slice(2))}
          </li>
        ))}
      </ul>
    );
  }
  // Lead paragraph gets a larger, darker treatment to open the reading.
  return (
    <p
      key={key}
      className={
        isLead
          ? "text-[19px] leading-[1.6] text-[var(--ink)]"
          : "text-[16.5px] leading-[1.75] text-[var(--ink-soft)]"
      }
    >
      {renderInline(block)}
    </p>
  );
}

export function LessonContent({ materials }: { materials: LearningMaterialDto[] }) {
  if (materials.length === 0) {
    return (
      <p className="py-6 text-sm text-[var(--ink-soft)]">
        No lesson content for this concept yet.
      </p>
    );
  }

  // The first paragraph across all materials reads as the lead.
  const lead = { used: false };

  return (
    <div className="flex flex-col gap-6">
      {materials.map((material) => (
        <article key={material.id} className="flex flex-col gap-5">
          {material.body.split(/\n\n+/).map((raw, i) => {
            const block = raw.trim();
            const isParagraph = !block.startsWith("## ") && !isBullets(block);
            const isLead = isParagraph && !lead.used;
            if (isLead) lead.used = true;
            return renderBlock(block, i, isLead);
          })}
        </article>
      ))}
    </div>
  );
}
