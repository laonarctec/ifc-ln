import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { PanelSegmentedControl } from "./PanelSegmentedControl";

function TestHarness() {
  const [value, setValue] = useState<"spatial" | "class" | "type">("spatial");

  return (
    <PanelSegmentedControl
      ariaLabel="Hierarchy mode"
      value={value}
      onChange={setValue}
      options={[
        {
          value: "spatial",
          label: "Spatial",
          icon: <span>S</span>,
        },
        {
          value: "class",
          label: "Class",
          icon: <span>C</span>,
        },
        {
          value: "type",
          label: "Type",
          icon: <span>T</span>,
        },
      ]}
    />
  );
}

describe("PanelSegmentedControl", () => {
  afterEach(() => {
    cleanup();
  });

  it("changes selection on click", async () => {
    const user = userEvent.setup();

    render(<TestHarness />);

    const spatial = screen.getByRole("radio", { name: "Spatial" });
    const type = screen.getByRole("radio", { name: "Type" });

    expect(spatial.getAttribute("aria-checked")).toBe("true");
    expect(type.getAttribute("aria-checked")).toBe("false");

    await user.click(type);

    expect(type.getAttribute("aria-checked")).toBe("true");
    expect(spatial.getAttribute("aria-checked")).toBe("false");
  });

  it("keeps only the selected option tabbable", () => {
    render(<TestHarness />);

    expect(screen.getByRole("radio", { name: "Spatial" }).tabIndex).toBe(0);
    expect(screen.getByRole("radio", { name: "Class" }).tabIndex).toBe(-1);
    expect(screen.getByRole("radio", { name: "Type" }).tabIndex).toBe(-1);
  });

  it("updates selection and focus with arrow keys", async () => {
    const user = userEvent.setup();

    render(<TestHarness />);

    const spatial = screen.getByRole("radio", { name: "Spatial" });
    await user.tab();
    expect(document.activeElement).toBe(spatial);

    await user.keyboard("{ArrowRight}");
    const classOption = screen.getByRole("radio", { name: "Class" });
    expect(classOption.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(classOption);

    await user.keyboard("{ArrowLeft}");
    expect(spatial.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(spatial);
  });

  it("supports Home and End navigation", async () => {
    const user = userEvent.setup();

    render(<TestHarness />);

    await user.tab();
    await user.keyboard("{End}");

    const type = screen.getByRole("radio", { name: "Type" });
    expect(type.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(type);

    await user.keyboard("{Home}");
    const spatial = screen.getByRole("radio", { name: "Spatial" });
    expect(spatial.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(spatial);
  });

  it("selects the focused option with Space and Enter", async () => {
    const user = userEvent.setup();

    render(<TestHarness />);

    const classOption = screen.getByRole("radio", { name: "Class" });
    classOption.focus();
    await user.keyboard("{Enter}");
    expect(classOption.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(classOption);

    const type = screen.getByRole("radio", { name: "Type" });
    type.focus();
    await user.keyboard(" ");
    expect(type.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(type);
  });
});
