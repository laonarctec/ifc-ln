import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ifcWorkerClient } from '@/services/IfcWorkerClient';
import { viewportGeometryStore } from '@/services/viewportGeometryStore';
import { useViewerStore } from '@/stores';
import type { IfcElementProperties, IfcSpatialNode } from '@/types/worker-messages';

export interface MockGeometryResult {
  ready: boolean;
  meshCount: number;
  vertexCount: number;
  indexCount: number;
}

export function useWebIfc() {
  const {
    isLoading,
    progressLabel,
    setLoading,
    resetLoading,
    setCurrentFileName,
    currentFileName,
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
    setCurrentModelInfo,
    clearCurrentModelInfo,
    setGeometryReady,
    geometryReady,
    geometryMeshCount,
    geometryVertexCount,
    geometryIndexCount,
    setGeometrySummary,
    resetGeometrySummary,
    spatialTree,
    setSpatialTree,
    clearSpatialTree,
    selectedEntityId,
    clearSelection,
    selectedProperties,
    propertiesLoading,
    propertiesError,
    setSelectedProperties,
    clearSelectedProperties,
    setPropertiesState,
    engineState,
    engineMessage,
    setEngineState,
  } = useViewerStore();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const initEngine = useCallback(async () => {
    if (engineState === 'ready') {
      return;
    }

    try {
      setEngineState('initializing', 'web-ifc worker 초기화 중');
      const result = await ifcWorkerClient.init();
      setEngineState(
        'ready',
        result.singleThreaded
          ? 'web-ifc worker 준비 완료 (single-thread)'
          : 'web-ifc worker 준비 완료'
      );
    } catch (error) {
      setEngineState(
        'error',
        error instanceof Error ? error.message : 'web-ifc worker 초기화 실패'
      );
    }
  }, [engineState, setEngineState]);

  const loadFile = useCallback(async (file?: File) => {
    await initEngine();

    if (!file) {
      throw new Error('로드할 IFC 파일이 없습니다.');
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    setLoading(true, `${file.name} 로딩 중`);
    setGeometryReady(false);
    resetGeometrySummary();
    viewportGeometryStore.clear();
    clearSpatialTree();
    clearSelection();
    clearSelectedProperties();
    setCurrentFileName(file.name);

    try {
      if (currentModelId !== null) {
        await ifcWorkerClient.closeModel(currentModelId);
        clearCurrentModelInfo();
      }

      const data = await file.arrayBuffer();
      const result = await ifcWorkerClient.loadModel(data);

      setCurrentModelInfo(result.modelId, result.schema, result.maxExpressId);
      setLoading(true, `${file.name} geometry 추출 중`);
      const streamed = await ifcWorkerClient.streamMeshes(result.modelId);
      viewportGeometryStore.setMeshes(streamed.meshes);
      setGeometrySummary(streamed.meshCount, streamed.vertexCount, streamed.indexCount);
      setLoading(true, `${file.name} spatial tree 구성 중`);
      const spatial = await ifcWorkerClient.getSpatialStructure(result.modelId);
      setSpatialTree([spatial.tree]);
      setGeometryReady(true);
      setLoading(false, `${file.name} 로딩 완료`);
    } catch (error) {
      setGeometryReady(false);
      resetGeometrySummary();
      viewportGeometryStore.clear();
      clearSpatialTree();
      clearSelection();
      clearSelectedProperties();
      setLoading(false, '로딩 실패');
      throw error;
    }
  }, [
    clearSelectedProperties,
    clearSelection,
    clearSpatialTree,
    clearCurrentModelInfo,
    currentModelId,
    initEngine,
    resetGeometrySummary,
    setCurrentFileName,
    setCurrentModelInfo,
    setGeometryReady,
    setGeometrySummary,
    setLoading,
    setSpatialTree,
  ]);

  const resetSession = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (currentModelId !== null) {
      try {
        await ifcWorkerClient.closeModel(currentModelId);
      } catch (error) {
        console.error(error);
      }
    }

    resetLoading();
    setCurrentFileName(null);
    clearCurrentModelInfo();
    setGeometryReady(false);
    resetGeometrySummary();
    viewportGeometryStore.clear();
    clearSpatialTree();
    clearSelection();
    clearSelectedProperties();
  }, [
    clearSelectedProperties,
    clearSelection,
    clearCurrentModelInfo,
    clearSpatialTree,
    currentModelId,
    resetGeometrySummary,
    resetLoading,
    setCurrentFileName,
    setGeometryReady,
  ]);

  useEffect(() => {
    if (currentModelId === null || selectedEntityId === null) {
      clearSelectedProperties();
      return;
    }

    let cancelled = false;
    setPropertiesState(true, null);

    void ifcWorkerClient
      .getProperties(currentModelId, selectedEntityId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setSelectedProperties(result.properties);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setPropertiesState(false, error instanceof Error ? error.message : '속성 조회 실패');
      });

    return () => {
      cancelled = true;
    };
  }, [
    clearSelectedProperties,
    currentModelId,
    selectedEntityId,
    setPropertiesState,
    setSelectedProperties,
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

  return {
    loadFile,
    resetSession,
    initEngine,
    loading: isLoading,
    progress: progressLabel,
    error: null as string | null,
    currentFileName,
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
    geometryResult,
    spatialTree: resolvedSpatialTree,
    properties,
    propertiesLoading,
    propertiesError,
    engineState,
    engineMessage,
  };
}
