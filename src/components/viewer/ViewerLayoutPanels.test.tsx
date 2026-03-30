import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomPanelContent, RightPanelContent } from "./ViewerLayoutPanels";

vi.mock("./PropertiesPanel", () => ({
  PropertiesPanel: () => <div data-testid="properties-panel">properties</div>,
}));

vi.mock("./BCFPanel", () => ({
  BCFPanel: () => <div data-testid="bcf-panel">bcf</div>,
}));

vi.mock("./IDSPanel", () => ({
  IDSPanel: () => <div data-testid="ids-panel">ids</div>,
}));

vi.mock("./LensPanel", () => ({
  LensPanel: () => <div data-testid="lens-panel">lens</div>,
}));

vi.mock("./lists/ListPanel", () => ({
  ListPanel: () => <div data-testid="list-panel">list</div>,
}));

vi.mock("./ScriptPanel", () => ({
  ScriptPanel: () => <div data-testid="script-panel">script</div>,
}));

describe("ViewerLayoutPanels", () => {
  it("renders the properties panel by default", () => {
    render(<RightPanelContent mode="properties" />);

    expect(screen.getByTestId("properties-panel")).toBeTruthy();
  });

  it("renders lazy right panels for non-default modes", async () => {
    const { rerender } = render(<RightPanelContent mode="bcf" />);
    expect(await screen.findByTestId("bcf-panel")).toBeTruthy();

    rerender(<RightPanelContent mode="ids" />);
    expect(await screen.findByTestId("ids-panel")).toBeTruthy();

    rerender(<RightPanelContent mode="lens" />);
    expect(await screen.findByTestId("lens-panel")).toBeTruthy();
  });

  it("renders bottom panels only for active bottom modes", async () => {
    const { container, rerender } = render(<BottomPanelContent mode="none" />);
    expect(container.childElementCount).toBe(0);

    rerender(<BottomPanelContent mode="list" />);
    expect(await screen.findByTestId("list-panel")).toBeTruthy();

    rerender(<BottomPanelContent mode="script" />);
    expect(await screen.findByTestId("script-panel")).toBeTruthy();
  });
});
