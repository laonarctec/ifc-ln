import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldControl } from '@/components/ui/FieldControl';
import { useHierarchyController } from '@/hooks/useHierarchyController';
import { ROW_HEIGHT, OVERSCAN } from '@/types/hierarchy';
import { HierarchyNode } from './hierarchy/HierarchyNode';
import { PanelSegmentedControl } from './PanelSegmentedControl';
import {
  SemanticFilterBar,
  StoreyScopeSection,
} from './hierarchy/HierarchyPanelSections';
import { TreeContextMenu } from './hierarchy/TreeContextMenu';
import {
  HIERARCHY_GROUPING_OPTIONS,
  getHierarchyEmptyState,
  getHierarchyFooterSummary,
  getHierarchySearchPlaceholder,
} from './hierarchy/hierarchyPanelViewModel';

export function HierarchyPanel() {
  const ctrl = useHierarchyController();
  const hasSpatialTree = ctrl.filteredSpatialNodes.length > 0 && ctrl.filteredSpatialNodes[0]?.expressID !== 0;

  // --- Virtual scroll ---
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: ctrl.treeNodes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  // Scroll-to-selected
  useEffect(() => {
    if (ctrl.selectedEntityId === null || !scrollRef.current) return;

    const targetNodeId =
      ctrl.groupingMode === 'spatial'
        ? ctrl.treeNodes.some((n) => n.id === `spatial-${ctrl.selectedEntityId}`)
          ? `spatial-${ctrl.selectedEntityId}`
          : `spatial-element-${ctrl.selectedEntityId}`
        : ctrl.groupingMode === 'class'
          ? `class-entity-${ctrl.selectedEntityId}`
          : `type-entity-${ctrl.selectedEntityId}`;

    const targetIndex = ctrl.treeNodes.findIndex((n) => n.id === targetNodeId);
    if (targetIndex < 0) return;

    const container = scrollRef.current;
    const rowTop = targetIndex * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const viewportTop = container.scrollTop;
    const viewportBottom = viewportTop + container.clientHeight;

    if (rowTop < viewportTop || rowBottom > viewportBottom) {
      container.scrollTo({
        top: Math.max(0, rowTop - Math.max(ROW_HEIGHT * 2, container.clientHeight / 3)),
        behavior: 'smooth',
      });
    }
  }, [ctrl.groupingMode, ctrl.treeNodes, ctrl.selectedEntityId]);

  // Close context menu on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || ctrl.treeContextMenu === null) return;
    const handler = () => ctrl.closeTreeContextMenu();
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [ctrl.treeContextMenu, ctrl.closeTreeContextMenu]);

  const footerSummary = getHierarchyFooterSummary(ctrl.groupingMode, hasSpatialTree);
  const emptyState = getHierarchyEmptyState(ctrl.groupingMode);

  return (
    <aside className="panel panel-left">
      <div className="panel-header">
        <FieldControl
          aria-label="Hierarchy search"
          value={ctrl.searchQuery}
          onChange={(e) => ctrl.setSearchQuery(e.target.value)}
          placeholder={getHierarchySearchPlaceholder(ctrl.groupingMode)}
          prefix={<Search size={14} strokeWidth={2} />}
        />
        <PanelSegmentedControl
          ariaLabel="Hierarchy grouping mode"
          value={ctrl.groupingMode}
          onChange={ctrl.setGroupingMode}
          options={HIERARCHY_GROUPING_OPTIONS}
        />
      </div>

      <div className="tree-body">
        <div className="grid gap-2.5 shrink-0">
          {ctrl.groupingMode === 'spatial' ? (
            <StoreyScopeSection
              activeStoreyFilter={ctrl.activeStoreyFilter}
              activeStoreyLabel={ctrl.activeStoreyLabel}
              activeStoreyEntityCount={ctrl.activeStoreyEntityIds.length}
              onClearStoreyFilter={ctrl.clearStoreyFilter}
              onStoreyScopeSelect={ctrl.handleStoreyScopeSelect}
              onStoreyScopeIsolate={ctrl.handleStoreyScopeIsolate}
            />
          ) : null}
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto pr-1.5">
          {ctrl.treeNodes.length > 0 ? (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const node = ctrl.treeNodes[virtualRow.index];
                return (
                  <HierarchyNode
                    key={node.id}
                    node={node}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
                    hiddenEntityIds={ctrl.hiddenEntityIds}
                    activeStoreyFilter={ctrl.activeStoreyFilter}
                    selectedEntityIds={ctrl.selectedEntityIdSet}
                    selectedSpatialNodeIds={ctrl.selectedSpatialNodeIds}
                    onNodeClick={ctrl.handleNodeClick}
                    onToggleExpand={ctrl.toggleExpand}
                    onVisibilityToggle={ctrl.handleVisibilityToggle}
                    onIsolate={ctrl.handleGroupIsolate}
                    onFocus={ctrl.handleEntityFocus}
                    onReset={ctrl.handleResetGroupView}
                    onContextMenu={ctrl.handleTreeContextMenu}
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid gap-1.5 min-h-0 overflow-visible align-content-start">
              <EmptyState
                icon={emptyState.icon}
                description={emptyState.description}
              />
            </div>
          )}
        </div>

        <SemanticFilterBar
          activeClassFilter={ctrl.activeClassFilter}
          activeTypeFilter={ctrl.activeTypeFilter}
          onClearClassFilter={() => ctrl.setActiveClassFilter(null)}
          onClearTypeFilter={() => ctrl.setActiveTypeFilter(null)}
          onClearAll={ctrl.clearSemanticFilters}
        />
      </div>

      <div className="panel-footer">
        <span className="truncate">{footerSummary}</span>
        <span className="shrink-0 font-mono font-medium text-text dark:text-slate-300">
          {`${ctrl.treeNodes.length} · ${ctrl.hiddenEntityIds.size > 0 ? `${ctrl.hiddenEntityIds.size} hidden` : '0 hidden'}`}
        </span>
      </div>
      {ctrl.treeContextMenu && (
        <TreeContextMenu
          menu={ctrl.treeContextMenu}
          hiddenEntityIds={ctrl.hiddenEntityIds}
          onClose={ctrl.closeTreeContextMenu}
          onSelect={ctrl.handleCtxSelect}
          onIsolate={ctrl.handleGroupIsolate}
          onHide={ctrl.handleCtxHide}
          onShow={ctrl.handleCtxShow}
          onFocus={ctrl.handleCtxFocus}
          onShowAll={ctrl.handleResetGroupView}
        />
      )}
    </aside>
  );
}
