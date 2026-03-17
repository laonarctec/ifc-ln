import type { StateCreator } from "zustand";

export interface TypeVisibility {
    spaces: boolean;
    openings: boolean;
    site: boolean;
}

export interface VisibilitySlice {
    hiddenEntityIds: Set<number>;
    typeVisibility: TypeVisibility;
    hideEntity: (entityId: number) => void;
    showEntity: (entityId: number) => void;
    isolateEntity: (entityId: number, allEntityIds: number[]) => void;
    isolateEntities: (entityIds: number[], allEntityIds: number[]) => void;
    resetHiddenEntities: () => void;
    toggleTypeVisibility: (type: keyof TypeVisibility) => void;
}

export const createVisibilitySlice: StateCreator<
    VisibilitySlice,
    [],
    [],
    VisibilitySlice
> = (set) => ({
    hiddenEntityIds: new Set<number>(),
    typeVisibility: { spaces: true, openings: true, site: true },
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
            hiddenEntityIds: new Set(
                allEntityIds.filter((candidateId) => candidateId !== entityId),
            ),
        }),
    isolateEntities: (entityIds, allEntityIds) => {
        const visibleIds = new Set(entityIds);
        set({
            hiddenEntityIds: new Set(
                allEntityIds.filter(
                    (candidateId) => !visibleIds.has(candidateId),
                ),
            ),
        });
    },
    resetHiddenEntities: () => set({ hiddenEntityIds: new Set<number>() }),
    toggleTypeVisibility: (type) =>
        set((state) => ({
            typeVisibility: {
                ...state.typeVisibility,
                [type]: !state.typeVisibility[type],
            },
        })),
});
