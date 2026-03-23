import { clsx } from 'clsx';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Boxes, Building2, Eye, EyeOff, FolderTree, Layers3, Search } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useHierarchyController } from '@/hooks/useHierarchyController';
import { COUNT_FORMATTER, ROW_HEIGHT, OVERSCAN } from '@/types/hierarchy';
import { formatIfcType } from './hierarchy/treeDataBuilder';
import { HierarchyNode } from './hierarchy/HierarchyNode';
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

  // --- Computed UI ---
  const sectionHeader = useMemo(() => {
    if (ctrl.groupingMode === 'spatial') {
      return { title: 'Hierarchy', subtitle: hasSpatialTree ? 'Project / Site / Building / Storey / Elements' : 'Waiting for model structure', count: hasSpatialTree ? ctrl.treeNodes.length : 0, Icon: Building2 };
    }
    if (ctrl.groupingMode === 'class') {
      return { title: 'By Class', subtitle: 'Grouped by IFC class', count: ctrl.entities.length, Icon: Layers3 };
    }
    return { title: 'By Type', subtitle: 'Grouped by IfcType relation', count: ctrl.typeTree.length, Icon: Boxes };
  }, [ctrl.groupingMode, hasSpatialTree, ctrl.treeNodes.length, ctrl.entities.length, ctrl.typeTree.length]);

  const footerSummary = useMemo(() => {
    if (ctrl.groupingMode === 'spatial') return hasSpatialTree ? 'Spatial tree synced' : 'Spatial tree idle';
    if (ctrl.groupingMode === 'class') return 'By IFC class';
    return 'By IfcType relation';
  }, [ctrl.groupingMode, hasSpatialTree]);

  return (
    <aside className="grid w-full h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-white/88 overflow-hidden border-r border-border-subtle dark:bg-slate-800/88">
      {/* Header */}
      <div className="grid gap-3 px-4 py-3.5 pb-3 border-b border-border text-[0.74rem] font-bold tracking-[0.09em] uppercase text-text-secondary dark:border-slate-700 dark:bg-[rgba(30,41,59,0.92)]">
        <div className="flex items-center gap-2 h-9 px-2.5 border border-border-subtle bg-white text-text-muted dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
          <Search size={14} strokeWidth={2} />
          <input
            className="w-full border-0 outline-0 bg-transparent text-text placeholder:text-text-subtle dark:text-slate-200"
            type="text"
            value={ctrl.searchQuery}
            onChange={(e) => ctrl.setSearchQuery(e.target.value)}
            placeholder={
              ctrl.groupingMode === 'spatial' ? 'Search hierarchy...'
                : ctrl.groupingMode === 'class' ? 'Search classes or entities...'
                  : 'Search type groups or entities...'
            }
          />
        </div>
        <div className="inline-flex items-center gap-0 p-0 border border-border rounded-none bg-bg dark:border-slate-600 dark:bg-slate-800">
          {(['spatial', 'class', 'type'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={clsx(
                'inline-flex items-center gap-1.5 h-8 px-2.5 border-0 border-r border-border rounded-none bg-transparent text-text-muted text-xs font-bold tracking-wide uppercase last:border-r-0 hover:bg-white dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700',
                ctrl.groupingMode === mode && 'bg-white text-text shadow-[inset_0_3px_0_#2563eb] dark:bg-slate-700 dark:text-blue-300 dark:shadow-[inset_0_-2px_0_#3b82f6]',
              )}
              onClick={() => ctrl.setGroupingMode(mode)}
              title={mode.charAt(0).toUpperCase() + mode.slice(1)}
            >
              {mode === 'spatial' ? <Building2 size={14} strokeWidth={2} /> : mode === 'class' ? <Layers3 size={14} strokeWidth={2} /> : <Boxes size={14} strokeWidth={2} />}
              <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-rows-[auto_minmax(0,1fr)] gap-3 min-h-0 overflow-hidden p-3.5 text-text-secondary">
        <div className="grid gap-2.5">
          {ctrl.groupingMode === 'spatial' && ctrl.activeStoreyFilter !== null && (
            <>
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2.5 border border-blue-500/18 bg-blue-50/72">
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
                  <button type="button" className="h-6 px-2 border border-slate-400/24 rounded bg-white/94 text-slate-700 text-[0.66rem] font-bold cursor-pointer dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" onClick={ctrl.handleStoreyScopeSelect}>Select</button>
                  <button type="button" className="h-6 px-2 border border-slate-400/24 rounded bg-white/94 text-slate-700 text-[0.66rem] font-bold cursor-pointer disabled:opacity-45 disabled:cursor-default dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" onClick={ctrl.handleStoreyScopeIsolate} disabled={ctrl.activeStoreyEntityIds.length === 0}>Isolate</button>
                  <button type="button" className="h-6 px-2 border border-slate-400/24 rounded bg-white/94 text-slate-700 text-[0.66rem] font-bold cursor-pointer dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" onClick={ctrl.clearStoreyFilter}>Clear Scope</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Section Header */}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-y border-border bg-slate-50/90 dark:border-slate-700 dark:bg-[rgba(30,41,59,0.9)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center justify-center w-[22px] h-[22px] border border-border-subtle bg-white/92 text-text-secondary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
              <sectionHeader.Icon size={14} strokeWidth={2} />
            </span>
            <div>
              <strong className="block text-text text-[0.77rem] leading-[1.1] dark:text-slate-50">{sectionHeader.title}</strong>
              <small className="block text-text-muted text-[0.68rem] leading-[1.1] whitespace-nowrap overflow-hidden text-ellipsis max-w-[170px] dark:text-slate-400">{sectionHeader.subtitle}</small>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={clsx(
                'inline-flex items-center justify-center w-[22px] h-[22px] p-0 border border-transparent rounded text-slate-400 cursor-pointer transition-colors duration-150 hover:text-slate-700 hover:bg-slate-400/16 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-400/12',
                ctrl.hiddenEntityIds.size > 0 && 'text-red-500 hover:text-red-600 hover:bg-red-500/8 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-400/10',
              )}
              onClick={ctrl.handleMasterVisibilityToggle}
              title={ctrl.hiddenEntityIds.size > 0 ? `Show all (${ctrl.hiddenEntityIds.size} hidden)` : 'Hide all'}
            >
              {ctrl.hiddenEntityIds.size > 0 ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
            </button>
            {ctrl.hiddenEntityIds.size > 0 && <span className="text-[0.62rem] font-semibold text-red-500 whitespace-nowrap dark:text-red-400">{ctrl.hiddenEntityIds.size}</span>}
            <span className="inline-flex items-center justify-center min-h-5 px-[7px] border border-border-subtle bg-white/92 text-text text-[0.68rem] font-bold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">{sectionHeader.count}</span>
          </div>
        </div>

        {/* Filter Chips */}
        {(ctrl.activeClassFilter !== null || ctrl.activeTypeFilter !== null) && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-white/92">
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {ctrl.activeClassFilter !== null && (
                <button type="button" className="inline-flex items-center gap-2 min-w-0 max-w-full px-2 py-1 border border-slate-400/22 bg-slate-50/90 text-slate-700 text-[0.68rem] font-bold" onClick={() => ctrl.setActiveClassFilter(null)}>
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Class · {formatIfcType(ctrl.activeClassFilter)}</span><small className="text-text-muted text-[0.62rem] font-bold">Clear</small>
                </button>
              )}
              {ctrl.activeTypeFilter !== null && (
                <button type="button" className="inline-flex items-center gap-2 min-w-0 max-w-full px-2 py-1 border border-slate-400/22 bg-slate-50/90 text-slate-700 text-[0.68rem] font-bold" onClick={() => ctrl.setActiveTypeFilter(null)}>
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Type · {formatIfcType(ctrl.activeTypeFilter)}</span><small className="text-text-muted text-[0.62rem] font-bold">Clear</small>
                </button>
              )}
            </div>
            <button type="button" className="ml-auto h-6 px-2 border border-slate-400/24 rounded bg-white/92 text-slate-700 text-[0.68rem] font-bold whitespace-nowrap cursor-pointer dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" onClick={ctrl.clearSemanticFilters}>Clear All</button>
          </div>
        )}

        {/* Tree */}
        <div ref={scrollRef} className="min-h-0 overflow-auto pr-1.5">
          {ctrl.treeNodes.length > 0 ? (
            <div className="grid gap-1.5 min-h-0 overflow-visible align-content-start" style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
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
              <div className="flex items-center gap-2 px-3 py-3.5 border border-dashed border-slate-300 text-text-muted text-[0.8rem]">
                {ctrl.groupingMode === 'spatial' ? <FolderTree size={16} strokeWidth={2} /> : ctrl.groupingMode === 'class' ? <Layers3 size={16} strokeWidth={2} /> : <Boxes size={16} strokeWidth={2} />}
                <span>{ctrl.groupingMode === 'spatial' ? '검색 결과가 없습니다.' : ctrl.groupingMode === 'class' ? '표시할 클래스가 없습니다.' : '표시할 타입 그룹이 없습니다.'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {ctrl.hasActiveFilters ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t-2 border-blue-600 bg-blue-600 text-white">
          <div className="flex items-center flex-wrap gap-1.5 min-w-0">
            {ctrl.activeStoreyFilter !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 border-0 rounded bg-white/15 text-white text-[0.62rem] font-bold tracking-[0.05em] uppercase whitespace-nowrap">
                {ctrl.activeStoreyLabel ?? `Storey #${ctrl.activeStoreyFilter}`}
                <button type="button" className="ml-0.5 p-0 border-0 bg-transparent text-white/60 text-[0.72rem] leading-none cursor-pointer hover:text-white" onClick={ctrl.clearStoreyFilter} aria-label="Clear storey filter">&times;</button>
              </span>
            )}
            {ctrl.activeClassFilter !== null && (
              <>{ctrl.activeStoreyFilter !== null && <span className="text-white/50 text-[0.6rem]">+</span>}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 border-0 rounded bg-white/15 text-white text-[0.62rem] font-bold tracking-[0.05em] uppercase whitespace-nowrap">
                  {formatIfcType(ctrl.activeClassFilter)}
                  <button type="button" className="ml-0.5 p-0 border-0 bg-transparent text-white/60 text-[0.72rem] leading-none cursor-pointer hover:text-white" onClick={() => ctrl.setActiveClassFilter(null)} aria-label="Clear class filter">&times;</button>
                </span>
              </>
            )}
            {ctrl.activeTypeFilter !== null && (
              <>{(ctrl.activeStoreyFilter !== null || ctrl.activeClassFilter !== null) && <span className="text-white/50 text-[0.6rem]">+</span>}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 border-0 rounded bg-white/15 text-white text-[0.62rem] font-bold tracking-[0.05em] uppercase whitespace-nowrap">
                  {formatIfcType(ctrl.activeTypeFilter)}
                  <button type="button" className="ml-0.5 p-0 border-0 bg-transparent text-white/60 text-[0.72rem] leading-none cursor-pointer hover:text-white" onClick={() => ctrl.setActiveTypeFilter(null)} aria-label="Clear type filter">&times;</button>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-white/70 text-[0.62rem] font-mono">ESC</span>
            <button type="button" className="h-6 px-2 border border-white/20 rounded-none bg-transparent text-white text-[0.62rem] font-bold tracking-[0.05em] uppercase cursor-pointer hover:bg-white/20" onClick={ctrl.clearSemanticFilters}>Clear all</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-t-2 border-border bg-slate-50/92 text-text-muted text-xs tracking-wide uppercase dark:border-slate-700 dark:bg-slate-800/92 dark:text-slate-400">
          <span>{footerSummary}</span>
          <div className="inline-flex items-center gap-2.5 min-w-0">
            <strong className="text-text text-[0.76rem] font-mono dark:text-slate-200">{ctrl.treeNodes.length} rows · {ctrl.hiddenEntityIds.size} hidden</strong>
          </div>
        </div>
      )}
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
