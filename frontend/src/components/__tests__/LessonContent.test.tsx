import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LessonContent } from "../LessonContent";
import type { LearningMaterialDto } from "../../lib/types/api";

const material: LearningMaterialDto = {
  id: 1,
  type: "theory",
  difficultyTier: "standard",
  body: "Reading by index is **O(1)** no matter the size.\n\nInsertion can be slower.",
  orderIndex: 0,
};

describe("LessonContent", () => {
  it("renders paragraphs and bold emphasis from the lesson body", () => {
    render(<LessonContent materials={[material]} />);
    const bold = screen.getByText("O(1)");
    expect(bold.tagName).toBe("STRONG");
    expect(screen.getByText(/Insertion can be slower/)).toBeInTheDocument();
    // Raw markdown markers must never leak into the page.
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no materials", () => {
    render(<LessonContent materials={[]} />);
    expect(
      screen.getByText("No lesson content for this concept yet.")
    ).toBeInTheDocument();
  });
});
