import { clsx } from 'clsx';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWebIfc } from '@/hooks/useWebIfc';
import { useViewportGeometry, viewportGeometryStore } from '@/services/viewportGeometryStore';
import { useViewerStore } from '@/stores';
import type { RenderChunkPayload } from '@/types/worker-messages';
import { ContextMenu, type ContextMenuState } from './ContextMenu';
import { HoverTooltip } from './HoverTooltip';
import { ViewportNotifications } from './ViewportNotifications';
import { ViewportScene } from './ViewportScene';
import { useViewportEntityFilters } from '@/hooks/useViewportEntityFilters';
import { useChunkResidency } from '@/hooks/useChunkResidency';

const emptyStateTone = {
  idle: 'from-white/45 to-white/8',
  loading: 'from-blue-50/65 to-white/12',
  error: 'from-red-50/72 to-white/16',
} as const;

export function ViewportContainer() {
  const [hoverInfo, setHoverInfo] = useState<{ expressId: number; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const selectedEntityIds = useViewerStore((state) => state.selectedEntityIds);
  const setSelectedEntityId = useViewerStore((state) => state.setSelectedEntityId);
  const setSelectedEntityIds = useViewerStore((state) => state.setSelectedEntityIds);
  const hoverTooltipsEnabled = useViewerStore((state) => state.hoverTooltipsEnabled);
  const viewportCommand = useViewerStore((state) => state.viewportCommand);
  const viewportProjectionMode = useViewerStore((state) => state.viewportProjectionMode);
  const {
    manifest,
    residentChunkIds,
    visibleChunkIds,
    chunksById,
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
    spatialTree,
    activeClassFilter,
    activeTypeFilter,
    activeStoreyFilter,
  } = useWebIfc();

  const {
    entitySummaries,
    effectiveHiddenIdSet,
    effectiveHiddenIds,
  } = useViewportEntityFilters(spatialTree, activeClassFilter, activeTypeFilter, activeStoreyFilter);

  useChunkResidency(
    currentModelId, manifest, residentChunkIds, visibleChunkIds,
    selectedEntityIds, activeStoreyFilter, activeTypeFilter, activeClassFilter,
  );

  useEffect(() => {
    if (selectedEntityIds.length === 0) return;
    const visibleSelectedIds = selectedEntityIds.filter((id) => !effectiveHiddenIdSet.has(id));
    if (visibleSelectedIds.length !== selectedEntityIds.length) {
      setSelectedEntityIds(visibleSelectedIds);
    }
  }, [effectiveHiddenIdSet, selectedEntityIds, setSelectedEntityIds]);

  const residentChunks = useMemo(
    () => residentChunkIds
      .map((chunkId) => chunksById[chunkId])
      .filter((chunk): chunk is RenderChunkPayload => Boolean(chunk)),
    [chunksById, residentChunkIds],
  );

  const emptyState = useMemo(() => {
    if (error) return { tone: 'error' as const, title: '모델을 불러오지 못했습니다', description: error, hint: '다른 IFC 파일로 다시 시도하거나 엔진 상태와 worker 로그를 확인해 주세요.' };
    if (loading) return { tone: 'loading' as const, title: '모델을 준비하고 있습니다', description: progress, hint: 'render cache와 spatial tree를 순서대로 준비하는 중입니다.' };
    if (engineState !== 'ready') return { tone: 'idle' as const, title: '엔진 준비가 필요합니다', description: engineMessage, hint: '헤더에서 엔진을 초기화한 뒤 IFC 파일을 열면 바로 3D 뷰가 표시됩니다.' };
    if (!currentFileName) return { tone: 'idle' as const, title: 'IFC 파일을 열어 주세요', description: '모델이 아직 로드되지 않았습니다.', hint: '헤더의 열기 버튼으로 IFC 파일을 선택하면 뷰포트와 패널이 함께 채워집니다.' };
    return { tone: 'idle' as const, title: '렌더 청크를 준비하고 있습니다', description: '모델 메타데이터는 열렸지만 아직 현재 시야에 필요한 청크가 로드되지 않았습니다.', hint: '대형 IFC의 경우 첫 시야에 필요한 청크만 우선 올립니다.' };
  }, [currentFileName, engineMessage, engineState, error, loading, progress]);

  const handleSelectEntity = useCallback((expressId: number | null, additive = false) => {
    if (!additive) { setSelectedEntityId(expressId); return; }
    if (expressId === null) return;
    const next = selectedEntityIds.includes(expressId)
      ? selectedEntityIds.filter((id) => id !== expressId)
      : [...selectedEntityIds, expressId];
    setSelectedEntityIds(next);
  }, [selectedEntityIds, setSelectedEntityId, setSelectedEntityIds]);

  const handleVisibleChunkIdsChange = useCallback((nextVisibleChunkIds: number[]) => {
    viewportGeometryStore.setVisibleChunkIds(nextVisibleChunkIds);
  }, []);

  const handleHoverEntity = useCallback((expressId: number | null, position: { x: number; y: number } | null) => {
    if (expressId === null || position === null) { setHoverInfo(null); return; }
    setHoverInfo((prev) => {
      if (prev && prev.expressId === expressId &&
          Math.abs(prev.x - position.x) < 8 && Math.abs(prev.y - position.y) < 8) {
        return prev;
      }
      return { expressId, x: position.x, y: position.y };
    });
  }, []);

  const handleContextMenu = useCallback((expressId: number | null, position: { x: number; y: number }) => {
    setContextMenu({ expressId, x: position.x, y: position.y });
  }, []);

  const handleContextMenuHide = useCallback((expressId: number) => {
    useViewerStore.getState().hideEntity(expressId);
    useViewerStore.getState().clearSelection();
  }, []);

  const handleContextMenuIsolate = useCallback((expressId: number) => {
    const allIds = [...new Set(manifest?.chunks.flatMap((chunk) => chunk.entityIds) ?? [])];
    useViewerStore.getState().isolateEntities([expressId], allIds);
  }, [manifest]);

  const handleContextMenuShowAll = useCallback(() => {
    useViewerStore.getState().resetHiddenEntities();
  }, []);

  const handleContextMenuFitSelected = useCallback(() => {
    useViewerStore.getState().runViewportCommand('fit-selected');
  }, []);

  const hoverSummary = hoverInfo ? entitySummaries.get(hoverInfo.expressId) : null;

  return (
    <section className="viewport">
      <div className="viewport-label">Viewport</div>
      <div className="relative flex-auto w-full h-full min-h-0 overflow-hidden bg-transparent">
        {manifest ? (
          <ViewportScene
            manifest={manifest}
            residentChunks={residentChunks}
            chunkVersion={geometryVersion}
            selectedEntityIds={selectedEntityIds}
            hiddenEntityIds={effectiveHiddenIds}
            projectionMode={viewportProjectionMode}
            viewportCommand={viewportCommand}
            onSelectEntity={handleSelectEntity}
            onVisibleChunkIdsChange={handleVisibleChunkIdsChange}
            onHoverEntity={handleHoverEntity}
            onContextMenu={handleContextMenu}
          />
        ) : (
          <div className={clsx(
            'viewport-empty',
            emptyStateTone[emptyState.tone],
          )}>
            <h1 className="m-0 text-text text-[clamp(1.9rem,3vw,2.6rem)] leading-[1.05] dark:text-slate-100">{emptyState.title}</h1>
            <p className="m-0 max-w-[560px] text-text-secondary">{emptyState.description}</p>
            <p className="m-0 max-w-[560px] text-text-secondary">{emptyState.hint}</p>
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
