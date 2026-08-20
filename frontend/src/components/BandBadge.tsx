// Band badge (weak / medium / strong). The band value comes from the API;
// it is never recomputed client-side — do not add threshold logic here.
// A colored dot supplements the color so meaning doesn't rely on hue alone.

import type { Band } from "../lib/types/api";

const TOKENS: Record<Band, { fg: string; bg: string; label: string }> = {
  weak: { fg: "var(--band-weak)", bg: "var(--band-weak-bg)", label: "Needs work" },
  medium: { fg: "var(--band-developing)", bg: "var(--band-developing-bg)", label: "Developing" },
  strong: { fg: "var(--band-strong)", bg: "var(--band-strong-bg)", label: "Strong" },
};

export function BandBadge({ band }: { band: Band }) {
  const { fg, bg, label } = TOKENS[band];
  return (
    <span
      data-band={band}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: fg, background: bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} aria-hidden="true" />
      {label}
    </span>
  );
}
