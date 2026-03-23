import { ChevronDown, ChevronUp } from 'lucide-react';
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

const metaCardClass = "grid gap-1 min-w-0 px-3 py-[11px] border border-border-subtle rounded-[14px] bg-white/95 shadow-[0_8px_20px_rgba(148,163,184,0.07)] dark:border-slate-600 dark:bg-slate-800/82";

export function ViewportContainer() {
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ expressId: number; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
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
    meshes,
  } = useViewportGeometry();
  const {
    loading,
    progress,
    geometryResult,
    error,
    engineState,
    engineMessage,
    currentFileName,
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
    spatialTree,
    activeClassFilter,
    activeTypeFilter,
    activeStoreyFilter,
  } = useWebIfc();

  const hasRenderableGeometry = meshes.length > 0;

  const {
    entitySummaries,
    effectiveHiddenIdSet,
    effectiveHiddenIds,
    activeFilterSummary,
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
    setHoverInfo({ expressId, x: position.x, y: position.y });
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
    <section className="relative flex flex-col overflow-hidden min-w-0 min-h-0 w-full h-full p-0 bg-gradient-to-b from-[#fbfdff] to-[#f6f8fc] dark:bg-slate-800 dark:from-slate-800 dark:to-slate-800">
      <div className="absolute top-4 left-4 px-2.5 py-1.5 border border-border-subtle rounded-full bg-white/80 text-text-secondary text-[0.8125rem] font-bold dark:text-slate-600">Viewport</div>
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
            'absolute inset-0 grid content-center justify-items-start gap-2 p-14 bg-gradient-to-b dark:border-slate-700 dark:bg-slate-800/82 dark:text-slate-400',
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
        <div className="absolute right-6 bottom-4 left-6">
          <div className="absolute right-[12rem] bottom-0 left-[12rem] grid gap-2 content-end">
            <button
              type="button"
              className="flex items-center justify-between gap-3 px-3 py-2 border border-slate-300/96 rounded-xl bg-white/94 shadow-[0_10px_24px_rgba(15,23,42,0.08)] text-text dark:border-slate-600 dark:bg-slate-900/92"
              onClick={() => setDebugPanelOpen((current) => !current)}
            >
              <span className="text-xs font-bold">Debug Panel</span>
              <small className="ml-auto text-text-muted text-[0.66rem]">{debugPanelOpen ? '상태창 접기' : '상태창 펼치기'}</small>
              {debugPanelOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
            {debugPanelOpen && (
              <div className="grid gap-2">
                <div className="grid grid-cols-4 gap-2 max-[1080px]:grid-cols-2 max-[720px]:grid-cols-1">
                  <div className={metaCardClass}>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight">엔진 상태</span>
                    <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text text-[0.9rem] leading-tight dark:text-slate-200">{engineState}</strong>
                    <small className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight dark:text-slate-500">{engineMessage}</small>
                  </div>
                  <div className={metaCardClass}>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight">로딩 상태</span>
                    <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text text-[0.9rem] leading-tight dark:text-slate-200">{loading ? '진행 중' : '대기'}</strong>
                    <small className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight dark:text-slate-500">{progress}</small>
                  </div>
                  <div className={metaCardClass}>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight">모델 상태</span>
                    <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text text-[0.9rem] leading-tight dark:text-slate-200">{hasRenderableGeometry ? '렌더링 준비 완료' : '대기 중'}</strong>
                    <small className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight dark:text-slate-500">
                      {geometryResult.ready
                        ? `${geometryResult.meshCount} meshes / ${geometryResult.vertexCount} vertices / ${geometryResult.indexCount} indices`
                        : 'IFC 파일을 열면 viewport가 채워집니다.'}
                    </small>
                  </div>
                  <div className={metaCardClass}>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight">선택 상태</span>
                    <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text text-[0.9rem] leading-tight dark:text-slate-200">
                      {selectedEntityIds.length > 0
                        ? `${selectedEntityIds.length} selected${selectedEntityId !== null ? ` · primary #${selectedEntityId}` : ''}`
                        : '없음'}
                    </strong>
                    <small className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight dark:text-slate-500">
                      {activeFilterSummary
                        ? `필터 적용 중 · ${activeFilterSummary}`
                        : '3D 객체 클릭 또는 좌측 패널 선택'}
                    </small>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2 max-[1080px]:grid-cols-2 max-[720px]:grid-cols-1">
                  <div className={metaCardClass}>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight">파일명</span>
                    <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text text-[0.9rem] leading-tight dark:text-slate-200">{currentFileName ?? '-'}</strong>
                    <small className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight dark:text-slate-500">선택된 IFC 파일</small>
                  </div>
                  <div className={metaCardClass}>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight">Model ID</span>
                    <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text text-[0.9rem] leading-tight dark:text-slate-200">{currentModelId ?? '-'}</strong>
                    <small className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight dark:text-slate-500">worker OpenModel 결과</small>
                  </div>
                  <div className={metaCardClass}>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight">Schema</span>
                    <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text text-[0.9rem] leading-tight dark:text-slate-200">{currentModelSchema ?? '-'}</strong>
                    <small className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight dark:text-slate-500">GetModelSchema 결과</small>
                  </div>
                  <div className={metaCardClass}>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight">MaxExpressID</span>
                    <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text text-[0.9rem] leading-tight dark:text-slate-200">{currentModelMaxExpressId ?? '-'}</strong>
                    <small className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight dark:text-slate-500">GetMaxExpressID 결과</small>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2 max-[1080px]:grid-cols-2 max-[720px]:grid-cols-1">
                  <div className={metaCardClass}>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight">Chunk 상태</span>
                    <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text text-[0.9rem] leading-tight dark:text-slate-200">{residentChunkIds.length} resident / {manifest?.chunkCount ?? 0}</strong>
                    <small className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.66rem] leading-tight dark:text-slate-500">{visibleChunkIds.length} visible chunk target</small>
                  </div>
                </div>
                {error && <p className="mt-[18px] text-error">{error}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
