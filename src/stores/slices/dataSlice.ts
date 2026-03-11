import type { StateCreator } from 'zustand';
import type { IfcElementProperties, IfcSpatialNode, IfcTypeTreeGroup } from '@/types/worker-messages';

const emptyProperties: IfcElementProperties = {
  expressID: null,
  globalId: null,
  ifcType: null,
  name: null,
  attributes: [],
  propertySets: [],
  quantitySets: [],
  typeProperties: [],
  materials: [],
  relations: [],
  inverseRelations: [],
};

export interface DataSlice {
  currentFileName: string | null;
  currentModelId: number | null;
  currentModelSchema: string | null;
  currentModelMaxExpressId: number | null;
  geometryReady: boolean;
  geometryMeshCount: number;
  geometryVertexCount: number;
  geometryIndexCount: number;
  spatialTree: IfcSpatialNode[];
  typeTree: IfcTypeTreeGroup[];
  activeClassFilter: string | null;
  activeTypeFilter: string | null;
  activeStoreyFilter: number | null;
  selectedProperties: IfcElementProperties;
  propertiesLoading: boolean;
  propertiesError: string | null;
  viewerError: string | null;
  engineState: 'idle' | 'initializing' | 'ready' | 'error';
  engineMessage: string;
  setCurrentFileName: (currentFileName: string | null) => void;
  setCurrentModelInfo: (modelId: number, schema: string, maxExpressId: number) => void;
  clearCurrentModelInfo: () => void;
  setGeometryReady: (geometryReady: boolean) => void;
  setGeometrySummary: (meshCount: number, vertexCount: number, indexCount: number) => void;
  resetGeometrySummary: () => void;
  setSpatialTree: (spatialTree: IfcSpatialNode[]) => void;
  clearSpatialTree: () => void;
  setTypeTree: (typeTree: IfcTypeTreeGroup[]) => void;
  clearTypeTree: () => void;
  setActiveClassFilter: (activeClassFilter: string | null) => void;
  setActiveTypeFilter: (activeTypeFilter: string | null) => void;
  setActiveStoreyFilter: (activeStoreyFilter: number | null) => void;
  resetFilters: () => void;
  setSelectedProperties: (selectedProperties: IfcElementProperties) => void;
  clearSelectedProperties: () => void;
  setPropertiesState: (propertiesLoading: boolean, propertiesError?: string | null) => void;
  setViewerError: (viewerError: string | null) => void;
  clearViewerError: () => void;
  setEngineState: (engineState: DataSlice['engineState'], engineMessage: string) => void;
}

export const createDataSlice: StateCreator<DataSlice, [], [], DataSlice> = (set) => ({
  currentFileName: null,
  currentModelId: null,
  currentModelSchema: null,
  currentModelMaxExpressId: null,
  geometryReady: false,
  geometryMeshCount: 0,
  geometryVertexCount: 0,
  geometryIndexCount: 0,
  spatialTree: [],
  typeTree: [],
  activeClassFilter: null,
  activeTypeFilter: null,
  activeStoreyFilter: null,
  selectedProperties: emptyProperties,
  propertiesLoading: false,
  propertiesError: null,
  viewerError: null,
  engineState: 'idle',
  engineMessage: '엔진 초기화 전',
  setCurrentFileName: (currentFileName) => set({ currentFileName }),
  setCurrentModelInfo: (currentModelId, currentModelSchema, currentModelMaxExpressId) =>
    set({ currentModelId, currentModelSchema, currentModelMaxExpressId }),
  clearCurrentModelInfo: () =>
    set({ currentModelId: null, currentModelSchema: null, currentModelMaxExpressId: null }),
  setGeometryReady: (geometryReady) => set({ geometryReady }),
  setGeometrySummary: (geometryMeshCount, geometryVertexCount, geometryIndexCount) =>
    set({ geometryMeshCount, geometryVertexCount, geometryIndexCount }),
  resetGeometrySummary: () => set({ geometryMeshCount: 0, geometryVertexCount: 0, geometryIndexCount: 0 }),
  setSpatialTree: (spatialTree) => set({ spatialTree }),
  clearSpatialTree: () => set({ spatialTree: [] }),
  setTypeTree: (typeTree) => set({ typeTree }),
  clearTypeTree: () => set({ typeTree: [] }),
  setActiveClassFilter: (activeClassFilter) => set({ activeClassFilter }),
  setActiveTypeFilter: (activeTypeFilter) => set({ activeTypeFilter }),
  setActiveStoreyFilter: (activeStoreyFilter) => set({ activeStoreyFilter }),
  resetFilters: () => set({ activeClassFilter: null, activeTypeFilter: null, activeStoreyFilter: null }),
  setSelectedProperties: (selectedProperties) =>
    set({ selectedProperties, propertiesLoading: false, propertiesError: null }),
  clearSelectedProperties: () =>
    set({ selectedProperties: emptyProperties, propertiesLoading: false, propertiesError: null }),
  setPropertiesState: (propertiesLoading, propertiesError = null) =>
    set({ propertiesLoading, propertiesError }),
  setViewerError: (viewerError) => set({ viewerError }),
  clearViewerError: () => set({ viewerError: null }),
  setEngineState: (engineState, engineMessage) => set({ engineState, engineMessage }),
});
