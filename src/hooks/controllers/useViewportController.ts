import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWebIfc } from "@/hooks/useWebIfc";
import { useChunkResidency } from "@/hooks/useChunkResidency";
import { useLensEffects } from "@/hooks/useLensEffects";
import { useViewportEntityFilters } from "@/hooks/useViewportEntityFilters";
import {
  combineManifests,
  useViewportGeometry,
  viewportGeometryStore,
} from "@/services/viewportGeometryStore";
import { useViewerStore } from "@/stores";
import { selectPanelState, selectSelectionState, selectVisibilityState } from "@/stores/viewerSelectors";
import type { EntitySummary } from "@/types/hierarchy";
import type { RenderChunkPayload, RenderManifest } from "@/types/worker-messages";
import type { ViewportCommand } from "@/stores/slices/uiSlice";
import { createModelEntityKey, type ModelEntityKey } from "@/utils/modelEntity";
import type { BoxSelectionResult } from "@/components/viewer/viewport/raycasting";
import type { ContextMenuState } from "@/components/viewer/ContextMenu";

const emptyStateTone = {
  idle: "from-white/45 to-white/8",
  loading: "from-blue-50/65 to-white/12",
  error: "from-red-50/72 to-white/16",
} as const;

interface HoverInfo {
  modelId: number;
  expressId: number;
  x: number;
  y: number;
}

interface ViewportEmptyState {
  tone: keyof typeof emptyStateTone;
  title: string;
  description: string;
  hint: string;
}

export interface ViewportController {
  selectedModelId: number | null;
  selectedEntityIds: number[];
  selectedEntityKeys: Set<ModelEntityKey>;
  combinedHiddenKeys: Set<ModelEntityKey>;
  colorOverrides: Map<ModelEntityKey, string>;
  viewportProjectionMode: "perspective" | "orthographic";
  viewportCommand: ViewportCommand;
  geometryVersion: number;
  manifests: RenderManifest[];
  visibleManifest: RenderManifest | null;
  residentChunks: RenderChunkPayload[];
  hoverTooltipsEnabled: boolean;
  hoverInfo: HoverInfo | null;
  hoverSummary: EntitySummary | null;
  contextMenu: ContextMenuState | null;
  emptyState: ViewportEmptyState;
  emptyToneClassName: string;
  handleSelectEntity: (
    modelId: number | null,
    expressId: number | null,
    additive?: boolean,
  ) => void;
  handleVisibleChunkIdsChange: (
    modelId: number,
    nextVisibleChunkIds: number[],
  ) => void;
  handleHoverEntity: (
    modelId: number | null,
    expressId: number | null,
    position: { x: number; y: number } | null,
  ) => void;
  handleContextMenu: (
    modelId: number | null,
    expressId: number | null,
    position: { x: number; y: number },
  ) => void;
  closeContextMenu: () => void;
  handleContextMenuHide: (modelId: number, entityIds: number[]) => void;
  handleContextMenuIsolate: (modelId: number, entityIds: number[]) => void;
  handleContextMenuShowAll: () => void;
  handleContextMenuFitSelected: () => void;
  handleBoxSelect: (results: BoxSelectionResult[], additive: boolean) => void;
}

export function useViewportController(): ViewportController {
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const selectionState = useViewerStore(useShallow(selectSelectionState));
  const visibilityState = useViewerStore(useShallow(selectVisibilityState));
  const panelState = useViewerStore(useShallow(selectPanelState));
  const {
    modelsById,
    version: geometryVersion,
  } = useViewportGeometry();
  const {
    loading,
    progress,
    error,
    engineState,
    engineMessage,
    currentFileName,
    currentModelId,
    loadedModels,
    activeModelId,
    setActiveModelId,
    spatialTree,
    activeClassFilter,
    activeTypeFilter,
    activeStoreyFilter,
  } = useWebIfc();

  const {
    entitySummaries,
    effectiveHiddenIdSet,
    effectiveHiddenKeys: activeModelHiddenKeys,
  } = useViewportEntityFilters(
    currentModelId,
    spatialTree,
    activeClassFilter,
    activeTypeFilter,
    activeStoreyFilter,
  );
  const lensEffects = useLensEffects();

  useChunkResidency(
    loadedModels,
    modelsById,
    activeModelId,
    selectionState.selectedEntityIds,
    activeStoreyFilter,
    activeTypeFilter,
    activeClassFilter,
  );

  const selectedEntityKeys = useMemo(() => {
    if (selectionState.selectedModelId === null) {
      return new Set<ModelEntityKey>();
    }

    return new Set(
      selectionState.selectedEntityIds.map((entityId) =>
        createModelEntityKey(selectionState.selectedModelId!, entityId),
      ),
    );
  }, [selectionState.selectedEntityIds, selectionState.selectedModelId]);

  const combinedHiddenKeys = useMemo(() => {
    const result = new Set(visibilityState.hiddenEntityKeys);
    activeModelHiddenKeys.forEach((key) => result.add(key));
    lensEffects.hiddenKeys.forEach((key) => result.add(key));
    return result;
  }, [
    activeModelHiddenKeys,
    lensEffects.hiddenKeys,
    visibilityState.hiddenEntityKeys,
  ]);

  useEffect(() => {
    if (selectionState.selectedEntityIds.length === 0) return;
    const visibleSelectedIds = selectionState.selectedEntityIds.filter(
      (id) => !effectiveHiddenIdSet.has(id),
    );
    if (visibleSelectedIds.length !== selectionState.selectedEntityIds.length) {
      selectionState.setSelectedEntities(currentModelId, visibleSelectedIds);
    }
  }, [
    currentModelId,
    effectiveHiddenIdSet,
    selectionState,
  ]);

  useEffect(() => {
    if (!panelState.hoverTooltipsEnabled) {
      setHoverInfo(null);
    }
  }, [panelState.hoverTooltipsEnabled]);

  useEffect(() => {
    setHoverInfo(null);
  }, [currentModelId]);

  useEffect(() => {
    if (contextMenu) {
      setHoverInfo(null);
    }
  }, [contextMenu]);

  const residentChunks = useMemo(
    () =>
      loadedModels
        .filter((model) => model.visible)
        .flatMap(
          (model) =>
            modelsById[model.modelId]?.residentChunkIds
              .map((chunkId) => modelsById[model.modelId]?.chunksById[chunkId])
              .filter((chunk): chunk is RenderChunkPayload => Boolean(chunk)) ?? [],
        ),
    [loadedModels, modelsById],
  );

  const manifests = useMemo(
    () =>
      loadedModels
        .filter((model) => model.visible)
        .map((model) => modelsById[model.modelId]?.manifest)
        .filter((manifest): manifest is RenderManifest => Boolean(manifest)),
    [loadedModels, modelsById],
  );
  const visibleManifest = useMemo(() => combineManifests(manifests), [manifests]);

  const emptyState = useMemo<ViewportEmptyState>(() => {
    if (error) {
      return {
        tone: "error",
        title: "모델을 불러오지 못했습니다",
        description: error,
        hint: "다른 IFC 파일로 다시 시도하거나 엔진 상태와 worker 로그를 확인해 주세요.",
      };
    }
    if (loading) {
      return {
        tone: "loading",
        title: "모델을 준비하고 있습니다",
        description: progress,
        hint: "render cache와 spatial tree를 순서대로 준비하는 중입니다.",
      };
    }
    if (engineState !== "ready") {
      return {
        tone: "idle",
        title: "엔진 준비가 필요합니다",
        description: engineMessage,
        hint: "헤더에서 엔진을 초기화한 뒤 IFC 파일을 열면 바로 3D 뷰가 표시됩니다.",
      };
    }
    if (!currentFileName && loadedModels.length === 0) {
      return {
        tone: "idle",
        title: "IFC 파일을 열어 주세요",
        description: "모델이 아직 로드되지 않았습니다.",
        hint: "헤더의 열기 버튼으로 IFC 파일을 선택하면 뷰포트와 패널이 함께 채워집니다.",
      };
    }
    return {
      tone: "idle",
      title: "렌더 청크를 준비하고 있습니다",
      description:
        "모델 메타데이터는 열렸지만 아직 현재 시야에 필요한 청크가 로드되지 않았습니다.",
      hint: "대형 IFC의 경우 첫 시야에 필요한 청크만 우선 올립니다.",
    };
  }, [
    currentFileName,
    engineMessage,
    engineState,
    error,
    loadedModels.length,
    loading,
    progress,
  ]);

  const handleSelectEntity = useCallback(
    (modelId: number | null, expressId: number | null, additive = false) => {
      if (modelId === null || expressId === null) {
        selectionState.setSelectedEntity(null, null);
        return;
      }

      setActiveModelId(modelId);
      selectionState.setSelectedEntity(modelId, expressId, additive);
    },
    [selectionState, setActiveModelId],
  );

  const handleVisibleChunkIdsChange = useCallback(
    (modelId: number, nextVisibleChunkIds: number[]) => {
      viewportGeometryStore.setVisibleChunkIds(modelId, nextVisibleChunkIds);
    },
    [],
  );

  const handleHoverEntity = useCallback(
    (
      modelId: number | null,
      expressId: number | null,
      position: { x: number; y: number } | null,
    ) => {
      if (modelId === null || expressId === null || position === null) {
        setHoverInfo(null);
        return;
      }

      setHoverInfo((prev) => {
        if (
          prev &&
          prev.modelId === modelId &&
          prev.expressId === expressId &&
          Math.abs(prev.x - position.x) < 8 &&
          Math.abs(prev.y - position.y) < 8
        ) {
          return prev;
        }

        return { modelId, expressId, x: position.x, y: position.y };
      });
    },
    [],
  );

  const handleContextMenu = useCallback(
    (
      modelId: number | null,
      expressId: number | null,
      position: { x: number; y: number },
    ) => {
      const hasSelection =
        selectionState.selectedModelId !== null &&
        selectionState.selectedEntityIds.length > 0;

      setContextMenu({
        modelId: hasSelection ? selectionState.selectedModelId : modelId,
        entityIds: hasSelection
          ? selectionState.selectedEntityIds
          : expressId !== null
            ? [expressId]
            : [],
        x: position.x,
        y: position.y,
      });
    },
    [selectionState.selectedEntityIds, selectionState.selectedModelId],
  );

  const handleContextMenuHide = useCallback(
    (modelId: number, entityIds: number[]) => {
      entityIds.forEach((entityId) => {
        visibilityState.hideEntity(entityId, modelId);
      });
      selectionState.clearSelection();
    },
    [selectionState.clearSelection, visibilityState.hideEntity],
  );

  const handleContextMenuIsolate = useCallback(
    (modelId: number, entityIds: number[]) => {
      const manifest = modelsById[modelId]?.manifest;
      const allIds = [
        ...new Set(manifest?.chunks.flatMap((chunk) => chunk.entityIds) ?? []),
      ];
      visibilityState.isolateEntities(entityIds, allIds, modelId);
      setActiveModelId(modelId);
    },
    [modelsById, setActiveModelId, visibilityState.isolateEntities],
  );

  const handleContextMenuShowAll = useCallback(() => {
    if (currentModelId !== null) {
      visibilityState.resetHiddenEntities(currentModelId);
      return;
    }
    visibilityState.resetHiddenEntities();
  }, [currentModelId, visibilityState.resetHiddenEntities]);

  const handleBoxSelect = useCallback(
    (results: BoxSelectionResult[], additive: boolean) => {
      if (results.length === 0) {
        if (!additive) selectionState.setSelectedEntity(null, null);
        return;
      }

      const modelId = results[0].modelId;
      const expressIds = results
        .filter((result) => result.modelId === modelId)
        .map((result) => result.expressId);

      if (additive) {
        const currentIds =
          selectionState.selectedModelId === modelId
            ? selectionState.selectedEntityIds
            : [];
        const merged = [...new Set([...currentIds, ...expressIds])];
        selectionState.setSelectedEntities(modelId, merged);
      } else {
        selectionState.setSelectedEntities(modelId, expressIds);
      }
      setActiveModelId(modelId);
    },
    [selectionState, setActiveModelId],
  );

  const hoverSummary = hoverInfo
    ? entitySummaries.get(hoverInfo.expressId) ?? null
    : null;

  return {
    selectedModelId: selectionState.selectedModelId,
    selectedEntityIds: selectionState.selectedEntityIds,
    selectedEntityKeys,
    combinedHiddenKeys,
    colorOverrides: lensEffects.colorOverrides,
    viewportProjectionMode: panelState.viewportProjectionMode,
    viewportCommand: panelState.viewportCommand,
    geometryVersion,
    manifests,
    visibleManifest,
    residentChunks,
    hoverTooltipsEnabled: panelState.hoverTooltipsEnabled,
    hoverInfo,
    hoverSummary,
    contextMenu,
    emptyState,
    emptyToneClassName: emptyStateTone[emptyState.tone],
    handleSelectEntity,
    handleVisibleChunkIdsChange,
    handleHoverEntity,
    handleContextMenu,
    closeContextMenu: () => setContextMenu(null),
    handleContextMenuHide,
    handleContextMenuIsolate,
    handleContextMenuShowAll,
    handleContextMenuFitSelected: () =>
      panelState.runViewportCommand("fit-selected"),
    handleBoxSelect,
  };
}
