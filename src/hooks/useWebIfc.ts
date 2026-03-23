import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ifcWorkerClient } from '@/services/IfcWorkerClient';
import { viewportGeometryStore } from '@/services/viewportGeometryStore';
import { useViewerStore } from '@/stores';
import type { IfcElementProperties, IfcSpatialNode, IfcTypeTreeGroup } from '@/types/worker-messages';

interface MockGeometryResult {
  ready: boolean;
  meshCount: number;
  vertexCount: number;
  indexCount: number;
}

export function useWebIfc() {
  const store = useViewerStore(useShallow((state) => ({
    isLoading: state.isLoading,
    progressLabel: state.progressLabel,
    loadingProgress: state.loadingProgress,
    setLoading: state.setLoading,
    setLoadingProgress: state.setLoadingProgress,
    resetLoading: state.resetLoading,
    setCurrentFileName: state.setCurrentFileName,
    currentFileName: state.currentFileName,
    currentModelId: state.currentModelId,
    currentModelSchema: state.currentModelSchema,
    currentModelMaxExpressId: state.currentModelMaxExpressId,
    setCurrentModelInfo: state.setCurrentModelInfo,
    clearCurrentModelInfo: state.clearCurrentModelInfo,
    setGeometryReady: state.setGeometryReady,
    geometryReady: state.geometryReady,
    geometryMeshCount: state.geometryMeshCount,
    geometryVertexCount: state.geometryVertexCount,
    geometryIndexCount: state.geometryIndexCount,
    setGeometrySummary: state.setGeometrySummary,
    resetGeometrySummary: state.resetGeometrySummary,
    spatialTree: state.spatialTree,
    setSpatialTree: state.setSpatialTree,
    clearSpatialTree: state.clearSpatialTree,
    typeTree: state.typeTree,
    clearTypeTree: state.clearTypeTree,
    activeClassFilter: state.activeClassFilter,
    activeTypeFilter: state.activeTypeFilter,
    activeStoreyFilter: state.activeStoreyFilter,
    resetFilters: state.resetFilters,
    selectedProperties: state.selectedProperties,
    propertiesLoading: state.propertiesLoading,
    propertiesError: state.propertiesError,
    viewerError: state.viewerError,
    clearSelection: state.clearSelection,
    clearSelectedProperties: state.clearSelectedProperties,
    setViewerError: state.setViewerError,
    clearViewerError: state.clearViewerError,
    engineState: state.engineState,
    engineMessage: state.engineMessage,
    setEngineState: state.setEngineState,
  })));

  const {
    isLoading, progressLabel, loadingProgress, setLoading, setLoadingProgress, resetLoading,
    setCurrentFileName, currentFileName, currentModelId,
    currentModelSchema, currentModelMaxExpressId,
    setCurrentModelInfo, clearCurrentModelInfo,
    setGeometryReady, geometryReady, geometryMeshCount,
    geometryVertexCount, geometryIndexCount,
    setGeometrySummary, resetGeometrySummary,
    spatialTree, setSpatialTree, clearSpatialTree,
    typeTree, clearTypeTree,
    activeClassFilter, activeTypeFilter, activeStoreyFilter,
    resetFilters, selectedProperties, propertiesLoading,
    propertiesError, viewerError, clearSelection,
    clearSelectedProperties, setViewerError, clearViewerError,
    engineState, engineMessage, setEngineState,
  } = store;

  const cleanupViewerState = useCallback(() => {
    setGeometryReady(false);
    resetGeometrySummary();
    viewportGeometryStore.clear();
    clearSpatialTree();
    clearTypeTree();
    clearSelection();
    clearSelectedProperties();
    resetFilters();
  }, [clearSelectedProperties, clearSelection, clearSpatialTree, clearTypeTree, resetFilters, resetGeometrySummary, setGeometryReady]);

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
    setLoadingProgress(0, '파일 읽기');
    clearViewerError();
    cleanupViewerState();
    setCurrentFileName(file.name);

    try {
      if (currentModelId !== null) {
        await ifcWorkerClient.closeModel(currentModelId);
        clearCurrentModelInfo();
      }

      setLoadingProgress(10, '모델 파싱');
      const data = await file.arrayBuffer();
      const result = await ifcWorkerClient.loadModel(data);

      setCurrentModelInfo(result.modelId, result.schema, result.maxExpressId);
      setLoadingProgress(35, 'Render cache 구성');
      setLoading(true, `${file.name} render cache 구성 중`);

      const renderCache = await ifcWorkerClient.buildRenderCache(result.modelId);
      viewportGeometryStore.setManifest(renderCache.manifest);
      setGeometrySummary(
        renderCache.manifest.meshCount,
        renderCache.manifest.vertexCount,
        renderCache.manifest.indexCount
      );
      setGeometryReady(renderCache.manifest.chunkCount > 0);

      setLoadingProgress(75, 'Spatial tree 구성');
      setLoading(true, `${file.name} spatial tree 구성 중`);
      const spatial = await ifcWorkerClient.getSpatialStructure(result.modelId);
      setSpatialTree([spatial.tree]);
      setLoadingProgress(100, '완료');
      setLoading(false, `${file.name} 로딩 완료`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'IFC 로딩 실패';
      cleanupViewerState();
      setLoading(false, '로딩 실패');
      setViewerError(message);
      throw error;
    }
  }, [
    cleanupViewerState,
    clearCurrentModelInfo,
    clearViewerError,
    currentModelId,
    initEngine,
    setCurrentFileName,
    setCurrentModelInfo,
    setGeometryReady,
    setGeometrySummary,
    setLoading,
    setLoadingProgress,
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
    cleanupViewerState();
  }, [
    cleanupViewerState,
    clearCurrentModelInfo,
    clearViewerError,
    currentModelId,
    resetLoading,
    setCurrentFileName,
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
