import type { StateCreator } from "zustand";

export interface SelectionSlice {
  selectedModelId: number | null;
  selectedEntityId: number | null;
  selectedEntityIds: number[];
  setSelectedEntity: (
    modelId: number | null,
    expressId: number | null,
    additive?: boolean,
  ) => void;
  setSelectedEntities: (modelId: number | null, expressIds: number[]) => void;
  setSelectedEntityId: (selectedEntityId: number | null) => void;
  setSelectedEntityIds: (selectedEntityIds: number[]) => void;
  toggleSelectedEntityId: (selectedEntityId: number) => void;
  clearSelection: () => void;
}

function dedupeEntityIds(entityIds: number[]) {
  return [...new Set(entityIds)];
}

function buildSelectionState(
  modelId: number | null,
  entityIds: number[],
) {
  const deduped = dedupeEntityIds(entityIds);
  return {
    selectedModelId: modelId,
    selectedEntityId: deduped.length > 0 ? deduped[deduped.length - 1] : null,
    selectedEntityIds: deduped,
  };
}

export const createSelectionSlice: StateCreator<
  SelectionSlice & { currentModelId: number | null },
  [],
  [],
  SelectionSlice
> = (set, get) => ({
  selectedModelId: null,
  selectedEntityId: null,
  selectedEntityIds: [],
  setSelectedEntity: (modelId, expressId, additive = false) =>
    set((state) => {
      if (expressId === null || modelId === null) {
        return buildSelectionState(null, []);
      }

      if (!additive || state.selectedModelId !== modelId) {
        return buildSelectionState(modelId, [expressId]);
      }

      const exists = state.selectedEntityIds.includes(expressId);
      const next = exists
        ? state.selectedEntityIds.filter((entityId) => entityId !== expressId)
        : [...state.selectedEntityIds, expressId];

      return buildSelectionState(modelId, next);
    }),
  setSelectedEntities: (modelId, expressIds) =>
    set(buildSelectionState(modelId, modelId === null ? [] : expressIds)),
  setSelectedEntityId: (selectedEntityId) =>
    set((state) =>
      buildSelectionState(
        state.selectedModelId ?? state.currentModelId,
        selectedEntityId === null ? [] : [selectedEntityId],
      ),
    ),
  setSelectedEntityIds: (selectedEntityIds) =>
    set((state) =>
      buildSelectionState(
        state.selectedModelId ?? state.currentModelId,
        selectedEntityIds,
      ),
    ),
  toggleSelectedEntityId: (selectedEntityId) =>
    set((state) => {
      const exists = state.selectedEntityIds.includes(selectedEntityId);
      const next = exists
        ? state.selectedEntityIds.filter((entityId) => entityId !== selectedEntityId)
        : [...state.selectedEntityIds, selectedEntityId];

      return buildSelectionState(
        state.selectedModelId ?? state.currentModelId,
        next,
      );
    }),
  clearSelection: () => set(buildSelectionState(null, [])),
});
