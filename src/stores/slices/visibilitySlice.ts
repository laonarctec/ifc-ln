import type { StateCreator } from "zustand";
import { createModelEntityKey, type ModelEntityKey } from "@/utils/modelEntity";

export interface TypeVisibility {
  spaces: boolean;
  openings: boolean;
  site: boolean;
}

export interface VisibilitySlice {
  hiddenEntityKeys: Set<ModelEntityKey>;
  isolatedEntityKeys: Set<ModelEntityKey> | null;
  typeVisibility: TypeVisibility;
  activeTypeToggles: Set<string>;
  hideEntity: (entityId: number, modelId?: number | null) => void;
  showEntity: (entityId: number, modelId?: number | null) => void;
  isolateEntity: (
    entityId: number,
    allEntityIds: number[],
    modelId?: number | null,
  ) => void;
  isolateEntities: (
    entityIds: number[],
    allEntityIds: number[],
    modelId?: number | null,
  ) => void;
  setIsolation: (ids: number[], modelId?: number | null) => void;
  clearIsolation: () => void;
  resetHiddenEntities: (modelId?: number | null) => void;
  toggleTypeVisibility: (type: keyof TypeVisibility) => void;
  toggleIfcTypeFilter: (type: string) => void;
  clearIfcTypeFilters: () => void;
}

function resolveModelId(
  modelId: number | null | undefined,
  state: { currentModelId: number | null },
) {
  return modelId ?? state.currentModelId;
}

function buildEntityKeys(modelId: number, entityIds: number[]) {
  return entityIds.map((entityId) => createModelEntityKey(modelId, entityId));
}

export const createVisibilitySlice: StateCreator<
  VisibilitySlice & { currentModelId: number | null },
  [],
  [],
  VisibilitySlice
> = (set) => ({
  hiddenEntityKeys: new Set<ModelEntityKey>(),
  isolatedEntityKeys: null,
  typeVisibility: { spaces: true, openings: true, site: true },
  activeTypeToggles: new Set<string>(),
  hideEntity: (entityId, modelId) =>
    set((state) => {
      const resolvedModelId = resolveModelId(modelId, state);
      if (resolvedModelId === null) {
        return {};
      }

      const next = new Set(state.hiddenEntityKeys);
      next.add(createModelEntityKey(resolvedModelId, entityId));
      return { hiddenEntityKeys: next };
    }),
  showEntity: (entityId, modelId) =>
    set((state) => {
      const resolvedModelId = resolveModelId(modelId, state);
      if (resolvedModelId === null) {
        return {};
      }

      const next = new Set(state.hiddenEntityKeys);
      next.delete(createModelEntityKey(resolvedModelId, entityId));
      return { hiddenEntityKeys: next };
    }),
  isolateEntity: (entityId, allEntityIds, modelId) =>
    set((state) => {
      const resolvedModelId = resolveModelId(modelId, state);
      if (resolvedModelId === null) {
        return {};
      }

      return {
        hiddenEntityKeys: new Set(
          buildEntityKeys(
            resolvedModelId,
            allEntityIds.filter((candidateId) => candidateId !== entityId),
          ),
        ),
        isolatedEntityKeys: new Set([
          createModelEntityKey(resolvedModelId, entityId),
        ]),
      };
    }),
  isolateEntities: (entityIds, allEntityIds, modelId) =>
    set((state) => {
      const resolvedModelId = resolveModelId(modelId, state);
      if (resolvedModelId === null) {
        return {};
      }

      const visibleKeys = new Set(buildEntityKeys(resolvedModelId, entityIds));
      return {
        hiddenEntityKeys: new Set(
          buildEntityKeys(
            resolvedModelId,
            allEntityIds.filter(
              (candidateId) =>
                !visibleKeys.has(
                  createModelEntityKey(resolvedModelId, candidateId),
                ),
            ),
          ),
        ),
        isolatedEntityKeys: visibleKeys,
      };
    }),
  setIsolation: (ids, modelId) =>
    set((state) => {
      const resolvedModelId = resolveModelId(modelId, state);
      if (resolvedModelId === null) {
        return {};
      }

      const idsSet = new Set(buildEntityKeys(resolvedModelId, ids));
      const nextHidden = new Set(state.hiddenEntityKeys);
      idsSet.forEach((id) => nextHidden.delete(id));
      return { isolatedEntityKeys: idsSet, hiddenEntityKeys: nextHidden };
    }),
  clearIsolation: () => set({ isolatedEntityKeys: null }),
  resetHiddenEntities: (modelId) =>
    set((state) => {
      const resolvedModelId = resolveModelId(modelId, state);
      if (resolvedModelId === null) {
        return {
          hiddenEntityKeys: new Set<ModelEntityKey>(),
          isolatedEntityKeys: null,
        };
      }

      const prefix = `${resolvedModelId}:`;
      const nextHidden = new Set<ModelEntityKey>();
      state.hiddenEntityKeys.forEach((key) => {
        if (!key.startsWith(prefix)) {
          nextHidden.add(key);
        }
      });

      const nextIsolation =
        state.isolatedEntityKeys === null
          ? null
          : new Set(
              [...state.isolatedEntityKeys].filter(
                (key) => !key.startsWith(prefix),
              ),
            );

      return {
        hiddenEntityKeys: nextHidden,
        isolatedEntityKeys:
          nextIsolation && nextIsolation.size > 0 ? nextIsolation : null,
      };
    }),
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
