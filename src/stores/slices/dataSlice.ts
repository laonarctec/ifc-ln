import type { StateCreator } from 'zustand';
import type { IfcElementProperties, IfcSpatialNode } from '@/types/worker-messages';

const emptyProperties: IfcElementProperties = {
  expressID: null,
  globalId: null,
  ifcType: null,
  name: null,
  attributes: [],
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
  selectedProperties: IfcElementProperties;
  propertiesLoading: boolean;
  propertiesError: string | null;
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
  setSelectedProperties: (selectedProperties: IfcElementProperties) => void;
  clearSelectedProperties: () => void;
  setPropertiesState: (propertiesLoading: boolean, propertiesError?: string | null) => void;
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
  selectedProperties: emptyProperties,
  propertiesLoading: false,
  propertiesError: null,
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
  setSelectedProperties: (selectedProperties) =>
    set({ selectedProperties, propertiesLoading: false, propertiesError: null }),
  clearSelectedProperties: () =>
    set({ selectedProperties: emptyProperties, propertiesLoading: false, propertiesError: null }),
  setPropertiesState: (propertiesLoading, propertiesError = null) =>
    set({ propertiesLoading, propertiesError }),
  setEngineState: (engineState, engineMessage) => set({ engineState, engineMessage }),
});
