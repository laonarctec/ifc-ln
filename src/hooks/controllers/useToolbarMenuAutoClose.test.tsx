import { cleanup, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useToolbarMenuAutoClose } from "./useToolbarMenuAutoClose";

function TestHarness() {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  useToolbarMenuAutoClose(toolbarRef);

  return (
    <div>
      <div ref={toolbarRef}>
        <details open data-testid="inside-details">
          <summary>inside</summary>
          <button type="button">inside button</button>
        </details>
      </div>
      <button type="button" data-testid="outside-button">
        outside
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe("useToolbarMenuAutoClose", () => {
  it("keeps toolbar menus open when the pointer stays inside the menu", () => {
    const { getByTestId, getByText } = render(<TestHarness />);
    const details = getByTestId("inside-details");

    fireEvent.pointerDown(getByText("inside button"));

    expect(details.hasAttribute("open")).toBe(true);
  });

  it("closes open toolbar menus when the pointer moves outside the toolbar", () => {
    const { getByTestId } = render(<TestHarness />);
    const details = getByTestId("inside-details");

    fireEvent.pointerDown(getByTestId("outside-button"));

    expect(details.hasAttribute("open")).toBe(false);
  });
});
