import type { StateCreator } from 'zustand';

export interface VisibilitySlice {
  hiddenEntityIds: Set<number>;
  hideEntity: (entityId: number) => void;
  showEntity: (entityId: number) => void;
  isolateEntity: (entityId: number, allEntityIds: number[]) => void;
  resetHiddenEntities: () => void;
}

export const createVisibilitySlice: StateCreator<VisibilitySlice, [], [], VisibilitySlice> = (set) => ({
  hiddenEntityIds: new Set<number>(),
  hideEntity: (entityId) =>
    set((state) => {
      const next = new Set(state.hiddenEntityIds);
      next.add(entityId);
      return { hiddenEntityIds: next };
    }),
  showEntity: (entityId) =>
    set((state) => {
      const next = new Set(state.hiddenEntityIds);
      next.delete(entityId);
      return { hiddenEntityIds: next };
    }),
  isolateEntity: (entityId, allEntityIds) =>
    set({
      hiddenEntityIds: new Set(allEntityIds.filter((candidateId) => candidateId !== entityId)),
    }),
  resetHiddenEntities: () => set({ hiddenEntityIds: new Set<number>() }),
});
