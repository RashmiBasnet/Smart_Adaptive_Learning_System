import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StudyModeProvider, useStudyMode } from "./study-mode-provider";

// A probe that surfaces the resolved study mode as plain text for assertions.
function Probe() {
  const { mode, opaque, ready } = useStudyMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="opaque">{String(opaque)}</span>
      <span data-testid="ready">{String(ready)}</span>
    </div>
  );
}

describe("StudyModeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/dashboard");
  });

  it("defaults to transparent when nothing is set", async () => {
    render(
      <StudyModeProvider>
        <Probe />
      </StudyModeProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("ready")).toHaveTextContent("true")
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("transparent");
    expect(screen.getByTestId("opaque")).toHaveTextContent("false");
  });

  it("restores a persisted opaque mode from localStorage", async () => {
    localStorage.setItem("sals.studyMode", "opaque");
    render(
      <StudyModeProvider>
        <Probe />
      </StudyModeProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("mode")).toHaveTextContent("opaque")
    );
    expect(screen.getByTestId("opaque")).toHaveTextContent("true");
  });

  it("takes ?study=opaque from the URL, persists it, and strips it from the address bar", async () => {
    window.history.replaceState(null, "", "/dashboard?study=opaque&keep=1");
    render(
      <StudyModeProvider>
        <Probe />
      </StudyModeProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("mode")).toHaveTextContent("opaque")
    );
    // The researcher's choice is persisted…
    expect(localStorage.getItem("sals.studyMode")).toBe("opaque");
    // …and the participant never sees the condition in the URL, but other
    // params survive.
    expect(window.location.search).toBe("?keep=1");
    expect(window.location.search).not.toContain("study");
  });

  it("lets the URL param flip a previously persisted mode back to transparent", async () => {
    localStorage.setItem("sals.studyMode", "opaque");
    window.history.replaceState(null, "", "/dashboard?study=transparent");
    render(
      <StudyModeProvider>
        <Probe />
      </StudyModeProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("mode")).toHaveTextContent("transparent")
    );
    expect(localStorage.getItem("sals.studyMode")).toBe("transparent");
  });

  it("honours a forced initialMode and ignores storage (test/override path)", () => {
    localStorage.setItem("sals.studyMode", "opaque");
    render(
      <StudyModeProvider initialMode="transparent">
        <Probe />
      </StudyModeProvider>
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("transparent");
    expect(screen.getByTestId("ready")).toHaveTextContent("true");
  });

  it("ignores a malformed ?study= value and keeps the default", async () => {
    window.history.replaceState(null, "", "/dashboard?study=banana");
    render(
      <StudyModeProvider>
        <Probe />
      </StudyModeProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("ready")).toHaveTextContent("true")
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("transparent");
  });
});
