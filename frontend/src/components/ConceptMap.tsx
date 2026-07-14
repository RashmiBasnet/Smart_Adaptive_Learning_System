"use client";

// The prerequisite graph, drawn. Concepts are nodes; an arrow runs from a
// concept to what it unlocks. Nodes are laid out in columns by graph depth
// (foundational → advanced), so the picture reads as a learning path rather
// than a flat list. Everything shown comes from the API's overview payload —
// band, masteryPercent, locked, prerequisites — and is never recomputed here;
// depth/position is pure layout, not a learner-model value.

import { useMemo, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { Band, OverviewConcept } from "../lib/types/api";

const BAND_COLOR: Record<Band, string> = {
  weak: "var(--band-weak)",
  medium: "var(--band-developing)",
  strong: "var(--band-strong)",
};

// Layout constants (SVG user units).
const NODE_R = 30;
const COL_GAP = 196;
const ROW_GAP = 112;
const MARGIN_X = 62;
const MIN_HEIGHT = 360;

interface Placed {
  concept: OverviewConcept;
  x: number;
  y: number;
}

// Longest-path depth of each concept (root with no prerequisites = 0), matching
// the backend's own depth notion. Guarded against a bad cyclic edge.
function computeDepths(concepts: OverviewConcept[]): Map<number, number> {
  const prereqIds = new Map<number, number[]>();
  for (const c of concepts) prereqIds.set(c.conceptId, c.prerequisites.map((p) => p.conceptId));

  const memo = new Map<number, number>();
  const visiting = new Set<number>();
  const depth = (id: number): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    let d = 0;
    for (const p of prereqIds.get(id) ?? []) {
      if (prereqIds.has(p)) d = Math.max(d, depth(p) + 1);
    }
    visiting.delete(id);
    memo.set(id, d);
    return d;
  };
  for (const c of concepts) depth(c.conceptId);
  return memo;
}

function layout(concepts: OverviewConcept[]) {
  const depths = computeDepths(concepts);
  const maxDepth = Math.max(0, ...concepts.map((c) => depths.get(c.conceptId) ?? 0));

  // Group into columns by depth, stable order within a column.
  const columns: OverviewConcept[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (const c of [...concepts].sort((a, b) => a.conceptId - b.conceptId)) {
    columns[depths.get(c.conceptId) ?? 0].push(c);
  }

  const maxRows = Math.max(1, ...columns.map((col) => col.length));
  const width = MARGIN_X * 2 + maxDepth * COL_GAP;
  const height = Math.max(MIN_HEIGHT, maxRows * ROW_GAP + 24);
  const centerY = height / 2;

  const placed = new Map<number, Placed>();
  columns.forEach((col, d) => {
    const baseY = centerY - ((col.length - 1) / 2) * ROW_GAP;
    col.forEach((concept, i) => {
      placed.set(concept.conceptId, {
        concept,
        x: MARGIN_X + d * COL_GAP,
        y: baseY + i * ROW_GAP,
      });
    });
  });

  return { placed, width, height, columnCount: maxDepth + 1 };
}

const COLUMN_LABELS = ["Foundation", "Core", "Intermediate", "Advanced", "Expert"];

export interface ConceptMapProps {
  concepts: OverviewConcept[];
  recommendedConceptId: number | null;
  // The concept whose peek popover is open (hovered / focused / tapped).
  activeConceptId: number | null;
  onNodeEnter: (concept: OverviewConcept, rect: DOMRect) => void;
  onNodeLeave: () => void;
}

export function ConceptMap({
  concepts,
  recommendedConceptId,
  activeConceptId,
  onNodeEnter,
  onNodeLeave,
}: ConceptMapProps) {
  const { placed, width, height, columnCount } = useMemo(() => layout(concepts), [concepts]);

  // Edges: one per prerequisite, drawn from the prerequisite to the dependent.
  // Edges leaving the recommended concept are highlighted — "revising this
  // unlocks these".
  const edges = concepts.flatMap((c) => {
    const to = placed.get(c.conceptId);
    if (!to) return [];
    return c.prerequisites
      .map((p) => placed.get(p.conceptId))
      .filter((from): from is Placed => Boolean(from))
      .map((from) => ({
        key: `${from.concept.conceptId}-${c.conceptId}`,
        from,
        to,
        highlighted: from.concept.conceptId === recommendedConceptId,
      }));
  });

  return (
    <div className="overflow-x-auto px-2 py-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: Math.min(width, 640), height: "auto" }}
        role="img"
        aria-label="Prerequisite concept map. Select a concept to see its detail."
      >
        {/* column headings */}
        {Array.from({ length: columnCount }).map((_, d) => (
          <text
            key={`col-${d}`}
            x={MARGIN_X + d * COL_GAP}
            y={16}
            textAnchor="middle"
            className="font-mono"
            fontSize="10.5"
            letterSpacing="0.05em"
            fill="var(--ink-faint)"
          >
            {(COLUMN_LABELS[d] ?? `Level ${d + 1}`).toUpperCase()}
          </text>
        ))}

        {/* edges (behind nodes) */}
        {edges.map(({ key, from, to, highlighted }) => {
          const mx = (from.x + to.x) / 2;
          return (
            <path
              key={key}
              d={`M ${from.x + NODE_R} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x - NODE_R} ${to.y}`}
              fill="none"
              stroke={highlighted ? "var(--brass)" : "var(--line-strong)"}
              strokeWidth={highlighted ? 3 : 1.6}
            />
          );
        })}

        {/* nodes */}
        {[...placed.values()].map(({ concept, x, y }) => (
          <ConceptNode
            key={concept.conceptId}
            concept={concept}
            x={x}
            y={y}
            recommended={concept.conceptId === recommendedConceptId}
            active={concept.conceptId === activeConceptId}
            onEnter={onNodeEnter}
            onLeave={onNodeLeave}
          />
        ))}
      </svg>
    </div>
  );
}

function ConceptNode({
  concept,
  x,
  y,
  recommended,
  active,
  onEnter,
  onLeave,
}: {
  concept: OverviewConcept;
  x: number;
  y: number;
  recommended: boolean;
  active: boolean;
  onEnter: (concept: OverviewConcept, rect: DOMRect) => void;
  onLeave: () => void;
}) {
  const assessed = concept.attempts > 0;
  const locked = concept.locked;
  const enter = (e: MouseEvent | FocusEvent | KeyboardEvent) =>
    onEnter(concept, e.currentTarget.getBoundingClientRect());

  const fill = locked
    ? "var(--sunk)"
    : assessed
      ? BAND_COLOR[concept.band]
      : "var(--surface-2)";
  const ring = locked || !assessed ? "var(--line-strong)" : "color-mix(in srgb, black 18%, transparent)";

  const stateLabel = locked
    ? "locked"
    : assessed
      ? `${concept.masteryPercent}% mastery`
      : "not started";
  const ariaLabel =
    `${concept.name}, ${stateLabel}` + (recommended ? ", recommended next" : "");

  return (
    <g
      className="sals-map-node"
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-expanded={active}
      onMouseEnter={enter}
      onMouseLeave={onLeave}
      onFocus={enter}
      onBlur={onLeave}
      onClick={enter}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          enter(e);
        }
      }}
    >
      {/* hover + focus rings (toggled via globals.css) */}
      <circle className="sals-node-hover" cx={x} cy={y} r={NODE_R + 6} fill="none" stroke="var(--line-strong)" strokeWidth={2} />
      <circle className="sals-node-focus" cx={x} cy={y} r={NODE_R + 8} fill="none" stroke="var(--prussian)" strokeWidth={2} />

      {/* recommendation halo */}
      {recommended && (
        <>
          <circle cx={x} cy={y} r={NODE_R + 8} fill="none" stroke="var(--brass-deep)" strokeWidth={2.5} strokeDasharray="3 4" />
          <text x={x} y={y - NODE_R - 16} textAnchor="middle" className="font-mono" fontSize="10" fontWeight="700" letterSpacing="0.08em" fill="var(--brass-ink)">
            ★ REVISE NEXT
          </text>
        </>
      )}

      {/* active (peeked) ring */}
      {active && !recommended && (
        <circle cx={x} cy={y} r={NODE_R + 6} fill="none" stroke="var(--prussian)" strokeWidth={2.5} />
      )}

      {/* node body */}
      <circle cx={x} cy={y} r={NODE_R} fill={fill} stroke={ring} strokeWidth={2} strokeDasharray={locked || !assessed ? "4 4" : undefined} />

      {locked ? (
        <g transform={`translate(${x - 8}, ${y - 8})`} stroke="var(--ink-faint)" strokeWidth={2} fill="none" aria-hidden="true">
          <rect x="0" y="5" width="16" height="11" rx="2" />
          <path d="M4 5V3a4 4 0 0 1 8 0v2" />
        </g>
      ) : assessed ? (
        <text x={x} y={y + 5} textAnchor="middle" className="font-mono" fontSize="14" fontWeight="600" fill="#ffffff">
          {concept.masteryPercent}%
        </text>
      ) : (
        <text x={x} y={y + 5} textAnchor="middle" className="font-mono" fontSize="15" fill="var(--ink-faint)">
          –
        </text>
      )}

      {/* name */}
      <text
        x={x}
        y={y + NODE_R + 20}
        textAnchor="middle"
        className="font-serif"
        fontSize="13.5"
        fontWeight={active || recommended ? 700 : 600}
        fill={locked ? "var(--ink-soft)" : "var(--ink)"}
      >
        {concept.name}
      </text>
    </g>
  );
}
