import type { StateCreator } from "zustand";
import type { IfcPropertyChange } from "@/types/worker-messages";

export interface TrackedIfcChange extends IfcPropertyChange {
  modelId: number;
  originalValue: string;
  currentValue: string;
  updatedAt: string;
}

function getChangeId(modelId: number, change: IfcPropertyChange) {
  return `${modelId}:${change.target.lineExpressId}:${change.target.attributeName}`;
}

export interface ChangesSlice {
  trackedChanges: TrackedIfcChange[];
  upsertTrackedChange: (change: TrackedIfcChange) => void;
  removeTrackedChange: (modelId: number, change: IfcPropertyChange) => void;
  clearModelChanges: (modelId: number) => void;
  clearTrackedChanges: () => void;
}

export const createChangesSlice: StateCreator<
  ChangesSlice,
  [],
  [],
  ChangesSlice
> = (set) => ({
  trackedChanges: [],
  upsertTrackedChange: (change) =>
    set((state) => {
      const existingId = getChangeId(change.modelId, change);
      const nextWithoutExisting = state.trackedChanges.filter(
        (candidate) => getChangeId(candidate.modelId, candidate) !== existingId,
      );

      if (change.originalValue === change.currentValue) {
        return { trackedChanges: nextWithoutExisting };
      }

      return {
        trackedChanges: [...nextWithoutExisting, change].sort((left, right) =>
          left.updatedAt.localeCompare(right.updatedAt),
        ),
      };
    }),
  removeTrackedChange: (modelId, change) =>
    set((state) => ({
      trackedChanges: state.trackedChanges.filter(
        (candidate) => getChangeId(candidate.modelId, candidate) !== getChangeId(modelId, change),
      ),
    })),
  clearModelChanges: (modelId) =>
    set((state) => ({
      trackedChanges: state.trackedChanges.filter(
        (change) => change.modelId !== modelId,
      ),
    })),
  clearTrackedChanges: () => set({ trackedChanges: [] }),
});
