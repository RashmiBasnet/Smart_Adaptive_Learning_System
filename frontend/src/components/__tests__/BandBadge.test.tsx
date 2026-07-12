import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BandBadge } from "../BandBadge";

describe("BandBadge", () => {
  it("renders each band with its label and data attribute", () => {
    const { rerender } = render(<BandBadge band="weak" />);
    expect(screen.getByText("Needs work")).toHaveAttribute("data-band", "weak");

    rerender(<BandBadge band="medium" />);
    expect(screen.getByText("In progress")).toHaveAttribute("data-band", "medium");

    rerender(<BandBadge band="strong" />);
    expect(screen.getByText("Strong")).toHaveAttribute("data-band", "strong");
  });
});
