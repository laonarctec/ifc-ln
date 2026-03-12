import { useMemo } from 'react';
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
  const currentFileName = useViewerStore((state) => state.currentFileName);
  const currentModelId = useViewerStore((state) => state.currentModelId);
  const currentModelSchema = useViewerStore((state) => state.currentModelSchema);
  const currentModelMaxExpressId = useViewerStore((state) => state.currentModelMaxExpressId);
  const geometryReady = useViewerStore((state) => state.geometryReady);
  const geometryMeshCount = useViewerStore((state) => state.geometryMeshCount);
  const geometryVertexCount = useViewerStore((state) => state.geometryVertexCount);
  const geometryIndexCount = useViewerStore((state) => state.geometryIndexCount);
  const loading = useViewerStore((state) => state.isLoading);
  const progress = useViewerStore((state) => state.progressLabel);
  const engineMessage = useViewerStore((state) => state.engineMessage);
  const spatialTree = useViewerStore((state) => state.spatialTree);
  const typeTree = useViewerStore((state) => state.typeTree);
  const activeClassFilter = useViewerStore((state) => state.activeClassFilter);
  const activeTypeFilter = useViewerStore((state) => state.activeTypeFilter);
  const activeStoreyFilter = useViewerStore((state) => state.activeStoreyFilter);

  const geometryResult = useMemo(
    () => ({
      ready: geometryReady,
      meshCount: geometryMeshCount,
      vertexCount: geometryVertexCount,
      indexCount: geometryIndexCount,
    }),
    [geometryIndexCount, geometryMeshCount, geometryReady, geometryVertexCount]
  );

  const resolvedSpatialTree = useMemo<IfcSpatialNode[]>(
    () =>
      spatialTree.length > 0
        ? spatialTree
        : [
            {
              expressID: 0,
              type: currentFileName ? 'IFCPROJECT' : 'EMPTY',
              children: [],
            },
          ],
    [currentFileName, spatialTree]
  );

  const resolvedTypeTree = useMemo<IfcTypeTreeGroup[]>(() => typeTree, [typeTree]);

  return {
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
    geometryResult,
    loading,
    progress,
    engineMessage,
    spatialTree: resolvedSpatialTree,
    typeTree: resolvedTypeTree,
    activeClassFilter,
    activeTypeFilter,
    activeStoreyFilter,
  };
}
