import type { StateCreator } from "zustand";

export interface TypeVisibility {
    spaces: boolean;
    openings: boolean;
    site: boolean;
}

export interface VisibilitySlice {
    hiddenEntityIds: Set<number>;
    isolatedEntityIds: Set<number> | null;
    typeVisibility: TypeVisibility;
    activeTypeToggles: Set<string>;
    hideEntity: (entityId: number) => void;
    showEntity: (entityId: number) => void;
    isolateEntity: (entityId: number, allEntityIds: number[]) => void;
    isolateEntities: (entityIds: number[], allEntityIds: number[]) => void;
    setIsolation: (ids: number[]) => void;
    clearIsolation: () => void;
    resetHiddenEntities: () => void;
    toggleTypeVisibility: (type: keyof TypeVisibility) => void;
    toggleIfcTypeFilter: (ifcType: string) => void;
    clearIfcTypeFilters: () => void;
}

export const createVisibilitySlice: StateCreator<
    VisibilitySlice,
    [],
    [],
    VisibilitySlice
> = (set) => ({
    hiddenEntityIds: new Set<number>(),
    isolatedEntityIds: null,
    typeVisibility: { spaces: true, openings: true, site: true },
    activeTypeToggles: new Set<string>(),
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
    setIsolation: (ids) =>
        set((state) => {
            const idsSet = new Set(ids);
            // Unhide the isolated entities from manual hidden set
            const nextHidden = new Set(state.hiddenEntityIds);
            ids.forEach((id) => nextHidden.delete(id));
            return { isolatedEntityIds: idsSet, hiddenEntityIds: nextHidden };
        }),
    clearIsolation: () => set({ isolatedEntityIds: null }),
    resetHiddenEntities: () =>
        set({ hiddenEntityIds: new Set<number>(), isolatedEntityIds: null }),
    toggleTypeVisibility: (type) =>
        set((state) => ({
            typeVisibility: {
                ...state.typeVisibility,
                [type]: !state.typeVisibility[type],
            },
        })),
    toggleIfcTypeFilter: (ifcType) =>
        set((state) => {
            const next = new Set(state.activeTypeToggles);
            if (next.has(ifcType)) next.delete(ifcType);
            else next.add(ifcType);
            return { activeTypeToggles: next };
        }),
    clearIfcTypeFilters: () => set({ activeTypeToggles: new Set<string>() }),
});
