import { fireEvent, render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { FieldControl } from "./FieldControl";

describe("FieldControl", () => {
  it("renders prefix content and forwards input changes", () => {
    const handleChange = vi.fn();

    render(
      <FieldControl
        aria-label="Search field"
        prefix={<Search size={14} />}
        placeholder="Search..."
        onChange={handleChange}
      />,
    );

    const input = screen.getByLabelText("Search field");
    fireEvent.change(input, { target: { value: "wall" } });

    expect(screen.getByPlaceholderText("Search...")).toBeTruthy();
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("renders select mode with options", () => {
    render(
      <FieldControl as="select" aria-label="Mode select" defaultValue="a">
        <option value="a">A</option>
        <option value="b">B</option>
      </FieldControl>,
    );

    expect(screen.getByRole("combobox", { name: "Mode select" })).toBeTruthy();
  });
});
