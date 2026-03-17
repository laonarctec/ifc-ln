import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Boxes,
  Building2,
  Eye,
  EyeOff,
  Focus,
  FolderTree,
  Layers3,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ifcWorkerClient } from '@/services/IfcWorkerClient';
import { useViewerStore } from '@/stores';
import type { IfcSpatialNode } from '@/types/worker-messages';
import { HierarchyNode } from './hierarchy/HierarchyNode';
import type { GroupingMode, TreeNode } from './hierarchy/types';
import { COUNT_FORMATTER, ROW_HEIGHT, OVERSCAN } from './hierarchy/types';
import {
  collectNodeEntityIds,
  collectSpatialEntities,
  findNodeById,
  formatIfcType,
  getNodeName,
} from './hierarchy/treeDataBuilder';
import { useHierarchyPanelData } from './hierarchy/useHierarchyPanelData';
import { useHierarchyTree } from './hierarchy/useHierarchyTree';

export function HierarchyPanel() {
  const {
    selectedEntityId,
    selectedEntityIds,
    setSelectedEntityId,
    setSelectedEntityIds,
    toggleSelectedEntityId,
    clearSelection,
    hiddenEntityIds,
    hideEntity,
    showEntity,
    resetHiddenEntities,
    isolateEntities,
    runViewportCommand,
    setActiveClassFilter,
    setActiveTypeFilter,
    setActiveStoreyFilter,
  } = useViewerStore(useShallow((state) => ({
    selectedEntityId: state.selectedEntityId,
    selectedEntityIds: state.selectedEntityIds,
    setSelectedEntityId: state.setSelectedEntityId,
    setSelectedEntityIds: state.setSelectedEntityIds,
    toggleSelectedEntityId: state.toggleSelectedEntityId,
    clearSelection: state.clearSelection,
    hiddenEntityIds: state.hiddenEntityIds,
    hideEntity: state.hideEntity,
    showEntity: state.showEntity,
    resetHiddenEntities: state.resetHiddenEntities,
    isolateEntities: state.isolateEntities,
    runViewportCommand: state.runViewportCommand,
    setActiveClassFilter: state.setActiveClassFilter,
    setActiveTypeFilter: state.setActiveTypeFilter,
    setActiveStoreyFilter: state.setActiveStoreyFilter,
  })));

  const {
    currentModelId,
    spatialTree,
    typeTree,
    activeClassFilter,
    activeTypeFilter,
    activeStoreyFilter,
  } = useHierarchyPanelData();

  const entityIds = useMemo(
    () => [...collectSpatialEntities(spatialTree).keys()],
    [spatialTree]
  );
  const entityIdSet = useMemo(() => new Set(entityIds), [entityIds]);
  const selectedEntityIdSet = useMemo(() => new Set(selectedEntityIds), [selectedEntityIds]);
  const [selectedSpatialNodeIds, setSelectedSpatialNodeIds] = useState<Set<number>>(() => new Set());

  const {
    groupingMode,
    setGroupingMode,
    searchQuery,
    setSearchQuery,
    treeNodes,
    filteredSpatialNodes,
    entities,
    toggleExpand,
    totalNodeCount,
  } = useHierarchyTree({
    spatialTree,
    typeTree,
    selectedEntityIds: selectedEntityIdSet,
    entityIdSet,
  });

  // Type tree lazy loading
  useEffect(() => {
    if (groupingMode !== 'type' || currentModelId === null || typeTree.length > 0) {
      return;
    }

    const allEntityIds = [...collectSpatialEntities(spatialTree).keys()];
    if (allEntityIds.length === 0) {
      return;
    }

    let cancelled = false;
    void ifcWorkerClient.getTypeTree(currentModelId, allEntityIds).then((result) => {
      if (cancelled) {
        return;
      }

      useViewerStore.getState().setTypeTree(result.groups);
    }).catch((error) => {
      console.error(error);
    });

    return () => {
      cancelled = true;
    };
  }, [groupingMode, currentModelId, spatialTree, typeTree.length]);

  const hasSpatialTree = filteredSpatialNodes.length > 0 && filteredSpatialNodes[0]?.expressID !== 0;

  // Storey scope
  const activeStoreyNode = useMemo(
    () => (activeStoreyFilter === null ? null : findNodeById(spatialTree, activeStoreyFilter)),
    [activeStoreyFilter, spatialTree]
  );
  const activeStoreyLabel = useMemo(() => {
    if (!activeStoreyNode) return null;
    return getNodeName(activeStoreyNode) ?? `Storey #${activeStoreyNode.expressID}`;
  }, [activeStoreyNode]);
  const activeStoreyEntityIds = useMemo(
    () => (activeStoreyNode ? collectNodeEntityIds(activeStoreyNode, entityIdSet) : []),
    [activeStoreyNode, entityIdSet]
  );

  // --- Active filters ---
  const hasActiveFilters = activeStoreyFilter !== null || activeClassFilter !== null || activeTypeFilter !== null;

  // --- Virtual scroll ---
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: treeNodes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  // Scroll-to-selected
  useEffect(() => {
    if (selectedEntityId === null || !scrollRef.current) {
      return;
    }

    const targetNodeId =
      groupingMode === 'spatial'
        ? treeNodes.some((n) => n.id === `spatial-${selectedEntityId}`)
          ? `spatial-${selectedEntityId}`
          : `spatial-element-${selectedEntityId}`
        : groupingMode === 'class'
          ? `class-entity-${selectedEntityId}`
          : `type-entity-${selectedEntityId}`;

    const targetIndex = treeNodes.findIndex((n) => n.id === targetNodeId);
    if (targetIndex < 0) {
      return;
    }

    const container = scrollRef.current;
    const rowTop = targetIndex * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const viewportTop = container.scrollTop;
    const viewportBottom = viewportTop + container.clientHeight;

    if (rowTop < viewportTop || rowBottom > viewportBottom) {
      const nextTop = Math.max(0, rowTop - Math.max(ROW_HEIGHT * 2, container.clientHeight / 3));
      container.scrollTo({ top: nextTop, behavior: 'smooth' });
    }
  }, [groupingMode, treeNodes, selectedEntityId]);

  // --- ESC key to clear all filters ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hasActiveFilters) {
        e.preventDefault();
        clearSemanticFilters();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasActiveFilters]);

  // --- Semantic filters ---
  const clearSemanticFilters = useCallback(() => {
    setActiveClassFilter(null);
    setActiveTypeFilter(null);
    setActiveStoreyFilter(null);
  }, [setActiveClassFilter, setActiveTypeFilter, setActiveStoreyFilter]);

  const clearStoreyFilter = useCallback(() => {
    setActiveStoreyFilter(null);
  }, [setActiveStoreyFilter]);

  // --- Handlers ---
  const handleEntitySelection = useCallback((entityId: number | null, additive = false) => {
    if (entityId === null) {
      setSelectedSpatialNodeIds(new Set());
      clearSelection();
      return;
    }

    if (additive) {
      toggleSelectedEntityId(entityId);
      return;
    }

    setSelectedSpatialNodeIds(new Set());
    setSelectedEntityId(entityId);
  }, [clearSelection, setSelectedEntityId, toggleSelectedEntityId]);

  const handleSpatialNodeSelection = useCallback((nodeId: number, additive = false) => {
    setSelectedSpatialNodeIds((current) => {
      const next = additive ? new Set(current) : new Set<number>();
      if (additive && next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleSpatialNodeClick = useCallback((
    node: IfcSpatialNode,
    targetEntityId: number | null,
    additive = false
  ) => {
    handleSpatialNodeSelection(node.expressID, additive);
    handleEntitySelection(targetEntityId ?? node.expressID, additive);
    if (node.type === 'IFCBUILDINGSTOREY') {
      const isToggleOff = activeStoreyFilter === node.expressID;
      setActiveStoreyFilter(isToggleOff ? null : node.expressID);

      if (!isToggleOff) {
        // Auto-isolate storey entities
        const storeyTreeNode = findNodeById(spatialTree, node.expressID);
        if (storeyTreeNode) {
          const storeyEntityIds = collectNodeEntityIds(storeyTreeNode, entityIdSet);
          if (storeyEntityIds.length > 0) {
            isolateEntities(storeyEntityIds, entityIds);
          }
        }
      }
    }
  }, [handleSpatialNodeSelection, handleEntitySelection, activeStoreyFilter, setActiveStoreyFilter,
    spatialTree, entityIdSet, entityIds, isolateEntities]);

  const handleNodeClick = useCallback((node: TreeNode, event: React.MouseEvent) => {
    console.log('[handleNodeClick] node.type:', node.type, 'node.id:', node.id, 'entityIds:', node.entityIds.length, 'groupingMode:', groupingMode);
    const additive = event.shiftKey;

    if (node.spatialNode) {
      // Spatial node: determine primary entity
      const primaryEntityId = entityIdSet.has(node.expressId)
        ? node.expressId
        : node.entityIds[0] ?? null;
      handleSpatialNodeClick(node.spatialNode, primaryEntityId, additive);
      return;
    }

    // Type-group nodes in class mode: apply class filter + select first element
    if (node.type === 'type-group' && groupingMode === 'class') {
      if (node.entityIds.length > 0) {
        setSelectedEntityIds([]);
        setActiveClassFilter(node.ifcType ?? null);
        handleEntitySelection(node.entityIds[0]);
      }
      toggleExpand(node.id);
      return;
    }

    // Type-group nodes in type mode: apply type filter + isolate
    if (node.type === 'type-group' && groupingMode === 'type') {
      if (node.entityIds.length > 0) {
        setSelectedEntityIds([]);
        setActiveTypeFilter(node.ifcType ?? null);
        isolateEntities(node.entityIds, entityIds);
      }
      toggleExpand(node.id);
      return;
    }

    // Type-family nodes: select type entity + isolate instances
    if (node.type === 'type-family') {
      if (node.entityExpressId) {
        setSelectedEntityId(node.entityExpressId);
      }
      if (node.entityIds.length > 0) {
        isolateEntities(node.entityIds, entityIds);
        setActiveTypeFilter(node.ifcType ?? null);
      }
      toggleExpand(node.id);
      return;
    }

    if (node.type === 'element') {
      handleEntitySelection(node.expressId, additive);
      return;
    }

    // Group nodes: toggle expand
    toggleExpand(node.id);
  }, [entityIdSet, handleSpatialNodeClick, groupingMode, toggleExpand, entityIds,
    setActiveClassFilter, setActiveTypeFilter, isolateEntities, handleEntitySelection, setSelectedEntityIds]);

  const handleGroupIsolate = useCallback((targetEntityIds: number[]) => {
    console.log('[handleGroupIsolate] targetEntityIds:', targetEntityIds.length, 'entityIds:', entityIds.length);
    setSelectedSpatialNodeIds(new Set());
    clearSemanticFilters();
    clearSelection();
    isolateEntities(targetEntityIds, entityIds);
  }, [clearSemanticFilters, clearSelection, isolateEntities, entityIds]);

  const handleEntityFocus = useCallback((entityId: number) => {
    setSelectedSpatialNodeIds(new Set());
    clearSemanticFilters();
    handleEntitySelection(entityId);
    runViewportCommand('fit-selected');
  }, [clearSemanticFilters, handleEntitySelection, runViewportCommand]);

  const handleResetGroupView = useCallback(() => {
    clearSemanticFilters();
    resetHiddenEntities();
  }, [clearSemanticFilters, resetHiddenEntities]);

  const handleVisibilityToggle = useCallback((targetEntityIds: number[]) => {
    if (targetEntityIds.length === 0) {
      return;
    }

    const allHidden = targetEntityIds.every((id) => hiddenEntityIds.has(id));

    if (allHidden) {
      targetEntityIds.forEach((id) => showEntity(id));
      return;
    }

    targetEntityIds.forEach((id) => hideEntity(id));
    if (selectedEntityIds.some((id) => targetEntityIds.includes(id))) {
      setSelectedEntityIds(selectedEntityIds.filter((id) => !targetEntityIds.includes(id)));
    }
  }, [hiddenEntityIds, showEntity, hideEntity, selectedEntityIds, setSelectedEntityIds]);

  const handleStoreyScopeSelect = useCallback(() => {
    if (activeStoreyFilter === null) return;

    if (activeStoreyEntityIds.length > 0) {
      setSelectedSpatialNodeIds(new Set());
      setSelectedEntityIds(activeStoreyEntityIds);
      return;
    }

    handleEntitySelection(activeStoreyFilter);
  }, [activeStoreyFilter, activeStoreyEntityIds, setSelectedEntityIds, handleEntitySelection]);

  const handleStoreyScopeIsolate = useCallback(() => {
    if (activeStoreyFilter === null || activeStoreyEntityIds.length === 0) return;

    setSelectedSpatialNodeIds(new Set());
    setActiveClassFilter(null);
    setActiveTypeFilter(null);
    setSelectedEntityIds(activeStoreyEntityIds);
    isolateEntities(activeStoreyEntityIds, entityIds);
  }, [activeStoreyFilter, activeStoreyEntityIds, setActiveClassFilter, setActiveTypeFilter,
    setSelectedEntityIds, isolateEntities, entityIds]);

  // --- Computed UI ---
  const sectionHeader = useMemo(() => {
    if (groupingMode === 'spatial') {
      return {
        title: 'Hierarchy',
        subtitle: hasSpatialTree
          ? 'Project / Site / Building / Storey / Elements'
          : 'Waiting for model structure',
        count: hasSpatialTree ? treeNodes.length : 0,
        Icon: Building2,
      };
    }

    if (groupingMode === 'class') {
      return {
        title: 'By Class',
        subtitle: 'Grouped by IFC class',
        count: entities.length,
        Icon: Layers3,
      };
    }

    return {
      title: 'By Type',
      subtitle: 'Grouped by IfcType relation',
      count: typeTree.length,
      Icon: Boxes,
    };
  }, [groupingMode, hasSpatialTree, treeNodes.length, entities.length, typeTree.length]);

  const footerSummary = useMemo(() => {
    if (groupingMode === 'spatial') {
      return hasSpatialTree ? 'Spatial tree synced' : 'Spatial tree idle';
    }
    if (groupingMode === 'class') return 'By IFC class';
    return 'By IfcType relation';
  }, [groupingMode, hasSpatialTree]);

  return (
    <aside className="viewer-panel viewer-panel--left">
      {/* Header: Search + Grouping Toggle (ifc-lite style: clean, minimal) */}
      <div className="viewer-panel__header viewer-panel__header--stacked">
        <div className="viewer-panel__search">
          <Search size={14} strokeWidth={2} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={
              groupingMode === 'spatial'
                ? 'Search hierarchy...'
                : groupingMode === 'class'
                  ? 'Search classes or entities...'
                  : 'Search type groups or entities...'
            }
          />
        </div>
        <div className="viewer-panel__tabs">
          <button
            type="button"
            className={`viewer-panel__tab${groupingMode === 'spatial' ? ' is-active' : ''}`}
            onClick={() => setGroupingMode('spatial')}
            title="Spatial"
          >
            <Building2 size={14} strokeWidth={2} />
            <span>Spatial</span>
          </button>
          <button
            type="button"
            className={`viewer-panel__tab${groupingMode === 'class' ? ' is-active' : ''}`}
            onClick={() => setGroupingMode('class')}
            title="Class"
          >
            <Layers3 size={14} strokeWidth={2} />
            <span>Class</span>
          </button>
          <button
            type="button"
            className={`viewer-panel__tab${groupingMode === 'type' ? ' is-active' : ''}`}
            onClick={() => setGroupingMode('type')}
            title="Type"
          >
            <Boxes size={14} strokeWidth={2} />
            <span>Type</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="viewer-panel__body viewer-panel__body--tree">
        <div className="viewer-panel__section viewer-panel__section--compact">
          {groupingMode === 'spatial' && activeStoreyFilter !== null && (
            <div className="viewer-panel__meta viewer-panel__meta--accent">
              <span>Active Storey</span>
              <strong>{activeStoreyLabel ?? `#${activeStoreyFilter}`}</strong>
              <button type="button" onClick={clearStoreyFilter}>
                Clear
              </button>
            </div>
          )}
          {groupingMode === 'spatial' && activeStoreyFilter !== null && (
            <div className="viewer-tree__scope-card viewer-tree__scope-card--compact">
              <div className="viewer-tree__scope-copy">
                <strong>Storey Scope</strong>
                <small>{activeStoreyEntityIds.length > 0 ? `${COUNT_FORMATTER.format(activeStoreyEntityIds.length)} entities in scope` : 'No renderable entities in this storey'}</small>
              </div>
              <div className="viewer-tree__scope-actions">
                <button type="button" onClick={handleStoreyScopeSelect}>
                  Select
                </button>
                <button
                  type="button"
                  onClick={handleStoreyScopeIsolate}
                  disabled={activeStoreyEntityIds.length === 0}
                >
                  Isolate
                </button>
                <button type="button" onClick={clearStoreyFilter}>
                  Clear Scope
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section Header */}
        <div className="viewer-tree__section-header">
          <div className="viewer-tree__section-copy">
            <span className="viewer-tree__section-icon">
              <sectionHeader.Icon size={14} strokeWidth={2} />
            </span>
            <div>
              <strong>{sectionHeader.title}</strong>
              <small>{sectionHeader.subtitle}</small>
            </div>
          </div>
          <span className="viewer-tree__section-count">{sectionHeader.count}</span>
        </div>

        {/* Filter Chips (inside body, before scroll) */}
        {(activeClassFilter !== null || activeTypeFilter !== null) && (
          <div className="viewer-tree__filter-bar">
            <div className="viewer-tree__filter-chips">
              {activeClassFilter !== null && (
                <button
                  type="button"
                  className="viewer-tree__filter-chip"
                  onClick={() => setActiveClassFilter(null)}
                >
                  <span>Class · {formatIfcType(activeClassFilter)}</span>
                  <small>Clear</small>
                </button>
              )}
              {activeTypeFilter !== null && (
                <button
                  type="button"
                  className="viewer-tree__filter-chip"
                  onClick={() => setActiveTypeFilter(null)}
                >
                  <span>Type · {formatIfcType(activeTypeFilter)}</span>
                  <small>Clear</small>
                </button>
              )}
            </div>
            <button
              type="button"
              className="viewer-tree__filter-clear-all"
              onClick={clearSemanticFilters}
            >
              Clear All
            </button>
          </div>
        )}

        {/* Tree */}
        <div
          ref={scrollRef}
          className="viewer-panel__scroll"
        >
          {treeNodes.length > 0 ? (
            <div
              className="viewer-tree viewer-tree--directory viewer-tree--virtual"
              style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const node = treeNodes[virtualRow.index];
                return (
                  <HierarchyNode
                    key={node.id}
                    node={node}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      height: `${virtualRow.size}px`,
                    }}
                    hiddenEntityIds={hiddenEntityIds}
                    activeStoreyFilter={activeStoreyFilter}
                    selectedEntityIds={selectedEntityIdSet}
                    selectedSpatialNodeIds={selectedSpatialNodeIds}
                    onNodeClick={handleNodeClick}
                    onToggleExpand={toggleExpand}
                    onVisibilityToggle={handleVisibilityToggle}
                    onIsolate={handleGroupIsolate}
                    onFocus={handleEntityFocus}
                    onReset={handleResetGroupView}
                  />
                );
              })}
            </div>
          ) : (
            <div className="viewer-tree viewer-tree--directory">
              <div className="viewer-tree__empty">
                {groupingMode === 'spatial' ? (
                  <FolderTree size={16} strokeWidth={2} />
                ) : groupingMode === 'class' ? (
                  <Layers3 size={16} strokeWidth={2} />
                ) : (
                  <Boxes size={16} strokeWidth={2} />
                )}
                <span>
                  {groupingMode === 'spatial'
                    ? '검색 결과가 없습니다.'
                    : groupingMode === 'class'
                      ? '표시할 클래스가 없습니다.'
                      : '표시할 타입 그룹이 없습니다.'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: ifc-lite style - active filter chips or simple status */}
      {hasActiveFilters ? (
        <div className="viewer-panel__footer--active">
          <div className="viewer-panel__footer-chips">
            {activeStoreyFilter !== null && (
              <span className="viewer-panel__footer-chip">
                {activeStoreyLabel ?? `Storey #${activeStoreyFilter}`}
                <button
                  type="button"
                  className="viewer-panel__footer-chip-close"
                  onClick={clearStoreyFilter}
                  aria-label="Clear storey filter"
                >
                  &times;
                </button>
              </span>
            )}
            {activeClassFilter !== null && (
              <>
                {activeStoreyFilter !== null && (
                  <span className="viewer-panel__footer-separator">+</span>
                )}
                <span className="viewer-panel__footer-chip">
                  {formatIfcType(activeClassFilter)}
                  <button
                    type="button"
                    className="viewer-panel__footer-chip-close"
                    onClick={() => setActiveClassFilter(null)}
                    aria-label="Clear class filter"
                  >
                    &times;
                  </button>
                </span>
              </>
            )}
            {activeTypeFilter !== null && (
              <>
                {(activeStoreyFilter !== null || activeClassFilter !== null) && (
                  <span className="viewer-panel__footer-separator">+</span>
                )}
                <span className="viewer-panel__footer-chip">
                  {formatIfcType(activeTypeFilter)}
                  <button
                    type="button"
                    className="viewer-panel__footer-chip-close"
                    onClick={() => setActiveTypeFilter(null)}
                    aria-label="Clear type filter"
                  >
                    &times;
                  </button>
                </span>
              </>
            )}
          </div>
          <div className="viewer-panel__footer-actions">
            <span className="viewer-panel__footer-esc">ESC</span>
            <button
              type="button"
              className="viewer-panel__footer-clear-all"
              onClick={clearSemanticFilters}
            >
              Clear all
            </button>
          </div>
        </div>
      ) : (
        <div className="viewer-panel__footer">
          <span>{footerSummary}</span>
          <div className="viewer-panel__footer-meta">
            <strong>
              {treeNodes.length} rows · {hiddenEntityIds.size} hidden
            </strong>
          </div>
        </div>
      )}
    </aside>
  );
}
