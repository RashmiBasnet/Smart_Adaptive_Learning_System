"use client";

// Study-mode context — the ONLY new machinery the evaluation study needs.
//
// The within-subjects study runs every participant through BOTH conditions on
// one codebase and one backend:
//   - "transparent": the real Open Learner Model — reasons, mastery, bands,
//     lock reasons and trajectories are all visible. This is the default and
//     the unchanged product behaviour.
//   - "opaque": adaptation runs IDENTICALLY (same Elo, same gating, same
//     recommendation target — none of that logic is touched anywhere) but
//     every learner-model SIGNAL is hidden. It is a presentation flag only.
//
// The flag is researcher-controlled and never participant-facing. Between the
// two conditions of a session the researcher loads the app once with
// `?study=opaque` or `?study=transparent`; the choice is persisted to
// localStorage and the query string is immediately stripped from the URL so
// the participant never sees it. Default is "transparent".
//
// Like auth-provider, the persisted value is read in an effect (never during
// render) to avoid a hydration mismatch. Until it resolves the app is still in
// its data-loading state, so no real model value is ever painted before the
// mode is known.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type StudyMode = "transparent" | "opaque";

const STORAGE_KEY = "sals.studyMode";

interface StudyModeState {
  mode: StudyMode;
  // Convenience mirror of `mode === "opaque"` — the flag components branch on.
  opaque: boolean;
  // false until localStorage / the URL param has been checked on mount.
  ready: boolean;
  setMode: (mode: StudyMode) => void;
}

const StudyModeContext = createContext<StudyModeState | null>(null);

function isStudyMode(value: unknown): value is StudyMode {
  return value === "transparent" || value === "opaque";
}

export function StudyModeProvider({
  children,
  // Test / storybook override: forces the mode and skips URL + localStorage
  // resolution. Not used by the running app.
  initialMode,
}: {
  children: ReactNode;
  initialMode?: StudyMode;
}) {
  const [mode, setModeState] = useState<StudyMode>(initialMode ?? "transparent");
  const [ready, setReady] = useState(initialMode !== undefined);

  const setMode = useCallback((next: StudyMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable — keep the choice in memory for this session.
    }
  }, []);

  useEffect(() => {
    if (initialMode !== undefined) return; // forced; nothing to resolve.

    let resolved: StudyMode | null = null;
    try {
      // A ?study= param (set by the researcher when switching conditions) wins
      // and is persisted, then stripped from the URL so the participant can't
      // read the condition off the address bar.
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("study");
      if (isStudyMode(fromUrl)) {
        resolved = fromUrl;
        localStorage.setItem(STORAGE_KEY, fromUrl);
        params.delete("study");
        const qs = params.toString();
        const cleaned =
          window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
        window.history.replaceState(null, "", cleaned);
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isStudyMode(stored)) resolved = stored;
      }
    } catch {
      // Ignore malformed URLs / storage errors — fall back to the default.
    }

    // Reading localStorage / the URL is exactly the "sync from an external
    // system on mount" case effects exist for; setting state here is correct
    // and mirrors auth-provider. Doing it during render (e.g. a useState
    // initializer) would reintroduce a server/client hydration mismatch.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (resolved) setModeState(resolved);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialMode]);

  return (
    <StudyModeContext.Provider
      value={{ mode, opaque: mode === "opaque", ready, setMode }}
    >
      {children}
    </StudyModeContext.Provider>
  );
}

export function useStudyMode(): StudyModeState {
  const ctx = useContext(StudyModeContext);
  if (!ctx) throw new Error("useStudyMode must be used inside StudyModeProvider");
  return ctx;
}
