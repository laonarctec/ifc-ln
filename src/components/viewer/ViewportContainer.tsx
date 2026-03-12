import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWebIfc } from '@/hooks/useWebIfc';
import { ifcWorkerClient } from '@/services/IfcWorkerClient';
import { useViewportGeometry, viewportGeometryStore } from '@/services/viewportGeometryStore';
import { useViewerStore } from '@/stores';
import type { IfcSpatialNode, RenderChunkPayload, RenderManifest } from '@/types/worker-messages';
import { resolveIfcClass } from '@/utils/ifc-class';
import { ViewportScene } from './ViewportScene';

function findStoreyNode(nodes: IfcSpatialNode[], targetStoreyId: number): IfcSpatialNode | null {
  for (const node of nodes) {
    if (node.expressID === targetStoreyId) {
      return node;
    }

    const childMatch = findStoreyNode(node.children, targetStoreyId);
    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

function collectRenderableNodeEntityIds(
  node: IfcSpatialNode,
  renderableEntityIds: Set<number>,
  result = new Set<number>()
) {
  if (renderableEntityIds.has(node.expressID)) {
    result.add(node.expressID);
  }

  node.elements?.forEach((element) => {
    if (renderableEntityIds.has(element.expressID)) {
      result.add(element.expressID);
    }
  });

  node.children.forEach((child) => {
    collectRenderableNodeEntityIds(child, renderableEntityIds, result);
  });

  return result;
}

function collectSpatialEntitySummary(nodes: IfcSpatialNode[], result = new Map<number, { ifcType: string; name: string | null }>()) {
  nodes.forEach((node) => {
    node.elements?.forEach((element) => {
      if (!result.has(element.expressID)) {
        result.set(element.expressID, {
          ifcType: element.ifcType,
          name: element.name ?? null,
        });
      }
    });

    collectSpatialEntitySummary(node.children, result);
  });

  return result;
}

function buildChunkEntityIndex(manifest: RenderManifest | null) {
  const entityToChunkIds = new Map<number, number[]>();

  manifest?.chunks.forEach((chunk) => {
    chunk.entityIds.forEach((entityId) => {
      if (!entityToChunkIds.has(entityId)) {
        entityToChunkIds.set(entityId, []);
      }
      entityToChunkIds.get(entityId)!.push(chunk.chunkId);
    });
  });

  return entityToChunkIds;
}

export function ViewportContainer() {
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const selectedEntityIds = useViewerStore((state) => state.selectedEntityIds);
  const setSelectedEntityId = useViewerStore((state) => state.setSelectedEntityId);
  const setSelectedEntityIds = useViewerStore((state) => state.setSelectedEntityIds);
  const hiddenEntityIds = useViewerStore((state) => state.hiddenEntityIds);
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
  const releaseTimersRef = useRef<Map<number, number>>(new Map());
  const loadingChunkIdsRef = useRef<Set<number>>(new Set());

  const entitySummaries = useMemo(() => collectSpatialEntitySummary(spatialTree), [spatialTree]);
  const entityIds = useMemo(() => [...entitySummaries.keys()], [entitySummaries]);
  const renderableEntityIdSet = useMemo(() => new Set(entityIds), [entityIds]);
  const entityToChunkIds = useMemo(() => buildChunkEntityIndex(manifest), [manifest]);
  const hasRenderableGeometry = meshes.length > 0;

  const emptyState = useMemo(() => {
    if (error) {
      return {
        tone: 'error' as const,
        title: '모델을 불러오지 못했습니다',
        description: error,
        hint: '다른 IFC 파일로 다시 시도하거나 엔진 상태와 worker 로그를 확인해 주세요.',
      };
    }

    if (loading) {
      return {
        tone: 'loading' as const,
        title: '모델을 준비하고 있습니다',
        description: progress,
        hint: 'render cache와 spatial tree를 순서대로 준비하는 중입니다.',
      };
    }

    if (engineState !== 'ready') {
      return {
        tone: 'idle' as const,
        title: '엔진 준비가 필요합니다',
        description: engineMessage,
        hint: '헤더에서 엔진을 초기화한 뒤 IFC 파일을 열면 바로 3D 뷰가 표시됩니다.',
      };
    }

    if (!currentFileName) {
      return {
        tone: 'idle' as const,
        title: 'IFC 파일을 열어 주세요',
        description: '모델이 아직 로드되지 않았습니다.',
        hint: '헤더의 열기 버튼으로 IFC 파일을 선택하면 뷰포트와 패널이 함께 채워집니다.',
      };
    }

    return {
      tone: 'idle' as const,
      title: '렌더 청크를 준비하고 있습니다',
      description: '모델 메타데이터는 열렸지만 아직 현재 시야에 필요한 청크가 로드되지 않았습니다.',
      hint: '대형 IFC의 경우 첫 시야에 필요한 청크만 우선 올립니다.',
    };
  }, [currentFileName, engineMessage, engineState, error, loading, progress]);

  const filteredHiddenIds = useMemo(() => {
    if (entityIds.length === 0) {
      return [];
    }

    const hiddenByType =
      activeTypeFilter === null
        ? []
        : entityIds.filter((entityId) => entitySummaries.get(entityId)?.ifcType !== activeTypeFilter);

    const hiddenByClass =
      activeClassFilter === null
        ? []
        : entityIds.filter((entityId) => {
            const ifcType = entitySummaries.get(entityId)?.ifcType;
            return !ifcType || resolveIfcClass(ifcType) !== activeClassFilter;
          });

    const hiddenByStorey = (() => {
      if (activeStoreyFilter === null) {
        return [];
      }

      const storeyNode = findStoreyNode(spatialTree, activeStoreyFilter);
      if (!storeyNode) {
        return [];
      }

      const visibleIds = collectRenderableNodeEntityIds(storeyNode, renderableEntityIdSet);
      return entityIds.filter((entityId) => !visibleIds.has(entityId));
    })();

    return [...new Set([...hiddenByClass, ...hiddenByType, ...hiddenByStorey])];
  }, [
    activeClassFilter,
    activeStoreyFilter,
    activeTypeFilter,
    entityIds,
    entitySummaries,
    renderableEntityIdSet,
    spatialTree,
  ]);

  const effectiveHiddenIds = useMemo(
    () => [...new Set([...hiddenEntityIds, ...filteredHiddenIds])],
    [filteredHiddenIds, hiddenEntityIds]
  );
  const effectiveHiddenIdSet = useMemo(() => new Set(effectiveHiddenIds), [effectiveHiddenIds]);

  const activeFilterSummary = useMemo(() => {
    const segments: string[] = [];
    if (activeClassFilter) {
      segments.push(`class ${activeClassFilter}`);
    }
    if (activeTypeFilter) {
      segments.push(`type ${activeTypeFilter}`);
    }
    if (activeStoreyFilter) {
      segments.push(`storey ${activeStoreyFilter}`);
    }
    return segments.length > 0 ? segments.join(' · ') : null;
  }, [activeClassFilter, activeStoreyFilter, activeTypeFilter]);

  useEffect(() => {
    if (selectedEntityIds.length === 0) {
      return;
    }

    const visibleSelectedIds = selectedEntityIds.filter((entityId) => !effectiveHiddenIdSet.has(entityId));
    if (visibleSelectedIds.length !== selectedEntityIds.length) {
      setSelectedEntityIds(visibleSelectedIds);
    }
  }, [effectiveHiddenIdSet, selectedEntityIds, setSelectedEntityIds]);

  const desiredChunkIds = useMemo(() => {
    const desired = new Set<number>(manifest?.initialChunkIds ?? []);

    visibleChunkIds.forEach((chunkId) => desired.add(chunkId));

    selectedEntityIds.forEach((entityId) => {
      entityToChunkIds.get(entityId)?.forEach((chunkId) => desired.add(chunkId));
    });

    if (activeStoreyFilter !== null) {
      manifest?.chunks.forEach((chunk) => {
        if (chunk.storeyId === activeStoreyFilter) {
          desired.add(chunk.chunkId);
        }
      });
    }

    if (activeTypeFilter !== null) {
      manifest?.chunks.forEach((chunk) => {
        if (chunk.ifcTypes.includes(activeTypeFilter)) {
          desired.add(chunk.chunkId);
        }
      });
    }

    if (activeClassFilter !== null) {
      manifest?.chunks.forEach((chunk) => {
        if (chunk.ifcTypes.some((ifcType) => resolveIfcClass(ifcType) === activeClassFilter)) {
          desired.add(chunk.chunkId);
        }
      });
    }

    return [...desired].sort((left, right) => left - right);
  }, [
    activeClassFilter,
    activeStoreyFilter,
    activeTypeFilter,
    entityToChunkIds,
    manifest,
    selectedEntityIds,
    visibleChunkIds,
  ]);

  useEffect(() => {
    if (currentModelId === null || manifest === null) {
      releaseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      releaseTimersRef.current.clear();
      loadingChunkIdsRef.current.clear();
      return;
    }

    const residentSet = new Set(residentChunkIds);
    const desiredSet = new Set(desiredChunkIds);

    desiredChunkIds.forEach((chunkId) => {
      const timerId = releaseTimersRef.current.get(chunkId);
      if (timerId) {
        window.clearTimeout(timerId);
        releaseTimersRef.current.delete(chunkId);
      }
    });

    const missingChunkIds = desiredChunkIds.filter(
      (chunkId) => !residentSet.has(chunkId) && !loadingChunkIdsRef.current.has(chunkId)
    );

    if (missingChunkIds.length > 0) {
      missingChunkIds.forEach((chunkId) => loadingChunkIdsRef.current.add(chunkId));
      void ifcWorkerClient.loadRenderChunks(currentModelId, missingChunkIds)
        .then((result) => {
          viewportGeometryStore.upsertChunks(result.chunks);
        })
        .catch((loadError) => {
          console.error(loadError);
        })
        .finally(() => {
          missingChunkIds.forEach((chunkId) => loadingChunkIdsRef.current.delete(chunkId));
        });
    }

    residentChunkIds
      .filter((chunkId) => !desiredSet.has(chunkId))
      .forEach((chunkId) => {
        if (releaseTimersRef.current.has(chunkId)) {
          return;
        }

        const timerId = window.setTimeout(() => {
          viewportGeometryStore.releaseChunks([chunkId]);
          if (currentModelId !== null) {
            void ifcWorkerClient.releaseRenderChunks(currentModelId, [chunkId]).catch((releaseError) => {
              console.error(releaseError);
            });
          }
          releaseTimersRef.current.delete(chunkId);
        }, 2000);

        releaseTimersRef.current.set(chunkId, timerId);
      });
  }, [currentModelId, desiredChunkIds, manifest, residentChunkIds]);

  const residentChunks = useMemo(
    () => residentChunkIds
      .map((chunkId) => chunksById[chunkId])
      .filter((chunk): chunk is RenderChunkPayload => Boolean(chunk)),
    [chunksById, residentChunkIds]
  );

  const handleSelectEntity = useCallback((expressId: number | null, additive = false) => {
    if (!additive) {
      setSelectedEntityId(expressId);
      return;
    }

    if (expressId === null) {
      return;
    }

    const next = selectedEntityIds.includes(expressId)
      ? selectedEntityIds.filter((entityId) => entityId !== expressId)
      : [...selectedEntityIds, expressId];
    setSelectedEntityIds(next);
  }, [selectedEntityIds, setSelectedEntityId, setSelectedEntityIds]);

  const handleVisibleChunkIdsChange = useCallback((nextVisibleChunkIds: number[]) => {
    viewportGeometryStore.setVisibleChunkIds(nextVisibleChunkIds);
  }, []);

  return (
    <section className="viewer-viewport">
      <div className="viewer-viewport__label">Viewport</div>
      <div className="viewer-viewport__surface">
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
          />
        ) : (
          <div className={`viewer-viewport__empty-state viewer-viewport__empty-state--${emptyState.tone}`}>
            <h1>{emptyState.title}</h1>
            <p>{emptyState.description}</p>
            <p>{emptyState.hint}</p>
          </div>
        )}
        <div className="viewer-viewport__overlay">
          <div className={`viewer-viewport__debug-panel${debugPanelOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="viewer-viewport__debug-toggle"
              onClick={() => setDebugPanelOpen((current) => !current)}
            >
              <span>Debug Panel</span>
              <small>
                {debugPanelOpen ? '상태창 접기' : '상태창 펼치기'}
              </small>
              {debugPanelOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
            {debugPanelOpen && (
              <div className="viewer-viewport__debug-body">
                <div className="viewer-viewport__meta-grid">
                  <div className="viewer-viewport__meta-card">
                    <span>엔진 상태</span>
                    <strong>{engineState}</strong>
                    <small>{engineMessage}</small>
                  </div>
                  <div className="viewer-viewport__meta-card">
                    <span>로딩 상태</span>
                    <strong>{loading ? '진행 중' : '대기'}</strong>
                    <small>{progress}</small>
                  </div>
                  <div className="viewer-viewport__meta-card">
                    <span>모델 상태</span>
                    <strong>{hasRenderableGeometry ? '렌더링 준비 완료' : '대기 중'}</strong>
                    <small>
                      {geometryResult.ready
                        ? `${geometryResult.meshCount} meshes / ${geometryResult.vertexCount} vertices / ${geometryResult.indexCount} indices`
                        : 'IFC 파일을 열면 viewport가 채워집니다.'}
                    </small>
                  </div>
                  <div className="viewer-viewport__meta-card">
                    <span>선택 상태</span>
                    <strong>
                      {selectedEntityIds.length > 0
                        ? `${selectedEntityIds.length} selected${selectedEntityId !== null ? ` · primary #${selectedEntityId}` : ''}`
                        : '없음'}
                    </strong>
                    <small>
                      {activeFilterSummary
                        ? `필터 적용 중 · ${activeFilterSummary}`
                        : '3D 객체 클릭 또는 좌측 패널 선택'}
                    </small>
                  </div>
                </div>
                <div className="viewer-viewport__meta-grid viewer-viewport__meta-grid--secondary">
                  <div className="viewer-viewport__meta-card">
                    <span>파일명</span>
                    <strong>{currentFileName ?? '-'}</strong>
                    <small>선택된 IFC 파일</small>
                  </div>
                  <div className="viewer-viewport__meta-card">
                    <span>Model ID</span>
                    <strong>{currentModelId ?? '-'}</strong>
                    <small>worker OpenModel 결과</small>
                  </div>
                  <div className="viewer-viewport__meta-card">
                    <span>Schema</span>
                    <strong>{currentModelSchema ?? '-'}</strong>
                    <small>GetModelSchema 결과</small>
                  </div>
                  <div className="viewer-viewport__meta-card">
                    <span>MaxExpressID</span>
                    <strong>{currentModelMaxExpressId ?? '-'}</strong>
                    <small>GetMaxExpressID 결과</small>
                  </div>
                </div>
                <div className="viewer-viewport__meta-grid viewer-viewport__meta-grid--secondary">
                  <div className="viewer-viewport__meta-card">
                    <span>Chunk 상태</span>
                    <strong>{residentChunkIds.length} resident / {manifest?.chunkCount ?? 0}</strong>
                    <small>{visibleChunkIds.length} visible chunk target</small>
                  </div>
                </div>
                {error && <p className="viewer-viewport__error">오류: {error}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
