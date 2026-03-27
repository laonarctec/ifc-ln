import { describe, expect, it } from "vitest";
import { create } from "zustand";
import { createClippingSlice, type ClippingSlice } from "./clippingSlice";

function createClippingStore() {
  return create<ClippingSlice>()((...args) => ({
    ...createClippingSlice(...args),
  }));
}

describe("clippingSlice", () => {
  it("creates and manages multiple clipping planes", () => {
    const store = createClippingStore();

    store.getState().startCreateClippingPlane();
    expect(store.getState().clipping.mode).toBe("creating");

    store.getState().updateClippingDraft({
      stage: "second-point",
      anchor: [0, 0, 0],
      origin: [1, 2, 3],
      normal: [0, 0, 1],
      uAxis: [1, 0, 0],
      vAxis: [0, 1, 0],
      width: 4,
      height: 5,
    });
    store.getState().commitClippingDraft();

    expect(store.getState().clipping.planes).toHaveLength(1);
    expect(store.getState().clipping.activePlaneId).toBe("clipping-plane-1");
    expect(store.getState().clipping.planes[0]?.selected).toBe(true);

    store.getState().renameClippingPlane("clipping-plane-1", "Section A");
    store.getState().flipClippingPlane("clipping-plane-1");
    store.getState().toggleClippingPlaneEnabled("clipping-plane-1");
    store.getState().toggleClippingPlaneLocked("clipping-plane-1");

    const firstPlane = store.getState().clipping.planes[0];
    expect(firstPlane?.name).toBe("Section A");
    expect(firstPlane?.flipped).toBe(true);
    expect(firstPlane?.enabled).toBe(false);
    expect(firstPlane?.locked).toBe(true);

    store.getState().startCreateClippingPlane();
    store.getState().updateClippingDraft({
      stage: "second-point",
      anchor: [0, 0, 0],
      origin: [10, 0, 0],
      normal: [1, 0, 0],
      uAxis: [0, 1, 0],
      vAxis: [0, 0, 1],
      width: 2,
      height: 3,
    });
    store.getState().commitClippingDraft();

    expect(store.getState().clipping.planes).toHaveLength(2);
    expect(store.getState().clipping.activePlaneId).toBe("clipping-plane-2");

    store.getState().selectClippingPlane("clipping-plane-1");
    expect(store.getState().clipping.planes[0]?.selected).toBe(true);
    expect(store.getState().clipping.planes[1]?.selected).toBe(false);

    store.getState().deleteClippingPlane("clipping-plane-1");
    expect(store.getState().clipping.planes).toHaveLength(1);
    expect(store.getState().clipping.activePlaneId).toBe("clipping-plane-2");

    store.getState().clearClippingPlanes();
    expect(store.getState().clipping.planes).toHaveLength(0);
    expect(store.getState().clipping.activePlaneId).toBeNull();
  });
});
