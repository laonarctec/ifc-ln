import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PanelCard } from "./PanelCard";

describe("PanelCard", () => {
  it("renders header content and children", () => {
    render(
      <PanelCard title="Panel" description="Description" actions={<button>Act</button>}>
        <div>Body</div>
      </PanelCard>,
    );

    expect(screen.getByText("Panel")).toBeTruthy();
    expect(screen.getByText("Description")).toBeTruthy();
    expect(screen.getByText("Act")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
  });
});
