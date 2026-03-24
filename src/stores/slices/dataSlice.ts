import type { StateCreator } from "zustand";
import type {
  IfcElementProperties,
  IfcSpatialNode,
  IfcTypeTreeGroup,
  PropertySectionKind,
} from "@/types/worker-messages";

const emptyProperties: IfcElementProperties = {
  expressID: null,
  globalId: null,
  ifcType: null,
  name: null,
  loadedSections: [],
  attributes: [],
  propertySets: [],
  quantitySets: [],
  typeProperties: [],
  materials: [],
  documents: [],
  classifications: [],
  metadata: [],
  relations: [],
  inverseRelations: [],
};

export interface LoadedViewerModel {
  fileName: string;
  modelId: number;
  schema: string;
  maxExpressId: number;
  geometryReady: boolean;
  geometryMeshCount: number;
  geometryVertexCount: number;
  geometryIndexCount: number;
  spatialTree: IfcSpatialNode[];
  typeTree: IfcTypeTreeGroup[];
  visible: boolean;
}

function resolveActiveModel(
  models: LoadedViewerModel[],
  activeModelId: number | null,
) {
  if (models.length === 0) {
    return null;
  }

  if (activeModelId !== null) {
    const exact = models.find((model) => model.modelId === activeModelId);
    if (exact) {
      return exact;
    }
  }

  return models[models.length - 1] ?? null;
}

function buildDerivedState(
  models: LoadedViewerModel[],
  activeModelId: number | null,
) {
  const activeModel = resolveActiveModel(models, activeModelId);

  return {
    loadedModels: models,
    activeModelId: activeModel?.modelId ?? null,
    currentFileName: activeModel?.fileName ?? null,
    currentModelId: activeModel?.modelId ?? null,
    currentModelSchema: activeModel?.schema ?? null,
    currentModelMaxExpressId: activeModel?.maxExpressId ?? null,
    geometryReady: models.some((model) => model.geometryReady),
    geometryMeshCount: models.reduce(
      (sum, model) => sum + model.geometryMeshCount,
      0,
    ),
    geometryVertexCount: models.reduce(
      (sum, model) => sum + model.geometryVertexCount,
      0,
    ),
    geometryIndexCount: models.reduce(
      (sum, model) => sum + model.geometryIndexCount,
      0,
    ),
    spatialTree: activeModel?.spatialTree ?? [],
    typeTree: activeModel?.typeTree ?? [],
  };
}

function updateModelCollection(
  models: LoadedViewerModel[],
  modelId: number,
  updater: (model: LoadedViewerModel) => LoadedViewerModel,
) {
  return models.map((model) => (model.modelId === modelId ? updater(model) : model));
}

function createModelRecord({
  fileName,
  modelId,
  schema,
  maxExpressId,
}: {
  fileName: string;
  modelId: number;
  schema: string;
  maxExpressId: number;
}): LoadedViewerModel {
  return {
    fileName,
    modelId,
    schema,
    maxExpressId,
    geometryReady: false,
    geometryMeshCount: 0,
    geometryVertexCount: 0,
    geometryIndexCount: 0,
    spatialTree: [],
    typeTree: [],
    visible: true,
  };
}

export interface DataSlice {
  loadedModels: LoadedViewerModel[];
  activeModelId: number | null;
  currentFileName: string | null;
  currentModelId: number | null;
  currentModelSchema: string | null;
  currentModelMaxExpressId: number | null;
  geometryReady: boolean;
  geometryMeshCount: number;
  geometryVertexCount: number;
  geometryIndexCount: number;
  frameRate: number | null;
  spatialTree: IfcSpatialNode[];
  typeTree: IfcTypeTreeGroup[];
  activeClassFilter: string | null;
  activeTypeFilter: string | null;
  activeStoreyFilter: number | null;
  selectedProperties: IfcElementProperties;
  propertiesLoading: boolean;
  propertiesError: string | null;
  propertiesLoadingSections: PropertySectionKind[];
  viewerError: string | null;
  engineState: "idle" | "initializing" | "ready" | "error";
  engineMessage: string;
  addLoadedModel: (input: {
    fileName: string;
    modelId: number;
    schema: string;
    maxExpressId: number;
  }) => void;
  removeLoadedModel: (modelId: number) => void;
  clearLoadedModels: () => void;
  setActiveModelId: (modelId: number | null) => void;
  setCurrentFileName: (currentFileName: string | null) => void;
  setCurrentModelInfo: (
    modelId: number,
    schema: string,
    maxExpressId: number,
  ) => void;
  clearCurrentModelInfo: () => void;
  setGeometryReady: (geometryReady: boolean) => void;
  setGeometrySummary: (
    meshCount: number,
    vertexCount: number,
    indexCount: number,
  ) => void;
  resetGeometrySummary: () => void;
  setSpatialTree: (spatialTree: IfcSpatialNode[]) => void;
  clearSpatialTree: () => void;
  setTypeTree: (typeTree: IfcTypeTreeGroup[]) => void;
  clearTypeTree: () => void;
  setModelVisibility: (modelId: number, visible: boolean) => void;
  setActiveClassFilter: (activeClassFilter: string | null) => void;
  setActiveTypeFilter: (activeTypeFilter: string | null) => void;
  setActiveStoreyFilter: (activeStoreyFilter: number | null) => void;
  resetFilters: () => void;
  setSelectedProperties: (selectedProperties: IfcElementProperties) => void;
  mergeSelectedProperties: (selectedProperties: IfcElementProperties) => void;
  clearSelectedProperties: () => void;
  setPropertiesState: (
    propertiesLoading: boolean,
    propertiesError?: string | null,
    propertiesLoadingSections?: PropertySectionKind[],
  ) => void;
  setViewerError: (viewerError: string | null) => void;
  clearViewerError: () => void;
  setEngineState: (
    engineState: DataSlice["engineState"],
    engineMessage: string,
  ) => void;
}

const initialDerivedState = buildDerivedState([], null);

export const createDataSlice: StateCreator<DataSlice, [], [], DataSlice> = (
  set,
  get,
) => ({
  ...initialDerivedState,
  frameRate: null,
  activeClassFilter: null,
  activeTypeFilter: null,
  activeStoreyFilter: null,
  selectedProperties: emptyProperties,
  propertiesLoading: false,
  propertiesError: null,
  propertiesLoadingSections: [],
  viewerError: null,
  engineState: "idle",
  engineMessage: "엔진 초기화 전",
  addLoadedModel: ({ fileName, modelId, schema, maxExpressId }) =>
    set((state) => {
      const withoutModel = state.loadedModels.filter(
        (model) => model.modelId !== modelId,
      );
      const nextModels = [
        ...withoutModel,
        createModelRecord({ fileName, modelId, schema, maxExpressId }),
      ];
      return {
        ...buildDerivedState(nextModels, modelId),
      };
    }),
  removeLoadedModel: (modelId) =>
    set((state) => {
      const nextModels = state.loadedModels.filter(
        (model) => model.modelId !== modelId,
      );
      const nextActiveModelId =
        state.activeModelId === modelId ? null : state.activeModelId;
      return {
        ...buildDerivedState(nextModels, nextActiveModelId),
      };
    }),
  clearLoadedModels: () =>
    set({
      ...buildDerivedState([], null),
    }),
  setActiveModelId: (modelId) =>
    set((state) => ({
      ...buildDerivedState(state.loadedModels, modelId),
      activeClassFilter: null,
      activeTypeFilter: null,
      activeStoreyFilter: null,
    })),
  setCurrentFileName: (currentFileName) =>
    set((state) => {
      if (state.currentModelId === null || currentFileName === null) {
        return { currentFileName };
      }

      const nextModels = updateModelCollection(
        state.loadedModels,
        state.currentModelId,
        (model) => ({ ...model, fileName: currentFileName }),
      );
      return {
        ...buildDerivedState(nextModels, state.activeModelId),
      };
    }),
  setCurrentModelInfo: (
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
  ) =>
    set((state) => {
      const currentFileName =
        state.currentFileName ?? `Model ${currentModelId}`;
      const exists = state.loadedModels.some(
        (model) => model.modelId === currentModelId,
      );
      const nextModels = exists
        ? updateModelCollection(state.loadedModels, currentModelId, (model) => ({
            ...model,
            schema: currentModelSchema,
            maxExpressId: currentModelMaxExpressId,
            fileName: model.fileName || currentFileName,
          }))
        : [
            ...state.loadedModels,
            createModelRecord({
              fileName: currentFileName,
              modelId: currentModelId,
              schema: currentModelSchema,
              maxExpressId: currentModelMaxExpressId,
            }),
          ];

      return {
        ...buildDerivedState(nextModels, currentModelId),
      };
    }),
  clearCurrentModelInfo: () =>
    set((state) => {
      if (state.currentModelId === null) {
        return {
          ...buildDerivedState(state.loadedModels, state.activeModelId),
        };
      }

      const nextModels = state.loadedModels.filter(
        (model) => model.modelId !== state.currentModelId,
      );
      return {
        ...buildDerivedState(nextModels, state.activeModelId),
      };
    }),
  setGeometryReady: (geometryReady) =>
    set((state) => {
      if (state.currentModelId === null) {
        return { geometryReady };
      }

      const nextModels = updateModelCollection(
        state.loadedModels,
        state.currentModelId,
        (model) => ({ ...model, geometryReady }),
      );
      return {
        ...buildDerivedState(nextModels, state.activeModelId),
      };
    }),
  setGeometrySummary: (
    geometryMeshCount,
    geometryVertexCount,
    geometryIndexCount,
  ) =>
    set((state) => {
      if (state.currentModelId === null) {
        return { geometryMeshCount, geometryVertexCount, geometryIndexCount };
      }

      const nextModels = updateModelCollection(
        state.loadedModels,
        state.currentModelId,
        (model) => ({
          ...model,
          geometryMeshCount,
          geometryVertexCount,
          geometryIndexCount,
        }),
      );
      return {
        ...buildDerivedState(nextModels, state.activeModelId),
      };
    }),
  resetGeometrySummary: () =>
    set((state) => {
      if (state.currentModelId === null) {
        return {
          geometryMeshCount: 0,
          geometryVertexCount: 0,
          geometryIndexCount: 0,
        };
      }

      const nextModels = updateModelCollection(
        state.loadedModels,
        state.currentModelId,
        (model) => ({
          ...model,
          geometryMeshCount: 0,
          geometryVertexCount: 0,
          geometryIndexCount: 0,
          geometryReady: false,
        }),
      );
      return {
        ...buildDerivedState(nextModels, state.activeModelId),
      };
    }),
  setSpatialTree: (spatialTree) =>
    set((state) => {
      if (state.currentModelId === null) {
        return { spatialTree };
      }

      const nextModels = updateModelCollection(
        state.loadedModels,
        state.currentModelId,
        (model) => ({ ...model, spatialTree }),
      );
      return {
        ...buildDerivedState(nextModels, state.activeModelId),
      };
    }),
  clearSpatialTree: () =>
    set((state) => {
      if (state.currentModelId === null) {
        return { spatialTree: [] };
      }

      const nextModels = updateModelCollection(
        state.loadedModels,
        state.currentModelId,
        (model) => ({ ...model, spatialTree: [] }),
      );
      return {
        ...buildDerivedState(nextModels, state.activeModelId),
      };
    }),
  setTypeTree: (typeTree) =>
    set((state) => {
      if (state.currentModelId === null) {
        return { typeTree };
      }

      const nextModels = updateModelCollection(
        state.loadedModels,
        state.currentModelId,
        (model) => ({ ...model, typeTree }),
      );
      return {
        ...buildDerivedState(nextModels, state.activeModelId),
      };
    }),
  clearTypeTree: () =>
    set((state) => {
      if (state.currentModelId === null) {
        return { typeTree: [] };
      }

      const nextModels = updateModelCollection(
        state.loadedModels,
        state.currentModelId,
        (model) => ({ ...model, typeTree: [] }),
      );
      return {
        ...buildDerivedState(nextModels, state.activeModelId),
      };
    }),
  setModelVisibility: (modelId, visible) =>
    set((state) => ({
      loadedModels: updateModelCollection(state.loadedModels, modelId, (model) => ({
        ...model,
        visible,
      })),
    })),
  setActiveClassFilter: (activeClassFilter) => set({ activeClassFilter }),
  setActiveTypeFilter: (activeTypeFilter) => set({ activeTypeFilter }),
  setActiveStoreyFilter: (activeStoreyFilter) => set({ activeStoreyFilter }),
  resetFilters: () =>
    set({
      activeClassFilter: null,
      activeTypeFilter: null,
      activeStoreyFilter: null,
    }),
  setSelectedProperties: (selectedProperties) =>
    set({
      selectedProperties,
      propertiesLoading: false,
      propertiesError: null,
      propertiesLoadingSections: [],
    }),
  mergeSelectedProperties: (selectedProperties) =>
    set((state) => ({
      selectedProperties: {
        ...state.selectedProperties,
        ...selectedProperties,
        loadedSections: [
          ...new Set([
            ...state.selectedProperties.loadedSections,
            ...selectedProperties.loadedSections,
          ]),
        ],
      },
      propertiesLoading: false,
      propertiesError: null,
      propertiesLoadingSections: [],
    })),
  clearSelectedProperties: () =>
    set({
      selectedProperties: emptyProperties,
      propertiesLoading: false,
      propertiesError: null,
      propertiesLoadingSections: [],
    }),
  setPropertiesState: (
    propertiesLoading,
    propertiesError = null,
    propertiesLoadingSections = [],
  ) => set({ propertiesLoading, propertiesError, propertiesLoadingSections }),
  setViewerError: (viewerError) => set({ viewerError }),
  clearViewerError: () => set({ viewerError: null }),
  setEngineState: (engineState, engineMessage) =>
    set({ engineState, engineMessage }),
});
