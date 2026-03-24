import { clsx } from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWebIfc } from "@/hooks/useWebIfc";
import {
  useViewportGeometry,
  viewportGeometryStore,
} from "@/services/viewportGeometryStore";
import { useViewerStore } from "@/stores";
import type { RenderChunkPayload } from "@/types/worker-messages";
import { createModelEntityKey, type ModelEntityKey } from "@/utils/modelEntity";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { HoverTooltip } from "./HoverTooltip";
import { ViewportNotifications } from "./ViewportNotifications";
import { ViewportScene } from "./ViewportScene";
import { useViewportEntityFilters } from "@/hooks/useViewportEntityFilters";
import { useChunkResidency } from "@/hooks/useChunkResidency";
import { useLensEffects } from "@/hooks/useLensEffects";

const emptyStateTone = {
  idle: "from-white/45 to-white/8",
  loading: "from-blue-50/65 to-white/12",
  error: "from-red-50/72 to-white/16",
} as const;

function combineVisibleManifests(manifests: NonNullable<ReturnType<typeof useViewportGeometry>["combinedManifest"]>[]) {
  if (manifests.length === 0) {
    return null;
  }

  return manifests.reduce((combined, manifest) => ({
    modelId: -1,
    meshCount: combined.meshCount + manifest.meshCount,
    vertexCount: combined.vertexCount + manifest.vertexCount,
    indexCount: combined.indexCount + manifest.indexCount,
    chunkCount: combined.chunkCount + manifest.chunkCount,
    modelBounds: [
      Math.min(combined.modelBounds[0], manifest.modelBounds[0]),
      Math.min(combined.modelBounds[1], manifest.modelBounds[1]),
      Math.min(combined.modelBounds[2], manifest.modelBounds[2]),
      Math.max(combined.modelBounds[3], manifest.modelBounds[3]),
      Math.max(combined.modelBounds[4], manifest.modelBounds[4]),
      Math.max(combined.modelBounds[5], manifest.modelBounds[5]),
    ] as [number, number, number, number, number, number],
    initialChunkIds: [],
    chunks: [...combined.chunks, ...manifest.chunks],
  }), {
    modelId: -1,
    meshCount: 0,
    vertexCount: 0,
    indexCount: 0,
    chunkCount: 0,
    modelBounds: [...manifests[0].modelBounds] as [number, number, number, number, number, number],
    initialChunkIds: [],
    chunks: [],
  });
}

export function ViewportContainer() {
  const [hoverInfo, setHoverInfo] = useState<{
    modelId: number;
    expressId: number;
    x: number;
    y: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const selectedModelId = useViewerStore((state) => state.selectedModelId);
  const selectedEntityIds = useViewerStore((state) => state.selectedEntityIds);
  const setSelectedEntity = useViewerStore((state) => state.setSelectedEntity);
  const setSelectedEntities = useViewerStore((state) => state.setSelectedEntities);
  const hoverTooltipsEnabled = useViewerStore(
    (state) => state.hoverTooltipsEnabled,
  );
  const viewportCommand = useViewerStore((state) => state.viewportCommand);
  const viewportProjectionMode = useViewerStore(
    (state) => state.viewportProjectionMode,
  );
  const hiddenEntityKeys = useViewerStore((state) => state.hiddenEntityKeys);
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
    selectedEntityIds,
    activeStoreyFilter,
    activeTypeFilter,
    activeClassFilter,
  );

  const selectedEntityKeys = useMemo(() => {
    if (selectedModelId === null) {
      return new Set<ModelEntityKey>();
    }

    return new Set(
      selectedEntityIds.map((entityId) =>
        createModelEntityKey(selectedModelId, entityId),
      ),
    );
  }, [selectedEntityIds, selectedModelId]);

  const combinedHiddenKeys = useMemo(() => {
    const result = new Set(hiddenEntityKeys);
    activeModelHiddenKeys.forEach((key) => result.add(key));
    lensEffects.hiddenKeys.forEach((key) => result.add(key));
    return result;
  }, [activeModelHiddenKeys, hiddenEntityKeys, lensEffects.hiddenKeys]);

  useEffect(() => {
    if (selectedEntityIds.length === 0) return;
    const visibleSelectedIds = selectedEntityIds.filter(
      (id) => !effectiveHiddenIdSet.has(id),
    );
    if (visibleSelectedIds.length !== selectedEntityIds.length) {
      setSelectedEntities(currentModelId, visibleSelectedIds);
    }
  }, [currentModelId, effectiveHiddenIdSet, selectedEntityIds, setSelectedEntities]);

  useEffect(() => {
    if (!hoverTooltipsEnabled) {
      setHoverInfo(null);
    }
  }, [hoverTooltipsEnabled]);

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
        .flatMap((model) =>
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
        .filter((manifest): manifest is NonNullable<typeof manifest> =>
          Boolean(manifest),
        ),
    [loadedModels, modelsById],
  );
  const visibleManifest = useMemo(() => combineVisibleManifests(manifests), [manifests]);

  const emptyState = useMemo(() => {
    if (error) {
      return {
        tone: "error" as const,
        title: "모델을 불러오지 못했습니다",
        description: error,
        hint: "다른 IFC 파일로 다시 시도하거나 엔진 상태와 worker 로그를 확인해 주세요.",
      };
    }
    if (loading) {
      return {
        tone: "loading" as const,
        title: "모델을 준비하고 있습니다",
        description: progress,
        hint: "render cache와 spatial tree를 순서대로 준비하는 중입니다.",
      };
    }
    if (engineState !== "ready") {
      return {
        tone: "idle" as const,
        title: "엔진 준비가 필요합니다",
        description: engineMessage,
        hint: "헤더에서 엔진을 초기화한 뒤 IFC 파일을 열면 바로 3D 뷰가 표시됩니다.",
      };
    }
    if (!currentFileName && loadedModels.length === 0) {
      return {
        tone: "idle" as const,
        title: "IFC 파일을 열어 주세요",
        description: "모델이 아직 로드되지 않았습니다.",
        hint: "헤더의 열기 버튼으로 IFC 파일을 선택하면 뷰포트와 패널이 함께 채워집니다.",
      };
    }
    return {
      tone: "idle" as const,
      title: "렌더 청크를 준비하고 있습니다",
      description:
        "모델 메타데이터는 열렸지만 아직 현재 시야에 필요한 청크가 로드되지 않았습니다.",
      hint: "대형 IFC의 경우 첫 시야에 필요한 청크만 우선 올립니다.",
    };
  }, [currentFileName, engineMessage, engineState, error, loadedModels.length, loading, progress]);

  const handleSelectEntity = useCallback(
    (modelId: number | null, expressId: number | null, additive = false) => {
      if (modelId === null || expressId === null) {
        setSelectedEntity(null, null);
        return;
      }

      setActiveModelId(modelId);
      setSelectedEntity(modelId, expressId, additive);
    },
    [setActiveModelId, setSelectedEntity],
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
      setContextMenu({ modelId, expressId, x: position.x, y: position.y });
    },
    [],
  );

  const handleContextMenuHide = useCallback((modelId: number, expressId: number) => {
    useViewerStore.getState().hideEntity(expressId, modelId);
    useViewerStore.getState().clearSelection();
  }, []);

  const handleContextMenuIsolate = useCallback(
    (modelId: number, expressId: number) => {
      const manifest = modelsById[modelId]?.manifest;
      const allIds = [...new Set(manifest?.chunks.flatMap((chunk) => chunk.entityIds) ?? [])];
      useViewerStore.getState().isolateEntities([expressId], allIds, modelId);
      setActiveModelId(modelId);
    },
    [modelsById, setActiveModelId],
  );

  const handleContextMenuShowAll = useCallback(() => {
    if (currentModelId !== null) {
      useViewerStore.getState().resetHiddenEntities(currentModelId);
      return;
    }
    useViewerStore.getState().resetHiddenEntities();
  }, [currentModelId]);

  const handleContextMenuFitSelected = useCallback(() => {
    useViewerStore.getState().runViewportCommand("fit-selected");
  }, []);

  const hoverSummary = hoverInfo
    ? entitySummaries.get(hoverInfo.expressId)
    : null;

  return (
    <section className="viewport">
      <div className="viewport-label">Viewport</div>
      <div className="relative flex-auto w-full h-full min-h-0 overflow-hidden bg-transparent">
        {visibleManifest ? (
          <ViewportScene
            manifest={visibleManifest}
            manifests={manifests}
            residentChunks={residentChunks}
            chunkVersion={geometryVersion}
            selectedEntityKeys={selectedEntityKeys}
            hiddenEntityKeys={combinedHiddenKeys}
            colorOverrides={lensEffects.colorOverrides}
            projectionMode={viewportProjectionMode}
            viewportCommand={viewportCommand}
            onSelectEntity={handleSelectEntity}
            onVisibleChunkIdsChange={handleVisibleChunkIdsChange}
            onHoverEntity={handleHoverEntity}
            onContextMenu={handleContextMenu}
          />
        ) : (
          <div
            className={clsx("viewport-empty", emptyStateTone[emptyState.tone])}
          >
            <h1 className="m-0 text-text text-[clamp(1.9rem,3vw,2.6rem)] leading-[1.05] dark:text-slate-100">
              {emptyState.title}
            </h1>
            <p className="m-0 max-w-[560px] text-text-secondary">
              {emptyState.description}
            </p>
            <p className="m-0 max-w-[560px] text-text-secondary">
              {emptyState.hint}
            </p>
          </div>
        )}
        <ViewportNotifications />
        {hoverTooltipsEnabled && hoverInfo && hoverSummary && !contextMenu && (
          <HoverTooltip
            entityId={hoverInfo.expressId}
            ifcType={hoverSummary.ifcType}
            name={hoverSummary.name}
            x={hoverInfo.x}
            y={hoverInfo.y}
          />
        )}
        {contextMenu && (
          <ContextMenu
            menu={contextMenu}
            onClose={() => setContextMenu(null)}
            onHide={handleContextMenuHide}
            onIsolate={handleContextMenuIsolate}
            onShowAll={handleContextMenuShowAll}
            onFitSelected={handleContextMenuFitSelected}
          />
        )}
      </div>
    </section>
  );
}
