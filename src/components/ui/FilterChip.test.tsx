import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterChip } from "./FilterChip";

describe("FilterChip", () => {
  it("renders active styling and handles clicks", () => {
    const handleClick = vi.fn();

    render(
      <FilterChip active onClick={handleClick}>
        Active filter
      </FilterChip>,
    );

    const button = screen.getByRole("button", { name: "Active filter" });
    fireEvent.click(button);

    expect(button.className).toContain("filter-chip-ui-active");
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
