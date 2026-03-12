import type { StateCreator } from 'zustand';

export interface SelectionSlice {
  selectedEntityId: number | null;
  selectedEntityIds: number[];
  setSelectedEntityId: (selectedEntityId: number | null) => void;
  setSelectedEntityIds: (selectedEntityIds: number[]) => void;
  toggleSelectedEntityId: (selectedEntityId: number) => void;
  clearSelection: () => void;
}

function dedupeEntityIds(entityIds: number[]) {
  return [...new Set(entityIds)];
}

export const createSelectionSlice: StateCreator<SelectionSlice, [], [], SelectionSlice> = (set) => ({
  selectedEntityId: null,
  selectedEntityIds: [],
  setSelectedEntityId: (selectedEntityId) =>
    set({
      selectedEntityId,
      selectedEntityIds: selectedEntityId === null ? [] : [selectedEntityId],
    }),
  setSelectedEntityIds: (selectedEntityIds) => {
    const deduped = dedupeEntityIds(selectedEntityIds);
    set({
      selectedEntityId: deduped.length > 0 ? deduped[deduped.length - 1] : null,
      selectedEntityIds: deduped,
    });
  },
  toggleSelectedEntityId: (selectedEntityId) =>
    set((state) => {
      const exists = state.selectedEntityIds.includes(selectedEntityId);
      const next = exists
        ? state.selectedEntityIds.filter((entityId) => entityId !== selectedEntityId)
        : [...state.selectedEntityIds, selectedEntityId];

      return {
        selectedEntityId: next.length > 0 ? next[next.length - 1] : null,
        selectedEntityIds: next,
      };
    }),
  clearSelection: () => set({ selectedEntityId: null, selectedEntityIds: [] }),
});
