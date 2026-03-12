import { useCallback, useMemo } from 'react';
import { ifcWorkerClient } from '@/services/IfcWorkerClient';
import { viewportGeometryStore } from '@/services/viewportGeometryStore';
import { useViewerStore } from '@/stores';
import type { IfcElementProperties, IfcSpatialNode, IfcTypeTreeGroup } from '@/types/worker-messages';

export interface MockGeometryResult {
  ready: boolean;
  meshCount: number;
  vertexCount: number;
  indexCount: number;
}

export function useWebIfc() {
  const isLoading = useViewerStore((state) => state.isLoading);
  const progressLabel = useViewerStore((state) => state.progressLabel);
  const setLoading = useViewerStore((state) => state.setLoading);
  const resetLoading = useViewerStore((state) => state.resetLoading);
  const setCurrentFileName = useViewerStore((state) => state.setCurrentFileName);
  const currentFileName = useViewerStore((state) => state.currentFileName);
  const currentModelId = useViewerStore((state) => state.currentModelId);
  const currentModelSchema = useViewerStore((state) => state.currentModelSchema);
  const currentModelMaxExpressId = useViewerStore((state) => state.currentModelMaxExpressId);
  const setCurrentModelInfo = useViewerStore((state) => state.setCurrentModelInfo);
  const clearCurrentModelInfo = useViewerStore((state) => state.clearCurrentModelInfo);
  const setGeometryReady = useViewerStore((state) => state.setGeometryReady);
  const geometryReady = useViewerStore((state) => state.geometryReady);
  const geometryMeshCount = useViewerStore((state) => state.geometryMeshCount);
  const geometryVertexCount = useViewerStore((state) => state.geometryVertexCount);
  const geometryIndexCount = useViewerStore((state) => state.geometryIndexCount);
  const setGeometrySummary = useViewerStore((state) => state.setGeometrySummary);
  const resetGeometrySummary = useViewerStore((state) => state.resetGeometrySummary);
  const spatialTree = useViewerStore((state) => state.spatialTree);
  const setSpatialTree = useViewerStore((state) => state.setSpatialTree);
  const clearSpatialTree = useViewerStore((state) => state.clearSpatialTree);
  const typeTree = useViewerStore((state) => state.typeTree);
  const clearTypeTree = useViewerStore((state) => state.clearTypeTree);
  const activeClassFilter = useViewerStore((state) => state.activeClassFilter);
  const activeTypeFilter = useViewerStore((state) => state.activeTypeFilter);
  const activeStoreyFilter = useViewerStore((state) => state.activeStoreyFilter);
  const resetFilters = useViewerStore((state) => state.resetFilters);
  const selectedProperties = useViewerStore((state) => state.selectedProperties);
  const propertiesLoading = useViewerStore((state) => state.propertiesLoading);
  const propertiesError = useViewerStore((state) => state.propertiesError);
  const viewerError = useViewerStore((state) => state.viewerError);
  const clearSelection = useViewerStore((state) => state.clearSelection);
  const clearSelectedProperties = useViewerStore((state) => state.clearSelectedProperties);
  const setViewerError = useViewerStore((state) => state.setViewerError);
  const clearViewerError = useViewerStore((state) => state.clearViewerError);
  const engineState = useViewerStore((state) => state.engineState);
  const engineMessage = useViewerStore((state) => state.engineMessage);
  const setEngineState = useViewerStore((state) => state.setEngineState);

  const initEngine = useCallback(async () => {
    if (engineState === 'ready') {
      return;
    }

    try {
      clearViewerError();
      setEngineState('initializing', 'web-ifc worker 초기화 중');
      const result = await ifcWorkerClient.init();
      setEngineState(
        'ready',
        result.singleThreaded
          ? 'web-ifc worker 준비 완료 (single-thread)'
          : 'web-ifc worker 준비 완료'
      );
    } catch (error) {
      setViewerError(error instanceof Error ? error.message : 'web-ifc worker 초기화 실패');
      setEngineState(
        'error',
        error instanceof Error ? error.message : 'web-ifc worker 초기화 실패'
      );
    }
  }, [clearViewerError, engineState, setEngineState, setViewerError]);

  const loadFile = useCallback(async (file?: File) => {
    await initEngine();

    if (!file) {
      throw new Error('로드할 IFC 파일이 없습니다.');
    }

    setLoading(true, `${file.name} 로딩 중`);
    clearViewerError();
    setGeometryReady(false);
    resetGeometrySummary();
    viewportGeometryStore.clear();
    clearSpatialTree();
    clearTypeTree();
    clearSelection();
    clearSelectedProperties();
    resetFilters();
    setCurrentFileName(file.name);

    try {
      if (currentModelId !== null) {
        await ifcWorkerClient.closeModel(currentModelId);
        clearCurrentModelInfo();
      }

      const data = await file.arrayBuffer();
      const result = await ifcWorkerClient.loadModel(data);

      setCurrentModelInfo(result.modelId, result.schema, result.maxExpressId);
      setLoading(true, `${file.name} render cache 구성 중`);

      const renderCache = await ifcWorkerClient.buildRenderCache(result.modelId);
      viewportGeometryStore.setManifest(renderCache.manifest);
      setGeometrySummary(
        renderCache.manifest.meshCount,
        renderCache.manifest.vertexCount,
        renderCache.manifest.indexCount
      );
      setGeometryReady(renderCache.manifest.chunkCount > 0);

      setLoading(true, `${file.name} spatial tree 구성 중`);
      const spatial = await ifcWorkerClient.getSpatialStructure(result.modelId);
      setSpatialTree([spatial.tree]);
      setLoading(false, `${file.name} 로딩 완료`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'IFC 로딩 실패';
      setGeometryReady(false);
      resetGeometrySummary();
      viewportGeometryStore.clear();
      clearSpatialTree();
      clearTypeTree();
      clearSelection();
      clearSelectedProperties();
      resetFilters();
      setLoading(false, '로딩 실패');
      setViewerError(message);
      throw error;
    }
  }, [
    clearCurrentModelInfo,
    clearSelectedProperties,
    clearSelection,
    clearSpatialTree,
    clearTypeTree,
    clearViewerError,
    currentModelId,
    initEngine,
    resetFilters,
    resetGeometrySummary,
    setCurrentFileName,
    setCurrentModelInfo,
    setGeometryReady,
    setGeometrySummary,
    setLoading,
    setSpatialTree,
    setViewerError,
  ]);

  const resetSession = useCallback(async () => {
    if (currentModelId !== null) {
      try {
        await ifcWorkerClient.closeModel(currentModelId);
      } catch (error) {
        console.error(error);
      }
    }

    resetLoading();
    clearViewerError();
    setCurrentFileName(null);
    clearCurrentModelInfo();
    setGeometryReady(false);
    resetGeometrySummary();
    viewportGeometryStore.clear();
    clearSpatialTree();
    clearTypeTree();
    clearSelection();
    clearSelectedProperties();
    resetFilters();
  }, [
    clearCurrentModelInfo,
    clearSelectedProperties,
    clearSelection,
    clearSpatialTree,
    clearTypeTree,
    clearViewerError,
    currentModelId,
    resetFilters,
    resetGeometrySummary,
    resetLoading,
    setCurrentFileName,
    setGeometryReady,
  ]);

  const geometryResult = useMemo<MockGeometryResult>(
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

  const properties = useMemo<IfcElementProperties>(() => selectedProperties, [selectedProperties]);
  const resolvedTypeTree = useMemo<IfcTypeTreeGroup[]>(() => typeTree, [typeTree]);

  return {
    loadFile,
    resetSession,
    initEngine,
    loading: isLoading,
    progress: progressLabel,
    error: viewerError,
    currentFileName,
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
    geometryResult,
    spatialTree: resolvedSpatialTree,
    typeTree: resolvedTypeTree,
    activeClassFilter,
    activeTypeFilter,
    activeStoreyFilter,
    properties,
    propertiesLoading,
    propertiesError,
    engineState,
    engineMessage,
  };
}
