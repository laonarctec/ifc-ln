import { useVirtualizer } from '@tanstack/react-virtual';
import { Boxes, Building2, FolderTree, Layers3, Search } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldControl } from '@/components/ui/FieldControl';
import { FilterChip } from '@/components/ui/FilterChip';
import { useHierarchyController } from '@/hooks/useHierarchyController';
import { COUNT_FORMATTER, ROW_HEIGHT, OVERSCAN } from '@/types/hierarchy';
import { formatIfcType } from './hierarchy/treeDataBuilder';
import { HierarchyNode } from './hierarchy/HierarchyNode';
import { PanelSegmentedControl } from './PanelSegmentedControl';
import { TreeContextMenu } from './hierarchy/TreeContextMenu';
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

  const footerSummary = useMemo(() => {
    if (ctrl.groupingMode === 'spatial') return hasSpatialTree ? 'Spatial tree synced' : 'Spatial tree idle';
    if (ctrl.groupingMode === 'class') return 'By IFC class';
    return 'By IfcType relation';
  }, [ctrl.groupingMode, hasSpatialTree]);

  const groupingOptions = [
    {
      value: 'spatial',
      label: 'Spatial',
      icon: <Building2 size={14} strokeWidth={2} />,
      title: 'Spatial',
    },
    {
      value: 'class',
      label: 'Class',
      icon: <Layers3 size={14} strokeWidth={2} />,
      title: 'Class',
    },
    {
      value: 'type',
      label: 'Type',
      icon: <Boxes size={14} strokeWidth={2} />,
      title: 'Type',
    },
  ] as const;

  return (
    <aside className="panel panel-left">
      {/* Header */}
      <div className="panel-header">
        <FieldControl
          aria-label="Hierarchy search"
          value={ctrl.searchQuery}
          onChange={(e) => ctrl.setSearchQuery(e.target.value)}
          placeholder={
            ctrl.groupingMode === 'spatial' ? 'Search hierarchy...'
              : ctrl.groupingMode === 'class' ? 'Search classes or entities...'
                : 'Search type groups or entities...'
          }
          prefix={<Search size={14} strokeWidth={2} />}
        />
        <PanelSegmentedControl
          ariaLabel="Hierarchy grouping mode"
          value={ctrl.groupingMode}
          onChange={ctrl.setGroupingMode}
          options={groupingOptions}
        />
      </div>

      {/* Body */}
      <div className="tree-body">
        <div className="grid gap-2.5 shrink-0">
          {ctrl.groupingMode === 'spatial' && ctrl.activeStoreyFilter !== null && (
            <>
              <div className="storey-filter">
                <span className="text-[0.72rem] tracking-[0.06em] uppercase text-text-muted">Active Storey</span>
                <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text text-[0.85rem] dark:text-slate-100">{ctrl.activeStoreyLabel ?? `#${ctrl.activeStoreyFilter}`}</strong>
                <button
                  type="button"
                  className="h-6 px-2 border border-blue-500/22 rounded bg-white/90 text-blue-700 text-[0.7rem] font-bold cursor-pointer"
                  onClick={ctrl.clearStoreyFilter}
                >Clear</button>
              </div>
              <div className="grid gap-2 p-2.5 px-3 border border-border-subtle bg-slate-50/96">
                <div>
                  <strong className="block text-text text-[0.72rem] leading-[1.1] dark:text-slate-100">Storey Scope</strong>
                  <small className="block mt-0.5 text-text-muted text-[0.64rem] leading-[1.15] dark:text-slate-400">{ctrl.activeStoreyEntityIds.length > 0 ? `${COUNT_FORMATTER.format(ctrl.activeStoreyEntityIds.length)} entities in scope` : 'No renderable entities in this storey'}</small>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className="btn-scope" onClick={ctrl.handleStoreyScopeSelect}>Select</button>
                  <button type="button" className="btn-scope" onClick={ctrl.handleStoreyScopeIsolate} disabled={ctrl.activeStoreyEntityIds.length === 0}>Isolate</button>
                  <button type="button" className="btn-scope" onClick={ctrl.clearStoreyFilter}>Clear Scope</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tree */}
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
                icon={
                  ctrl.groupingMode === 'spatial' ? (
                    <FolderTree size={16} strokeWidth={2} />
                  ) : ctrl.groupingMode === 'class' ? (
                    <Layers3 size={16} strokeWidth={2} />
                  ) : (
                    <Boxes size={16} strokeWidth={2} />
                  )
                }
                description={
                  ctrl.groupingMode === 'spatial'
                    ? '검색 결과가 없습니다.'
                    : ctrl.groupingMode === 'class'
                      ? '표시할 클래스가 없습니다.'
                      : '표시할 타입 그룹이 없습니다.'
                }
              />
            </div>
          )}
        </div>

        {(ctrl.activeClassFilter !== null || ctrl.activeTypeFilter !== null) && (
          <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-t border-border bg-white/92 dark:border-slate-700 dark:bg-slate-900/92">
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {ctrl.activeClassFilter !== null && (
                <FilterChip
                  active
                  className="min-w-0 max-w-full"
                  onClick={() => ctrl.setActiveClassFilter(null)}
                >
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    Class · {formatIfcType(ctrl.activeClassFilter)}
                  </span>
                  <small className="text-[0.62rem] font-bold">Clear</small>
                </FilterChip>
              )}
              {ctrl.activeTypeFilter !== null && (
                <FilterChip
                  active
                  className="min-w-0 max-w-full"
                  onClick={() => ctrl.setActiveTypeFilter(null)}
                >
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    Type · {formatIfcType(ctrl.activeTypeFilter)}
                  </span>
                  <small className="text-[0.62rem] font-bold">Clear</small>
                </FilterChip>
              )}
            </div>
            <FilterChip className="ml-auto whitespace-nowrap" onClick={ctrl.clearSemanticFilters}>
              Clear All
            </FilterChip>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="panel-footer">
        <span className="truncate">{footerSummary}</span>
        <span className="shrink-0 font-mono font-medium text-text dark:text-slate-300">{ctrl.treeNodes.length} · {ctrl.hiddenEntityIds.size > 0 ? `${ctrl.hiddenEntityIds.size} hidden` : '0 hidden'}</span>
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
