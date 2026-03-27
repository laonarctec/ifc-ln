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
import type { ModelEntityKey } from "@/utils/modelEntity";
import type { BoxSelectionResult } from "@/components/viewer/viewport/raycasting";
import type { ContextMenuState } from "@/components/viewer/ContextMenu";
import {
  buildCombinedHiddenKeys,
  buildSelectedEntityKeys,
  collectManifestEntityIds,
  collectResidentChunks,
  collectVisibleManifests,
  createViewportContextMenu,
  filterVisibleSelectedIds,
  resolveBoxSelectionChange,
  resolveContextMenuShowAllTarget,
  resolveViewportEmptyState,
  type ViewportEmptyState,
} from "./viewportControllerUtils";

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

  const selectedEntityKeys = useMemo(
    () =>
      buildSelectedEntityKeys(
        selectionState.selectedModelId,
        selectionState.selectedEntityIds,
      ),
    [selectionState.selectedEntityIds, selectionState.selectedModelId],
  );

  const combinedHiddenKeys = useMemo(() => {
    return buildCombinedHiddenKeys(
      visibilityState.hiddenEntityKeys,
      activeModelHiddenKeys,
      lensEffects.hiddenKeys,
    );
  }, [
    activeModelHiddenKeys,
    lensEffects.hiddenKeys,
    visibilityState.hiddenEntityKeys,
  ]);

  useEffect(() => {
    if (selectionState.selectedEntityIds.length === 0) return;
    const visibleSelectedIds = filterVisibleSelectedIds(
      selectionState.selectedEntityIds,
      effectiveHiddenIdSet,
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
    () => collectResidentChunks(loadedModels, modelsById),
    [loadedModels, modelsById],
  );

  const manifests = useMemo(
    () => collectVisibleManifests(loadedModels, modelsById),
    [loadedModels, modelsById],
  );
  const visibleManifest = useMemo(
    () => combineManifests(manifests),
    [manifests],
  );

  const emptyState = useMemo<ViewportEmptyState>(() => {
    return resolveViewportEmptyState({
      error,
      loading,
      progress,
      engineState,
      engineMessage,
      currentFileName,
      loadedModelCount: loadedModels.length,
    });
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
      setContextMenu(
        createViewportContextMenu(
          selectionState,
          modelId,
          expressId,
          position,
        ),
      );
    },
    [selectionState],
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
      const allIds = collectManifestEntityIds(modelsById[modelId]?.manifest);
      visibilityState.isolateEntities(entityIds, allIds, modelId);
      setActiveModelId(modelId);
    },
    [modelsById, setActiveModelId, visibilityState.isolateEntities],
  );

  const handleContextMenuShowAll = useCallback(() => {
    const targetModelId = resolveContextMenuShowAllTarget(
      contextMenu,
      currentModelId,
    );
    if (targetModelId !== null) {
      visibilityState.resetHiddenEntities(targetModelId);
      return;
    }
    visibilityState.resetHiddenEntities();
  }, [contextMenu, currentModelId, visibilityState.resetHiddenEntities]);

  const handleBoxSelect = useCallback(
    (results: BoxSelectionResult[], additive: boolean) => {
      const selectionChange = resolveBoxSelectionChange(
        results,
        additive,
        selectionState.selectedModelId,
        selectionState.selectedEntityIds,
      );

      if (selectionChange.kind === "ignore") {
        return;
      }
      if (selectionChange.kind === "clear") {
        selectionState.setSelectedEntity(null, null);
        return;
      }

      selectionState.setSelectedEntities(
        selectionChange.modelId,
        selectionChange.expressIds,
      );
      setActiveModelId(selectionChange.modelId);
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
