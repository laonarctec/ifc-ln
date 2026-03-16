import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useViewerStore } from '@/stores';
import type { IfcSpatialNode, IfcTypeTreeGroup } from '@/types/worker-messages';

interface HierarchyPanelData {
  currentModelId: number | null;
  currentModelSchema: string | null;
  currentModelMaxExpressId: number | null;
  geometryResult: {
    ready: boolean;
    meshCount: number;
    vertexCount: number;
    indexCount: number;
  };
  loading: boolean;
  progress: string;
  engineMessage: string;
  spatialTree: IfcSpatialNode[];
  typeTree: IfcTypeTreeGroup[];
  activeClassFilter: string | null;
  activeTypeFilter: string | null;
  activeStoreyFilter: number | null;
}

export function useHierarchyPanelData(): HierarchyPanelData {
  const store = useViewerStore(useShallow((state) => ({
    currentFileName: state.currentFileName,
    currentModelId: state.currentModelId,
    currentModelSchema: state.currentModelSchema,
    currentModelMaxExpressId: state.currentModelMaxExpressId,
    geometryReady: state.geometryReady,
    geometryMeshCount: state.geometryMeshCount,
    geometryVertexCount: state.geometryVertexCount,
    geometryIndexCount: state.geometryIndexCount,
    loading: state.isLoading,
    progress: state.progressLabel,
    engineMessage: state.engineMessage,
    spatialTree: state.spatialTree,
    typeTree: state.typeTree,
    activeClassFilter: state.activeClassFilter,
    activeTypeFilter: state.activeTypeFilter,
    activeStoreyFilter: state.activeStoreyFilter,
  })));

  const geometryResult = useMemo(
    () => ({
      ready: store.geometryReady,
      meshCount: store.geometryMeshCount,
      vertexCount: store.geometryVertexCount,
      indexCount: store.geometryIndexCount,
    }),
    [store.geometryIndexCount, store.geometryMeshCount, store.geometryReady, store.geometryVertexCount]
  );

  const resolvedSpatialTree = useMemo<IfcSpatialNode[]>(
    () =>
      store.spatialTree.length > 0
        ? store.spatialTree
        : [
            {
              expressID: 0,
              type: store.currentFileName ? 'IFCPROJECT' : 'EMPTY',
              children: [],
            },
          ],
    [store.currentFileName, store.spatialTree]
  );

  const resolvedTypeTree = useMemo<IfcTypeTreeGroup[]>(() => store.typeTree, [store.typeTree]);

  return {
    currentModelId: store.currentModelId,
    currentModelSchema: store.currentModelSchema,
    currentModelMaxExpressId: store.currentModelMaxExpressId,
    geometryResult,
    loading: store.loading,
    progress: store.progress,
    engineMessage: store.engineMessage,
    spatialTree: resolvedSpatialTree,
    typeTree: resolvedTypeTree,
    activeClassFilter: store.activeClassFilter,
    activeTypeFilter: store.activeTypeFilter,
    activeStoreyFilter: store.activeStoreyFilter,
  };
}
