import { describe, expect, it } from "vitest";
import { create } from "zustand";
import { createSelectionSlice, type SelectionSlice } from "./selectionSlice";

type SelectionStore = SelectionSlice & { currentModelId: number | null };

function createSelectionStore() {
  return create<SelectionStore>()((...args) => ({
    currentModelId: 1,
    ...createSelectionSlice(...args),
  }));
}

describe("selectionSlice", () => {
  it("adds shift-selected entities to the existing selection", () => {
    const store = createSelectionStore();

    store.getState().setSelectedEntity(1, 101);
    store.getState().setSelectedEntity(1, 102, true);

    expect(store.getState().selectedEntityIds).toEqual([101, 102]);
    expect(store.getState().selectedEntityId).toBe(102);
  });

  it("does not remove an entity when shift-selecting it again", () => {
    const store = createSelectionStore();

    store.getState().setSelectedEntity(1, 101);
    store.getState().setSelectedEntity(1, 102, true);
    store.getState().setSelectedEntity(1, 101, true);

    expect(store.getState().selectedEntityIds).toEqual([101, 102]);
    expect(store.getState().selectedEntityId).toBe(102);
  });
});
