import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConceptCard } from "../ConceptCard";
import type { OverviewConcept } from "../../lib/types/api";

const concept: OverviewConcept = {
  conceptId: 1,
  slug: "arrays",
  name: "Arrays",
  rating: 1240,
  masteryPercent: 55,
  band: "medium",
  mastered: false,
  attempts: 3,
  lastAttemptAt: "2026-07-08T10:00:00.000Z",
};

describe("ConceptCard", () => {
  it("labels the mastery value as mastery, never as a score", () => {
    render(<ConceptCard concept={concept} />);
    // Thesis wording rule: mastery is "mastery"; only quiz results are "scores".
    expect(screen.getByText(/mastery/i)).toBeInTheDocument();
    expect(screen.getByText("55%")).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });

  it("links to the concept's study page", () => {
    render(<ConceptCard concept={concept} />);
    expect(screen.getByRole("link", { name: /study/i })).toHaveAttribute(
      "href",
      "/concepts/arrays"
    );
  });

  it("shows no mastery number or band before the first quiz", () => {
    render(
      <ConceptCard
        concept={{ ...concept, attempts: 0, lastAttemptAt: null }}
      />
    );
    // Cold-start is a neutral prior, not an assessment: no percentage,
    // no band badge — just an invitation to start.
    expect(screen.getByText("Not assessed yet")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();
  });
});
