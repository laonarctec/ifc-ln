import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useWebIfc } from '@/hooks/useWebIfc';
import { useViewportGeometry } from '@/services/viewportGeometryStore';
import { useViewerStore } from '@/stores';
import type { IfcSpatialNode } from '@/types/worker-messages';
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

function collectDescendantIds(node: IfcSpatialNode, result = new Set<number>()) {
  result.add(node.expressID);
  node.children.forEach((child) => collectDescendantIds(child, result));
  return result;
}

export function ViewportContainer() {
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const setSelectedEntityId = useViewerStore((state) => state.setSelectedEntityId);
  const hiddenEntityIds = useViewerStore((state) => state.hiddenEntityIds);
  const viewportCommand = useViewerStore((state) => state.viewportCommand);
  const { meshes } = useViewportGeometry();
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
  const hasRenderableGeometry = geometryResult.ready && meshes.length > 0;
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
        hint: 'geometry와 spatial tree를 순서대로 준비하는 중입니다.',
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
      title: '렌더링 데이터를 기다리는 중입니다',
      description: '모델 메타데이터는 열렸지만 아직 표시 가능한 geometry가 준비되지 않았습니다.',
      hint: '대형 IFC의 경우 geometry 준비에 시간이 더 걸릴 수 있습니다.',
    };
  }, [currentFileName, engineMessage, engineState, error, loading, progress]);
  const entityIds = useMemo(() => [...new Set(meshes.map((mesh) => mesh.expressId))], [meshes]);
  const filteredHiddenIds = useMemo(() => {
    if (!hasRenderableGeometry) {
      return [];
    }

    const hiddenByType =
      activeTypeFilter === null
        ? []
        : meshes.filter((mesh) => mesh.ifcType !== activeTypeFilter).map((mesh) => mesh.expressId);

    const hiddenByClass =
      activeClassFilter === null
        ? []
        : meshes
            .filter((mesh) => resolveIfcClass(mesh.ifcType) !== activeClassFilter)
            .map((mesh) => mesh.expressId);

    const hiddenByStorey = (() => {
      if (activeStoreyFilter === null) {
        return [];
      }

      const storeyNode = findStoreyNode(spatialTree, activeStoreyFilter);
      if (!storeyNode) {
        return [];
      }

      const visibleIds = collectDescendantIds(storeyNode);
      return meshes
        .filter((mesh) => !visibleIds.has(mesh.expressId))
        .map((mesh) => mesh.expressId);
    })();

    return [...new Set([...hiddenByClass, ...hiddenByType, ...hiddenByStorey])];
  }, [activeClassFilter, activeStoreyFilter, activeTypeFilter, hasRenderableGeometry, meshes, spatialTree]);
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
    if (selectedEntityId === null) {
      return;
    }

    if (effectiveHiddenIdSet.has(selectedEntityId)) {
      setSelectedEntityId(null);
    }
  }, [effectiveHiddenIdSet, selectedEntityId, setSelectedEntityId]);

  return (
    <section className="viewer-viewport">
      <div className="viewer-viewport__label">Viewport</div>
      <div className="viewer-viewport__surface">
        {hasRenderableGeometry ? (
          <ViewportScene
            meshes={meshes}
            selectedEntityId={selectedEntityId}
            hiddenEntityIds={effectiveHiddenIds}
            viewportCommand={viewportCommand}
            onSelectEntity={setSelectedEntityId}
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
                    <strong>{selectedEntityId ?? '없음'}</strong>
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
                {error && <p className="viewer-viewport__error">오류: {error}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
