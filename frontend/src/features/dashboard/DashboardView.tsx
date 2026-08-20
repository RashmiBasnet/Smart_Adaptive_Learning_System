"use client";

// The dashboard as a workspace, not a scroll of cards. The prerequisite graph
// is the centrepiece (ConceptMap); a persistent learner-model rail carries the
// summary, the recommendation with its verbatim persisted reason (the Open
// Learner Model — the thesis contribution), and the detail of whichever concept
// is selected. Layout order still leads with the recommendation's substance,
// and every value shown comes straight from the API.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useAuth } from "../../providers/auth-provider";
import { useStudyMode } from "../../providers/study-mode-provider";
import { useOverview, useRecommendation, useMasteryHistory } from "./hooks";
import { NavBar } from "../shell/NavBar";
import { ConceptMap } from "../../components/ConceptMap";
import { BandBadge } from "../../components/BandBadge";
import type {
  DashboardOverview,
  DashboardRecommendation,
  MasteryHistoryPoint,
  OverviewConcept,
} from "../../lib/types/api";

export function DashboardView() {
  const { student } = useAuth();
  const { opaque } = useStudyMode();
  const overview = useOverview();
  const recommendation = useRecommendation();

  // Hovering / focusing / tapping a node opens a peek popover anchored to it.
  // A short close delay lets the pointer travel from the node into the popover.
  const [active, setActive] = useState<{ concept: OverviewConcept; rect: DOMRect } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const keepOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    keepOpen();
    closeTimer.current = setTimeout(() => setActive(null), 140);
  };
  const openPeek = (concept: OverviewConcept, rect: DOMRect) => {
    keepOpen();
    setActive({ concept, rect });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (overview.isLoading) {
    return (
      <>
        <NavBar />
        <p className="py-24 text-center text-[var(--ink-soft)]">Loading your dashboard…</p>
      </>
    );
  }
  if (overview.isError || !overview.data) {
    return (
      <>
        <NavBar />
        <p className="py-24 text-center text-[var(--band-weak)]">
          Couldn&apos;t load the dashboard. Is the API running?
        </p>
      </>
    );
  }

  const data = overview.data;
  const rec = recommendation.data ?? null;
  const recommendedId = rec?.conceptId ?? null;

  return (
    <>
      <NavBar />
      <div className="mx-auto max-w-6xl px-6 py-7">
        <header className="mb-6">
          <h1 className="font-serif text-[clamp(24px,3.4vw,31px)] font-bold tracking-tight text-[var(--ink)]">
            Good to see you, {student?.name ?? data.student.name}
          </h1>
          <p className="mt-1.5 text-[15px] text-[var(--ink-soft)]">
            {opaque
              ? "Each concept is a node; arrows point to what it unlocks. The ring marks where to go next."
              : "Each concept is a node; arrows point to what it unlocks. Colour is your mastery — the brass ring is what we recommend next."}
          </p>
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_336px]">
          {/* ── Concept map ── */}
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div>
                <h2 className="font-serif text-lg font-bold text-[var(--ink)]">
                  Data Structures
                </h2>
                <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
                  {data.concepts.length} concepts · {data.masteredCount} mastered ·
                  foundational → advanced, left to right
                </p>
              </div>
              <MapLegend opaque={opaque} />
            </div>
            <ConceptMap
              concepts={data.concepts}
              recommendedConceptId={recommendedId}
              activeConceptId={active?.concept.conceptId ?? null}
              opaque={opaque}
              onNodeEnter={openPeek}
              onNodeLeave={scheduleClose}
            />
          </section>

          {/* ── Learner-model rail ── */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-[74px]">
            <ProgressPanel overview={data} opaque={opaque} />
            <RailRecommendation recommendation={rec} opaque={opaque} />
            <p className="px-1 text-xs leading-relaxed text-[var(--ink-faint)]">
              Hover a concept on the map to peek at its detail.
            </p>
          </aside>
        </div>
      </div>

      {active && (
        <ConceptPeek
          concept={active.concept}
          allConcepts={data.concepts}
          rect={active.rect}
          opaque={opaque}
          onKeepOpen={keepOpen}
          onRelease={scheduleClose}
        />
      )}
    </>
  );
}

function MapLegend({ opaque }: { opaque: boolean }) {
  // Opaque mode drops the band swatches — the colour code IS the learner model.
  // Only the non-model states (locked, recommended-next) remain.
  const items: { label: string; swatch: React.ReactNode }[] = opaque
    ? [
        { label: "Locked", swatch: <Dot color="var(--sunk)" ring /> },
        { label: "Next", swatch: <Dot color="transparent" brass /> },
      ]
    : [
        { label: "Mastered", swatch: <Dot color="var(--band-strong)" /> },
        { label: "Developing", swatch: <Dot color="var(--band-developing)" /> },
        { label: "Weak", swatch: <Dot color="var(--band-weak)" /> },
        { label: "Locked", swatch: <Dot color="var(--sunk)" ring /> },
        { label: "Next", swatch: <Dot color="transparent" brass /> },
      ];
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[11.5px] text-[var(--ink-soft)]">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.swatch}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

function Dot({ color, ring, brass }: { color: string; ring?: boolean; brass?: boolean }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{
        background: color,
        border: ring
          ? "1px solid var(--line-strong)"
          : brass
            ? "2px solid var(--brass-deep)"
            : undefined,
      }}
      aria-hidden="true"
    />
  );
}

function ProgressPanel({
  overview,
  opaque,
}: {
  overview: DashboardOverview;
  opaque: boolean;
}) {
  const total = overview.concepts.length;
  const fraction = total > 0 ? overview.masteredCount / total : 0;
  const circumference = 2 * Math.PI * 15.5;
  const inProgress = overview.concepts.filter((c) => c.attempts > 0 && !c.mastered).length;

  // Opaque mode: "mastered" is a learner-model judgment (a threshold crossed),
  // so the ring, the mastered count and the in-progress count are all hidden.
  // Only raw activity (quizzes taken) — not an estimate — remains.
  if (opaque) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-[18px] shadow-sm">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
          Your activity
        </p>
        <dl className="flex flex-col gap-1.5 text-[13px]">
          <Stat value={overview.totalAttempts} label="quizzes taken" />
          <Stat value={total} label="concepts in this course" />
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-[18px] shadow-sm">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        Your progress
      </p>
      <div className="flex items-center gap-4">
        <div className="relative h-[74px] w-[74px] shrink-0">
          <svg viewBox="0 0 36 36" className="h-[74px] w-[74px]">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--sunk)" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="var(--prussian)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - fraction)}
              transform="rotate(-90 18 18)"
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-mono text-lg font-semibold tabular-nums text-[var(--ink)]">
            {overview.masteredCount}/{total}
          </span>
        </div>
        <dl className="flex flex-col gap-1.5 text-[13px]">
          <Stat value={overview.masteredCount} label="concepts mastered" />
          <Stat value={overview.totalAttempts} label="quizzes taken" />
          <Stat value={inProgress} label="in progress" />
        </dl>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className="font-mono font-semibold tabular-nums text-[var(--ink)]">{value}</dd>
      <dt className="text-[var(--ink-soft)]">{label}</dt>
    </div>
  );
}

// The Open Learner Model, made persistent. The reason is the PERSISTED
// explanation from the API, shown verbatim — never truncated or regenerated.
//
// Opaque mode keeps the recommendation TARGET (the concept + the "start
// studying" action — the "what") but hides the reason (the "why"), retitles
// away from "Open Learner Model", and drops the empty-state line that
// advertises the reason mechanism.
export function RailRecommendation({
  recommendation,
  opaque = false,
}: {
  recommendation: DashboardRecommendation | null;
  opaque?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(158deg,var(--prussian)_0%,var(--prussian-deep)_100%)] p-[18px] text-[#EAF0F7] shadow-md">
      <span className="inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.15em] text-[var(--brass)]">
        <CompassIcon />
        {opaque ? "Recommended next" : "Open Learner Model"}
      </span>
      {recommendation ? (
        <>
          {recommendation.conceptName && (
            <h2 className="mt-2.5 font-serif text-xl font-bold text-white">
              {recommendation.conceptName}
            </h2>
          )}
          {!opaque && (
            <p className="mt-2 text-sm leading-relaxed text-[#DCE6F1]">
              {recommendation.reason}
            </p>
          )}
          {recommendation.conceptSlug && (
            <Link
              href={`/concepts/${recommendation.conceptSlug}`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--brass)] px-4 py-2.5 text-[13.5px] font-bold text-[#241a06] transition-transform duration-150 hover:-translate-y-0.5"
            >
              Start studying <span aria-hidden="true">→</span>
            </Link>
          )}
        </>
      ) : (
        <>
          <p className="mt-2.5 text-base text-[#DCE6F1]">
            Take your first quiz to get a recommendation.
          </p>
          {!opaque && (
            <p className="mt-1 text-sm text-[#9FB2C9]">
              Every recommendation comes with the reason behind it.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// Peek popover anchored to the hovered/focused node. Deliberately light — a
// quick read of the concept, not a modal: no scrim, no scroll-lock. It stays
// open while the pointer is over the node or the card (onKeepOpen/onRelease),
// and closes on leave or Escape. Positioned with position:fixed from the node's
// on-screen rect, flipping above the node when it sits low in the viewport.
export function ConceptPeek({
  concept,
  allConcepts,
  rect,
  opaque = false,
  onKeepOpen,
  onRelease,
}: {
  concept: OverviewConcept;
  allConcepts: OverviewConcept[];
  rect: DOMRect;
  opaque?: boolean;
  onKeepOpen: () => void;
  onRelease: () => void;
}) {
  const assessed = concept.attempts > 0;
  // Fetch history only for assessed concepts (react-query caches per concept).
  // In opaque mode the trajectory is never shown, so skip the fetch entirely.
  const history = useMasteryHistory(assessed && !opaque ? concept.conceptId : null);
  const points = history.data?.points ?? [];
  const unlocks = allConcepts.filter((c) =>
    c.prerequisites.some((p) => p.conceptId === concept.conceptId)
  );

  const WIDTH = 288;
  const GAP = 10;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const center = rect.left + rect.width / 2;
  const left = Math.min(Math.max(center, WIDTH / 2 + 8), vw - WIDTH / 2 - 8);
  const placeAbove = rect.bottom > vh * 0.6;

  const style: CSSProperties = {
    position: "fixed",
    left,
    width: WIDTH,
    transform: "translateX(-50%)",
    zIndex: 50,
    ...(placeAbove ? { bottom: vh - rect.top + GAP } : { top: rect.bottom + GAP }),
  };

  return (
    <div
      className="sals-dialog rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xl"
      style={style}
      role="dialog"
      aria-label={`${concept.name} detail`}
      onMouseEnter={onKeepOpen}
      onMouseLeave={onRelease}
      onFocus={onKeepOpen}
      onBlur={onRelease}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif text-[17px] font-bold text-[var(--ink)]">{concept.name}</h3>
        {concept.locked ? (
          <span className="rounded-full bg-[var(--sunk)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-soft)]">
            Locked
          </span>
        ) : assessed ? (
          // Opaque mode: the band badge is a learner-model signal — swap it for
          // a neutral "Assessed" chip that leaks no band.
          opaque ? (
            <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--ink-soft)]">
              Assessed
            </span>
          ) : (
            <BandBadge band={concept.band} />
          )
        ) : (
          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--ink-faint)]">
            Not started
          </span>
        )}
      </div>

      {/* Mastery number + trajectory are learner-model signals — hidden wholesale
          in opaque mode (the graph facts below still show in both modes). */}
      {!opaque &&
        (assessed ? (
          <>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-[13px] text-[var(--ink-soft)]">Mastery</span>
              <span className="font-mono text-[15px] font-semibold tabular-nums text-[var(--ink)]">
                {concept.masteryPercent}%
                {concept.mastered && <span className="ml-1.5 text-[var(--band-strong)]">✓</span>}
              </span>
            </div>
            <Sparkline points={points} />
          </>
        ) : (
          <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--ink-soft)]">
            No mastery estimate yet — take a quiz to start measuring this concept.
          </p>
        ))}

      {/* Lock is enforced in both modes; the graph-derived REASON is the model
          signal, so opaque mode shows the lock without the why. */}
      {concept.locked && concept.lockReason && !opaque && (
        <p className="mt-2.5 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed text-[var(--ink-soft)]">
          {concept.lockReason}
        </p>
      )}

      <dl className="mt-2.5 flex flex-col gap-1.5 text-[13px]">
        {concept.prerequisites.length > 0 && (
          <FactRow
            label="Builds on"
            value={concept.prerequisites.map((p) => p.name).join(", ")}
          />
        )}
        {unlocks.length > 0 && (
          <FactRow label="Unlocks" value={unlocks.map((c) => c.name).join(", ")} />
        )}
      </dl>

      <Link
        href={`/concepts/${concept.slug}`}
        className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--prussian)] hover:underline"
      >
        {concept.locked ? "Read lesson" : assessed ? "Study" : "Start"}{" "}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

// Tiny inline mastery trend — plain SVG (no chart lib) so it stays cheap enough
// to render in a hover popover. Shows nothing until there are two points.
function Sparkline({ points }: { points: MasteryHistoryPoint[] }) {
  if (points.length < 2) return null;

  const W = 256;
  const H = 42;
  const PAD = 3;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const xs = points.map((_, i) => PAD + (i * (W - 2 * PAD)) / (points.length - 1));
  const ys = points.map((p) => H - PAD - (clamp(p.masteryPercentAfter) / 100) * (H - 2 * PAD));

  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`;

  const first = clamp(points[0].masteryPercentAfter);
  const last = clamp(points[points.length - 1].masteryPercentAfter);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      className="mt-2"
      role="img"
      aria-label={`Mastery trend: ${first}% to ${last}% over ${points.length} quizzes`}
    >
      <path d={area} fill="var(--prussian)" fillOpacity="0.1" />
      <path
        d={line}
        fill="none"
        stroke="var(--prussian)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill="var(--prussian)" />
    </svg>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-[var(--ink-faint)]">{label}:</dt>
      <dd className="text-[var(--ink-soft)]">{value}</dd>
    </div>
  );
}

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}
