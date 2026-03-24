import { describe, expect, it } from "vitest";
import { create } from "zustand";
import { createToolsSlice, type ToolsSlice } from "./toolsSlice";

function createToolsStore() {
  return create<ToolsSlice>()((...args) => ({
    ...createToolsSlice(...args),
  }));
}

describe("toolsSlice", () => {
  it("places and clears a single distance measurement", () => {
    const store = createToolsStore();

    store.getState().toggleMeasurementMode();
    expect(store.getState().interactionMode).toBe("measure-distance");
    expect(store.getState().measurement.mode).toBe("placing-first");

    store.getState().placeMeasurementPoint({ expressId: 1, point: [0, 0, 0] });
    expect(store.getState().measurement.mode).toBe("placing-second");

    store.getState().placeMeasurementPoint({ expressId: 2, point: [3, 4, 0] });
    expect(store.getState().measurement.mode).toBe("complete");
    expect(store.getState().measurement.distance).toBeCloseTo(5);

    store.getState().clearMeasurement();
    expect(store.getState().measurement.mode).toBe("placing-first");
    expect(store.getState().measurement.distance).toBeNull();
  });
});
