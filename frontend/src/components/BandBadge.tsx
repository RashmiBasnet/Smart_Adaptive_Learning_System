// Band badge (weak / medium / strong). The band value comes from the API;
// it is never recomputed client-side — do not add threshold logic here.
// A colored dot supplements the color so meaning doesn't rely on hue alone.

import type { Band } from "../lib/types/api";

const STYLES: Record<Band, { badge: string; dot: string }> = {
  weak: { badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  medium: { badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  strong: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
};

const LABELS: Record<Band, string> = {
  weak: "Needs work",
  medium: "In progress",
  strong: "Strong",
};

export function BandBadge({ band }: { band: Band }) {
  const style = STYLES[band];
  return (
    <span
      data-band={band}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {LABELS[band]}
    </span>
  );
}
