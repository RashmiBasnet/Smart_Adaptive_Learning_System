// Root-cause tracing: a read-only derivation over the existing prerequisite
// graph + per-concept mastery. When a student is weak on a concept, the graph
// currently only names that surface concept; this walks backward through the
// broken prerequisite chain to the *deepest* unmastered ancestor — the real
// root gap — so the student is sent to the bottom of the broken chain, not the
// middle.
//
// Rule 0 compliance: no schema, no formula, no new constant. Mastery is judged
// with the single existing threshold via isMastered, and an unassessed concept
// is treated exactly as gating.ts treats it — cold-start rating, i.e.
// unmastered. This only enriches a reason string; it never changes selection,
// gating, or the mastery update.

import { ELO, isMastered } from "./mastery";

// A graph node carries both adjacency (its direct prerequisites) and the
// metadata the reason string needs, so a trace is fully self-describing.
export interface ConceptGraphNode {
  id: number;
  slug: string;
  title: string;
  prerequisiteIds: number[]; // "this concept depends on these"
}

export type ConceptGraph = Map<number, ConceptGraphNode>;

// One deepest-unmastered ancestor. `path` is the chain of concept ids from the
// weak concept down to this root (for examiner traceability); `pathNames` is
// the same chain by title (for the human-readable reason).
export interface RootGap {
  conceptId: number;
  slug: string;
  name: string;
  path: number[];
  pathNames: string[];
}

export interface RootCauseResult {
  weakConceptId: number;
  roots: RootGap[]; // deepest unmastered ancestors, deduped; empty when selfIsGap
  selfIsGap: boolean; // true when there is no deeper cause than the weak concept
}

// Build the trace graph from the same rows the recommendation engine already
// reads: concepts (nodes) and concept_prerequisites (directed edges).
export function buildConceptGraph(
  concepts: { id: number; slug: string; title: string }[],
  edges: { conceptId: number; prerequisiteId: number }[]
): ConceptGraph {
  const graph: ConceptGraph = new Map();
  for (const c of concepts) {
    graph.set(c.id, { id: c.id, slug: c.slug, title: c.title, prerequisiteIds: [] });
  }
  for (const e of edges) {
    graph.get(e.conceptId)?.prerequisiteIds.push(e.prerequisiteId);
  }
  return graph;
}

// Trace the root gap(s) behind a weak concept.
//
// A concept R is a root gap for weak concept X when: R is an unmastered ancestor
// of X reached through a chain of unmastered concepts, AND none of R's own
// direct prerequisites are unmastered (nothing broken lies beneath it). We walk
// backward from X only through unmastered prerequisites; a node all of whose
// direct prerequisites are mastered (or that has none) is a root. If the only
// such root is X itself, there is no deeper cause — selfIsGap.
export function traceRootCause(
  weakConceptId: number,
  graph: ConceptGraph,
  masteryByConceptId: Map<number, number>
): RootCauseResult {
  // Reuse the existing threshold + unassessed handling: a missing rating is a
  // cold-start concept, which isMastered treats as unmastered.
  const masteredId = (id: number): boolean =>
    isMastered(masteryByConceptId.get(id) ?? ELO.COLD_START_RATING);

  const rootsById = new Map<number, RootGap>(); // dedupe roots by conceptId
  const visited = new Set<number>(); // cycle / diamond guard

  const walk = (id: number, path: number[], pathNames: string[]): void => {
    if (visited.has(id)) return;
    visited.add(id);

    const node = graph.get(id);
    const nextPath = [...path, id];
    const nextNames = [...pathNames, node?.title ?? String(id)];

    // Only broken prerequisites keep the chain going; a mastered one is fine.
    const brokenPrereqs = (node?.prerequisiteIds ?? []).filter((p) => !masteredId(p));

    if (brokenPrereqs.length === 0) {
      // Nothing unmastered beneath this concept — it is a root gap.
      if (!rootsById.has(id) && node) {
        rootsById.set(id, {
          conceptId: id,
          slug: node.slug,
          name: node.title,
          path: nextPath,
          pathNames: nextNames,
        });
      }
      return;
    }
    for (const p of brokenPrereqs) walk(p, nextPath, nextNames);
  };

  walk(weakConceptId, [], []);

  // The weak concept is its own root when the only root found is itself — its
  // prerequisites are all mastered (or it has none). Report no invented root.
  const selfRoot = rootsById.get(weakConceptId);
  const selfIsGap = rootsById.size === 1 && selfRoot !== undefined;

  const roots = selfIsGap
    ? []
    : [...rootsById.values()].filter((r) => r.conceptId !== weakConceptId);

  return { weakConceptId, roots, selfIsGap };
}

// Join clauses in the "a, and b" / "a, b, and c" style used in the OLM artifact
// (a comma precedes "and" even for two items, matching the approved wording).
function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]}, and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

// Describe one broken chain, innermost link first: the concept just above the
// root "depends on it", then each further ancestor "depends on" the one below.
function chainPhrase(root: RootGap): string {
  const { pathNames } = root;
  const links: string[] = [];
  for (let i = pathNames.length - 2; i >= 0; i--) {
    links.push(
      i === pathNames.length - 2
        ? `${pathNames[i]} depends on it`
        : `${pathNames[i]} depends on ${pathNames[i + 1]}`
    );
  }
  return joinWithAnd(links);
}

// The human-readable OLM artifact for a trace. Names each root with the chain
// that leads back to it; when there is no deeper cause, says so plainly rather
// than inventing a root.
export function buildRootCauseReason(
  weakConceptName: string,
  result: RootCauseResult
): string {
  if (result.selfIsGap || result.roots.length === 0) {
    return `No prerequisite gap — the weakness is in ${weakConceptName} itself.`;
  }
  if (result.roots.length === 1) {
    const r = result.roots[0];
    return (
      `You're weak on ${weakConceptName}. The root gap is ${r.name} — ` +
      `${chainPhrase(r)}. Strengthen ${r.name} first.`
    );
  }
  const clauses = result.roots.map((r) => `${r.name} (${chainPhrase(r)})`);
  const names = result.roots.map((r) => r.name);
  return (
    `You're weak on ${weakConceptName}. The root gaps are ${joinWithAnd(clauses)}. ` +
    `Strengthen ${joinWithAnd(names)} first.`
  );
}
