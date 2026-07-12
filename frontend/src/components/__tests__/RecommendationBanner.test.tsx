import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecommendationBanner } from "../RecommendationBanner";
import type { DashboardRecommendation } from "../../lib/types/api";

describe("RecommendationBanner", () => {
  it("shows the persisted reason string verbatim", () => {
    const recommendation: DashboardRecommendation = {
      conceptId: 2,
      conceptSlug: "linked-lists",
      conceptName: "Linked Lists",
      // Deliberately awkward string: if the UI truncated, trimmed, or
      // rewrote the reason, this exact-match assertion would fail.
      reason:
        "You're at 35% on Arrays, which Linked Lists depends on. We recommend strengthening Arrays first.",
      generatedAt: "2026-07-08T10:00:00.000Z",
    };

    render(<RecommendationBanner recommendation={recommendation} />);
    expect(screen.getByText(recommendation.reason)).toBeInTheDocument();
    expect(screen.getByText("Linked Lists")).toBeInTheDocument();
  });

  it("renders the empty state when there is no recommendation", () => {
    render(<RecommendationBanner recommendation={null} />);
    expect(
      screen.getByText("Take your first quiz to get a recommendation.")
    ).toBeInTheDocument();
  });
});
