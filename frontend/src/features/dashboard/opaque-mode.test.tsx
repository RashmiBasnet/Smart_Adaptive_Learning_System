import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  DashboardRecommendation,
  OverviewConcept,
  QuizResult,
} from "../../lib/types/api";
import { ConceptMap } from "../../components/ConceptMap";
import { RailRecommendation, ConceptPeek } from "./DashboardView";
import { QuizResultScreen } from "../quiz/QuizRunner";

// next/link needs no router to render an anchor for these unit tests.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { toString(): string };
    children: React.ReactNode;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

// The opaque condition claims ONE variable changes: transparency. These fixtures
// are shared across modes so the tests can assert that only the explanation
// differs, never the adaptation (target, locks, structure).
const arrays: OverviewConcept = {
  conceptId: 1,
  slug: "arrays",
  name: "Arrays",
  rating: 1240,
  masteryPercent: 55,
  band: "medium",
  mastered: false,
  attempts: 3,
  lastAttemptAt: null,
  prerequisites: [],
  locked: false,
  lockReason: null,
};

const linkedLists: OverviewConcept = {
  conceptId: 2,
  slug: "linked-lists",
  name: "Linked Lists",
  rating: 1180,
  masteryPercent: 40,
  band: "weak",
  mastered: false,
  attempts: 2,
  lastAttemptAt: null,
  prerequisites: [{ conceptId: 1, slug: "arrays", name: "Arrays", mastered: false }],
  locked: false,
  lockReason: null,
};

const graphs: OverviewConcept = {
  conceptId: 7,
  slug: "graphs",
  name: "Graphs",
  rating: 1200,
  masteryPercent: 50,
  band: "medium",
  mastered: false,
  attempts: 0,
  lastAttemptAt: null,
  prerequisites: [{ conceptId: 2, slug: "linked-lists", name: "Linked Lists", mastered: false }],
  locked: true,
  lockReason: "Locked — Graphs requires Linked Lists (currently 40%).",
};

const concepts = [arrays, linkedLists, graphs];

function renderMap(opaque: boolean) {
  return render(
    <ConceptMap
      concepts={concepts}
      recommendedConceptId={1}
      activeConceptId={null}
      opaque={opaque}
      onNodeEnter={() => {}}
      onNodeLeave={() => {}}
    />
  );
}

describe("ConceptMap — opaque vs transparent", () => {
  it("transparent shows mastery %, band colours and the 'REVISE NEXT' label", () => {
    const { container } = renderMap(false);
    expect(screen.getByText("55%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(container.innerHTML).toMatch(/var\(--band-developing\)/); // medium fill
    expect(container.innerHTML).toMatch(/var\(--band-weak\)/); // weak fill
    expect(screen.getByText(/REVISE NEXT/)).toBeInTheDocument();
  });

  it("opaque hides every mastery number, all band colour, and the rec-type label", () => {
    const { container } = renderMap(true);
    expect(screen.queryByText("55%")).not.toBeInTheDocument();
    expect(screen.queryByText("40%")).not.toBeInTheDocument();
    // No band colour reaches any node fill…
    expect(container.innerHTML).not.toMatch(/var\(--band-/);
    // …and "REVISE" (the recommendation type) is gone, replaced by a neutral label.
    expect(screen.queryByText(/REVISE NEXT/)).not.toBeInTheDocument();
    expect(screen.getByText(/★ NEXT/)).toBeInTheDocument();
  });

  it("keeps adaptation identical: same recommendation target and same locks in both modes", () => {
    for (const opaque of [false, true]) {
      const { unmount } = renderMap(opaque);
      // The recommended concept is marked in both modes (only its label differs).
      expect(
        screen.getByRole("button", { name: /Arrays,.*recommended next/i })
      ).toBeInTheDocument();
      // The locked concept stays locked in both modes.
      expect(
        screen.getByRole("button", { name: /Graphs, locked/i })
      ).toBeInTheDocument();
      unmount();
    }
  });
});

describe("RailRecommendation — opaque vs transparent", () => {
  const rec: DashboardRecommendation = {
    conceptId: 1,
    conceptSlug: "arrays",
    conceptName: "Arrays",
    reason: "You're at 35% on Arrays, which Linked Lists depends on. Strengthen Arrays first.",
    generatedAt: "2026-07-08T10:00:00.000Z",
  };

  it("transparent shows the persisted reason and the OLM label", () => {
    render(<RailRecommendation recommendation={rec} opaque={false} />);
    expect(screen.getByText(/Linked Lists depends on/)).toBeInTheDocument();
    expect(screen.getByText("Open Learner Model")).toBeInTheDocument();
    expect(screen.getByText(/Start studying/)).toBeInTheDocument();
  });

  it("opaque keeps the target + action but hides the reason and the OLM label", () => {
    render(<RailRecommendation recommendation={rec} opaque={true} />);
    // What (target) and the action remain…
    expect(screen.getByText("Arrays")).toBeInTheDocument();
    expect(screen.getByText(/Start studying/)).toBeInTheDocument();
    // …but the why is gone, and nothing advertises the reasoning mechanism.
    expect(screen.queryByText(/Linked Lists depends on/)).not.toBeInTheDocument();
    expect(screen.queryByText("Open Learner Model")).not.toBeInTheDocument();
    expect(screen.getByText("Recommended next")).toBeInTheDocument();
  });
});

describe("QuizResultScreen — opaque vs transparent", () => {
  const result: QuizResult = {
    attemptId: 9,
    quizScorePercent: 67,
    correctCount: 4,
    totalQuestions: 6,
    review: [
      {
        questionId: 11,
        stem: "What is the index of the first element of an array?",
        difficulty: "easy",
        isCorrect: false,
        selectedOptionText: "1",
        correctOptionText: "0",
        explanation: "The first element is zero steps from the start.",
      },
    ],
    mastery: {
      updated: true,
      oldPercent: 52,
      newPercent: 56,
      mastered: false,
      reason: "Your Arrays mastery moved from 52% to 56%.",
    },
    recommendation: {
      type: "PRACTISE_CURRENT",
      targetConceptId: 1,
      reason: "You're at 56% on Arrays. Keep practising to unlock Linked Lists.",
      persisted: true,
    },
  };

  it("transparent shows the mastery change and the recommendation reason", () => {
    render(<QuizResultScreen result={result} opaque={false} />);
    expect(screen.getByText("52%")).toBeInTheDocument();
    expect(screen.getByText(/moved from 52% to 56%/)).toBeInTheDocument();
    expect(screen.getByText(/Keep practising to unlock/)).toBeInTheDocument();
  });

  it("opaque hides mastery + reasons but keeps the quiz score and per-question review", () => {
    render(<QuizResultScreen result={result} opaque={true} />);
    // Learner-model surfaces are gone (52% and 56% appear only in those).
    expect(screen.queryByText(/52%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/56%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Keep practising to unlock/)).not.toBeInTheDocument();
    expect(screen.getByText(/Head back to your dashboard/)).toBeInTheDocument();
    // Ordinary correctness feedback survives in both modes.
    expect(screen.getByText(/Quiz score/)).toBeInTheDocument();
    expect(
      screen.getByText(/What is the index of the first element/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Correct answer:/)).toBeInTheDocument();
  });
});

describe("ConceptPeek — lock reason suppression", () => {
  function renderPeek(opaque: boolean) {
    const client = new QueryClient();
    const rect = { left: 100, top: 100, right: 200, bottom: 150, width: 100, height: 50 } as DOMRect;
    return render(
      <QueryClientProvider client={client}>
        <ConceptPeek
          concept={graphs}
          allConcepts={concepts}
          rect={rect}
          opaque={opaque}
          onKeepOpen={() => {}}
          onRelease={() => {}}
        />
      </QueryClientProvider>
    );
  }

  it("transparent shows the graph-derived lock reason", () => {
    renderPeek(false);
    expect(screen.getByText(/Graphs requires Linked Lists/)).toBeInTheDocument();
  });

  it("opaque keeps the lock but hides its reason", () => {
    renderPeek(true);
    const dialog = screen.getByRole("dialog");
    // Still visibly locked…
    expect(within(dialog).getByText("Locked")).toBeInTheDocument();
    // …but no explanation of why.
    expect(screen.queryByText(/Graphs requires Linked Lists/)).not.toBeInTheDocument();
  });
});
