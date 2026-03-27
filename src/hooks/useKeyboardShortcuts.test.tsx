import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeasurementMode } from "@/stores/slices/toolsSlice";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

const state = {
  selectedEntityIds: [] as number[],
  measurement: {
    mode: "idle" as MeasurementMode,
  },
  toggleMeasurementMode: vi.fn(),
  clearMeasurement: vi.fn(),
  clearSelection: vi.fn(),
  hideEntity: vi.fn(),
  isolateEntities: vi.fn(),
  resetHiddenEntities: vi.fn(),
  runViewportCommand: vi.fn(),
  currentModelId: 7,
};

vi.mock("@/services/viewportGeometryStore", () => ({
  useViewportGeometry: () => ({
    combinedManifest: {
      chunks: [{ entityIds: [1, 2] }],
    },
  }),
}));

vi.mock("@/stores", () => ({
  useViewerStore: {
    getState: () => state,
  },
}));

function TestHarness() {
  useKeyboardShortcuts();
  return null;
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    state.selectedEntityIds = [];
    state.measurement.mode = "idle";
    state.toggleMeasurementMode.mockReset();
    state.clearMeasurement.mockReset();
    state.clearSelection.mockReset();
    state.hideEntity.mockReset();
    state.isolateEntities.mockReset();
    state.resetHiddenEntities.mockReset();
    state.runViewportCommand.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("toggles measure mode with M", () => {
    render(<TestHarness />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    expect(state.toggleMeasurementMode).toHaveBeenCalled();
  });

  it("clears measurement before clearing selection on Escape", () => {
    state.measurement.mode = "complete";
    render(<TestHarness />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(state.clearMeasurement).toHaveBeenCalled();
    expect(state.clearSelection).not.toHaveBeenCalled();
  });
});
