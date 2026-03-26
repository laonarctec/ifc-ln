import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { ifcWorkerClient } from "@/services/IfcWorkerClient";
import { viewportGeometryStore } from "@/services/viewportGeometryStore";
import { decodeIfcb } from "@/services/ifcbFormat";
import { useViewerStore } from "@/stores";
import type {
  IfcElementProperties,
  IfcSpatialNode,
  IfcTypeTreeGroup,
} from "@/types/worker-messages";

interface MockGeometryResult {
  ready: boolean;
  meshCount: number;
  vertexCount: number;
  indexCount: number;
}

export function useWebIfc() {
  const store = useViewerStore(
    useShallow((state) => ({
      isLoading: state.isLoading,
      progressLabel: state.progressLabel,
      loadingProgress: state.loadingProgress,
      setLoading: state.setLoading,
      setLoadingProgress: state.setLoadingProgress,
      resetLoading: state.resetLoading,
      loadedModels: state.loadedModels,
      activeModelId: state.activeModelId,
      setActiveModelId: state.setActiveModelId,
      addLoadedModel: state.addLoadedModel,
      removeLoadedModel: state.removeLoadedModel,
      clearLoadedModels: state.clearLoadedModels,
      setModelVisibility: state.setModelVisibility,
      currentFileName: state.currentFileName,
      currentModelId: state.currentModelId,
      currentModelSchema: state.currentModelSchema,
      currentModelMaxExpressId: state.currentModelMaxExpressId,
      setGeometryReady: state.setGeometryReady,
      geometryReady: state.geometryReady,
      geometryMeshCount: state.geometryMeshCount,
      geometryVertexCount: state.geometryVertexCount,
      geometryIndexCount: state.geometryIndexCount,
      setGeometrySummary: state.setGeometrySummary,
      spatialTree: state.spatialTree,
      setSpatialTree: state.setSpatialTree,
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
      resetTools: state.resetTools,
      setViewerError: state.setViewerError,
      clearViewerError: state.clearViewerError,
      engineState: state.engineState,
      engineMessage: state.engineMessage,
      setEngineState: state.setEngineState,
    })),
  );

  const {
    isLoading,
    progressLabel,
    setLoading,
    setLoadingProgress,
    resetLoading,
    loadedModels,
    activeModelId,
    setActiveModelId,
    addLoadedModel,
    removeLoadedModel,
    clearLoadedModels,
    setModelVisibility,
    currentFileName,
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
    setGeometryReady,
    geometryReady,
    geometryMeshCount,
    geometryVertexCount,
    geometryIndexCount,
    setGeometrySummary,
    spatialTree,
    setSpatialTree,
    typeTree,
    clearTypeTree,
    activeClassFilter,
    activeTypeFilter,
    activeStoreyFilter,
    resetFilters,
    selectedProperties,
    propertiesLoading,
    propertiesError,
    viewerError,
    clearSelection,
    clearSelectedProperties,
    resetTools,
    setViewerError,
    clearViewerError,
    engineState,
    engineMessage,
    setEngineState,
  } = store;

  const clearInteractionState = useCallback(() => {
    clearSelection();
    clearSelectedProperties();
    resetFilters();
    resetTools();
  }, [clearSelectedProperties, clearSelection, resetFilters, resetTools]);

  const initEngine = useCallback(async () => {
    if (engineState === "ready") {
      return;
    }

    try {
      clearViewerError();
      setEngineState("initializing", "web-ifc worker 초기화 중");
      const result = await ifcWorkerClient.init();
      setEngineState(
        "ready",
        result.singleThreaded
          ? "web-ifc worker 준비 완료 (single-thread)"
          : "web-ifc worker 준비 완료",
      );
    } catch (error) {
      setViewerError(
        error instanceof Error ? error.message : "web-ifc worker 초기화 실패",
      );
      setEngineState(
        "error",
        error instanceof Error ? error.message : "web-ifc worker 초기화 실패",
      );
    }
  }, [clearViewerError, engineState, setEngineState, setViewerError]);

  const loadIfcbFile = useCallback(
    async (file: File) => {
      setLoading(true, `${file.name} 로딩 중`);
      setLoadingProgress(0, "IFCB 파일 읽기");
      clearViewerError();
      clearInteractionState();

      try {
        const data = await file.arrayBuffer();
        setLoadingProgress(30, "IFCB 디코딩");
        const ifcbFile = decodeIfcb(data);
        const { header } = ifcbFile;

        addLoadedModel({
          fileName: file.name,
          modelId: header.modelId,
          schema: header.schema,
          maxExpressId: 0,
        });
        setActiveModelId(header.modelId);

        setLoadingProgress(60, "Manifest 적용");
        viewportGeometryStore.setManifest(header.manifest);
        viewportGeometryStore.setIfcbFile(header.modelId, ifcbFile);
        setGeometrySummary(
          header.manifest.meshCount,
          header.manifest.vertexCount,
          header.manifest.indexCount,
        );
        setGeometryReady(header.manifest.chunkCount > 0);

        setLoadingProgress(85, "Spatial tree 적용");
        setSpatialTree([header.spatialTree]);
        clearTypeTree();
        setLoadingProgress(100, "완료");
        setLoading(false, `${file.name} 로딩 완료`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "IFCB 로딩 실패";
        setLoading(false, "로딩 실패");
        setViewerError(message);
        throw error;
      }
    },
    [
      addLoadedModel,
      clearInteractionState,
      clearTypeTree,
      clearViewerError,
      setActiveModelId,
      setGeometryReady,
      setGeometrySummary,
      setLoading,
      setLoadingProgress,
      setSpatialTree,
      setViewerError,
    ],
  );

  const loadFile = useCallback(
    async (file?: File) => {
      if (!file) {
        throw new Error("로드할 파일이 없습니다.");
      }

      // Route .ifcb files to the binary loader (no web-ifc needed)
      if (file.name.toLowerCase().endsWith(".ifcb")) {
        return loadIfcbFile(file);
      }

      await initEngine();

      setLoading(true, `${file.name} 로딩 중`);
      setLoadingProgress(0, "파일 읽기");
      clearViewerError();
      clearInteractionState();

      let loadedModelId: number | null = null;

      try {
        setLoadingProgress(10, "모델 파싱");
        const data = await file.arrayBuffer();
        const result = await ifcWorkerClient.loadModel(data);
        loadedModelId = result.modelId;

        addLoadedModel({
          fileName: file.name,
          modelId: result.modelId,
          schema: result.schema,
          maxExpressId: result.maxExpressId,
        });
        setActiveModelId(result.modelId);

        setLoadingProgress(35, "Render cache 구성");
        setLoading(true, `${file.name} render cache 구성 중`);

        const renderCache = await ifcWorkerClient.buildRenderCache(result.modelId);
        viewportGeometryStore.setManifest(renderCache.manifest);
        setGeometrySummary(
          renderCache.manifest.meshCount,
          renderCache.manifest.vertexCount,
          renderCache.manifest.indexCount,
        );
        setGeometryReady(renderCache.manifest.chunkCount > 0);

        setLoadingProgress(75, "Spatial tree 구성");
        setLoading(true, `${file.name} spatial tree 구성 중`);
        const spatial = await ifcWorkerClient.getSpatialStructure(result.modelId);
        setSpatialTree([spatial.tree]);
        clearTypeTree();
        setLoadingProgress(100, "완료");
        setLoading(false, `${file.name} 로딩 완료`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "IFC 로딩 실패";
        if (loadedModelId !== null) {
          viewportGeometryStore.removeModel(loadedModelId);
          removeLoadedModel(loadedModelId);
          try {
            await ifcWorkerClient.closeModel(loadedModelId);
          } catch (closeError) {
            console.error(closeError);
          }
        }
        setLoading(false, "로딩 실패");
        setViewerError(message);
        throw error;
      }
    },
    [
      addLoadedModel,
      clearInteractionState,
      clearTypeTree,
      clearViewerError,
      initEngine,
      loadIfcbFile,
      removeLoadedModel,
      setActiveModelId,
      setGeometryReady,
      setGeometrySummary,
      setLoading,
      setLoadingProgress,
      setSpatialTree,
      setViewerError,
    ],
  );

  const closeModel = useCallback(
    async (modelId: number) => {
      try {
        await ifcWorkerClient.closeModel(modelId);
      } catch (error) {
        console.error(error);
      }

      viewportGeometryStore.removeModel(modelId);
      removeLoadedModel(modelId);
      clearInteractionState();
    },
    [clearInteractionState, removeLoadedModel],
  );

  const resetSession = useCallback(async () => {
    await Promise.all(
      loadedModels.map(async (model) => {
        try {
          await ifcWorkerClient.closeModel(model.modelId);
        } catch (error) {
          console.error(error);
        }
      }),
    );

    resetLoading();
    clearViewerError();
    clearInteractionState();
    clearLoadedModels();
    clearTypeTree();
    viewportGeometryStore.clear();
  }, [
    clearInteractionState,
    clearLoadedModels,
    clearTypeTree,
    clearViewerError,
    loadedModels,
    resetLoading,
  ]);

  const geometryResult = useMemo<MockGeometryResult>(
    () => ({
      ready: geometryReady,
      meshCount: geometryMeshCount,
      vertexCount: geometryVertexCount,
      indexCount: geometryIndexCount,
    }),
    [geometryIndexCount, geometryMeshCount, geometryReady, geometryVertexCount],
  );

  const resolvedSpatialTree = useMemo<IfcSpatialNode[]>(
    () =>
      spatialTree.length > 0
        ? spatialTree
        : [
            {
              expressID: 0,
              type: currentFileName ? "IFCPROJECT" : "EMPTY",
              children: [],
            },
          ],
    [currentFileName, spatialTree],
  );

  const properties = useMemo<IfcElementProperties>(
    () => selectedProperties,
    [selectedProperties],
  );
  const resolvedTypeTree = useMemo<IfcTypeTreeGroup[]>(
    () => typeTree,
    [typeTree],
  );

  return {
    loadFile,
    closeModel,
    resetSession,
    initEngine,
    setActiveModelId,
    setModelVisibility,
    loading: isLoading,
    progress: progressLabel,
    error: viewerError,
    loadedModels,
    activeModelId,
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
