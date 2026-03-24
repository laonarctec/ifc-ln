import React from 'react';
import { clsx } from 'clsx';
import {
  Boxes,
  ChevronRight,
  Eye,
  EyeOff,
  Focus,
  Layers3,
} from 'lucide-react';
import type { TreeNode } from '@/types/hierarchy';
import { IFC_ICON_CODEPOINTS, IFC_ICON_DEFAULT } from './ifc-icons';
import { getIfcTypeColor } from './ifcTypeColors';
import { formatIfcType } from './treeDataBuilder';

// ── Props ───────────────────────────────────────────────────────────────────

export interface HierarchyNodeProps {
  node: TreeNode;
  style: React.CSSProperties;
  hiddenEntityIds: Set<number>;
  activeStoreyFilter: number | null;
  selectedEntityIds: Set<number>;
  selectedSpatialNodeIds: Set<number>;
  onNodeClick: (node: TreeNode, event: React.MouseEvent) => void;
  onToggleExpand: (nodeId: string | number) => void;
  onVisibilityToggle: (entityIds: number[]) => void;
  onIsolate: (entityIds: number[]) => void;
  onFocus: (entityId: number) => void;
  onReset: () => void;
  onContextMenu: (node: TreeNode, event: React.MouseEvent) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveIfcIcon(ifcType: string | undefined): string | null {
  if (!ifcType) return null;
  const formatted = formatIfcType(ifcType);
  return IFC_ICON_CODEPOINTS[formatted] ?? null;
}

// ── TreeAction (memoised) ───────────────────────────────────────────────────

const TreeAction = React.memo(function TreeAction({
  label,
  icon,
  onActivate,
  accent = false,
}: {
  label: string;
  icon: JSX.Element;
  onActivate: () => void;
  accent?: boolean;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-text-subtle cursor-pointer hover:bg-slate-400/16 hover:text-slate-700',
        accent && 'hover:bg-blue-600/12 hover:text-blue-700',
      )}
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onActivate();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onActivate();
        }
      }}
    >
      {icon}
    </span>
  );
});

// ── Main component ──────────────────────────────────────────────────────────

export function HierarchyNode({
  node,
  style,
  hiddenEntityIds,
  activeStoreyFilter,
  selectedEntityIds,
  selectedSpatialNodeIds,
  onNodeClick,
  onToggleExpand,
  onVisibilityToggle,
  onIsolate,
  onFocus,
  onReset,
  onContextMenu,
}: HierarchyNodeProps) {
  const paddingLeft = `${14 + node.depth * 16}px`;
  const iconCodepoint = resolveIfcIcon(node.ifcType);
  const typeColor = getIfcTypeColor(node.ifcType);

  const colorDot = node.ifcType ? (
    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: typeColor }} />
  ) : null;

  // ── Shared render helpers (closures over component scope) ───────────────

  /** Render the IFC / fallback icon. */
  const renderIcon = () => {
    if (iconCodepoint) {
      return (
        <span className="tree-icon">
          {colorDot}
          <span className="material-symbols-outlined text-[11px] leading-none select-none">{iconCodepoint}</span>
        </span>
      );
    }

    if (node.type === 'reset') {
      const Icon = node.id.startsWith('class-') ? Layers3 : Boxes;
      return (
        <span className="tree-icon">
          <Icon size={14} strokeWidth={2} />
        </span>
      );
    }

    return (
      <span className="tree-icon">
        {colorDot}
        <span className="material-symbols-outlined text-[11px] leading-none select-none">{IFC_ICON_DEFAULT}</span>
      </span>
    );
  };

  /** 1. Chevron toggle (expand / collapse). */
  const renderChevron = (
    expandKey: string | number,
    hasChildren: boolean,
    isExpanded: boolean,
    isActive: boolean,
  ) => (
    <span
      className={clsx(
        'tree-chevron',
        hasChildren ? 'opacity-100' : 'opacity-0',
        isExpanded && '[&>svg]:rotate-90',
        isActive && 'text-blue-600',
      )}
      onClick={(event) => {
        event.stopPropagation();
        if (hasChildren) onToggleExpand(expandKey);
      }}
    >
      <ChevronRight size={13} strokeWidth={2.3} />
    </span>
  );

  /** 2. Eye / EyeOff visibility toggle. */
  const renderEyeToggle = (
    entityIds: number[],
    isHidden: boolean,
    labelPrefix = '',
  ) => (
    <span
      className={clsx('tree-eye', isHidden && 'opacity-100')}
      role="button"
      tabIndex={0}
      aria-label={isHidden ? `Show${labelPrefix}` : `Hide${labelPrefix}`}
      title={isHidden ? `Show${labelPrefix}` : `Hide${labelPrefix}`}
      onClick={(event) => {
        event.stopPropagation();
        onVisibilityToggle(entityIds);
      }}
    >
      {isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
    </span>
  );

  /** 3. Icon + name + subtitle block. */
  const renderNodeContent = (
    name: string,
    subtitle: string | null | undefined,
    isActive: boolean,
    isHidden: boolean,
    isLeaf: boolean,
  ) => (
    <>
      {renderIcon()}
      <span className="grid min-w-0 gap-0">
        <span
          className={clsx(
            'tree-name',
            isLeaf && 'text-[0.75rem] font-medium',
            isActive && 'text-primary-text',
            isHidden && 'line-through decoration-slate-400 dark:decoration-slate-600',
          )}
        >
          {name}
        </span>
        {subtitle !== undefined && (
          <span className={clsx('tree-subtitle', isLeaf && 'text-[0.65rem]')}>{subtitle}</span>
        )}
      </span>
    </>
  );

  /** 4. Hover-reveal action buttons (Isolate / Focus). */
  const renderActions = (
    entityIds: number[],
    expressId: number,
    nodeType: 'spatial' | 'element' | 'group',
  ) => (
    <span className="inline-flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      {nodeType === 'element' ? (
        <TreeAction
          label="Focus entity"
          icon={<Focus size={13} strokeWidth={2} />}
          onActivate={() => onFocus(expressId)}
          accent
        />
      ) : (
        <TreeAction
          label="Isolate group"
          icon={<Layers3 size={13} strokeWidth={2} />}
          onActivate={() => onIsolate(entityIds)}
          accent
        />
      )}
    </span>
  );

  /** 5. Badges + meta ID section. */
  const renderBadges = (
    n: TreeNode,
    isStoreyFiltered: boolean,
    isActive: boolean,
  ) => (
    <span className="inline-flex items-center gap-1 ml-1.5 flex-wrap justify-end">
      {isStoreyFiltered && (
        <span className="inline-flex items-center justify-center min-h-4 px-[5px] border border-primary/24 bg-blue-100/92 text-primary-text text-[0.6rem] font-bold leading-none tracking-tight whitespace-nowrap">
          Filtered
        </span>
      )}
      {n.storeyElevation !== null && n.storeyElevation !== undefined && (
        <span
          className="inline-flex items-center justify-center min-h-4 px-[5px] border border-emerald-500/30 bg-emerald-100/90 text-emerald-700 text-[0.6rem] font-bold leading-none tracking-tight whitespace-nowrap"
          title={`Elevation: ${n.storeyElevation >= 0 ? '+' : ''}${n.storeyElevation.toFixed(2)}m`}
        >
          {n.storeyElevation >= 0 ? '+' : ''}{n.storeyElevation.toFixed(2)}m
        </span>
      )}
      {n.badges?.filter((b) => !b.startsWith('EL ')).map((badge) => (
        <span key={`${n.id}-${badge}`} className="tree-badge">{badge}</span>
      ))}
      {n.elementCount !== undefined && (
        <span className="tree-badge" title={`${n.elementCount} elements`}>{n.elementCount}</span>
      )}
      {n.typeBadge && <span className="tree-badge">{n.typeBadge}</span>}
      {n.meta && (
        <span className={clsx('tree-meta-id', isActive && 'text-blue-600')}>{n.meta}</span>
      )}
    </span>
  );

  // ── Reset row ─────────────────────────────────────────────────────────────

  if (node.type === 'reset') {
    return (
      <button
        type="button"
        className="group flex items-center justify-start gap-2.5 text-left min-h-[30px] px-2 py-[0.3rem] border-0 rounded-none bg-transparent relative hover:bg-primary/6 dark:hover:bg-blue-500/8"
        style={{ ...style, paddingLeft }}
        onClick={onReset}
      >
        <span className="flex items-center min-w-0 gap-[5px]">
          {renderIcon()}
          <span className="grid min-w-0 gap-0">
            <span className="tree-name">{node.name}</span>
            <span className="tree-subtitle">{node.subtitle}</span>
          </span>
        </span>
      </button>
    );
  }

  // ── Spatial container or spatial element ───────────────────────────────────

  if (node.spatialNode) {
    const supportsVisibility = node.entityIds.length > 0;
    const isHidden = supportsVisibility && node.entityIds.every((id) => hiddenEntityIds.has(id));
    const isActive = selectedSpatialNodeIds.has(node.expressId) || selectedEntityIds.has(node.expressId);
    const isStoreyFiltered = node.ifcType === 'IFCBUILDINGSTOREY' && activeStoreyFilter === node.expressId;

    return (
      <button
        type="button"
        data-tree-node-id={node.id}
        className={clsx(
          'group tree-node',
          isActive && 'tree-node-active',
          isStoreyFiltered && 'bg-blue-200/50',
          isHidden && 'opacity-50 grayscale',
        )}
        onClick={(event) => onNodeClick(node, event)}
        onDoubleClick={(event) => { event.stopPropagation(); if (node.expressId) onFocus(node.expressId); }}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContextMenu(node, event); }}
        style={{ ...style, paddingLeft }}
        title={`${formatIfcType(node.ifcType ?? '')} · ${node.name} · #${node.expressId}`}
        disabled={node.expressId === 0}
      >
        <span className="flex items-center min-w-0 gap-[5px]">
          {renderChevron(node.expressId, node.hasChildren, node.isExpanded, isActive)}
          {supportsVisibility && renderEyeToggle(node.entityIds, isHidden)}
          {renderNodeContent(node.name, node.subtitle, isActive, isHidden, false)}
        </span>
        {renderActions(node.entityIds, node.expressId, 'spatial')}
        {renderBadges(node, isStoreyFiltered, isActive)}
      </button>
    );
  }

  // ── Element leaf (spatial-element, class-entity, type-entity) ─────────────

  if (node.type === 'element') {
    const isHidden = hiddenEntityIds.has(node.expressId);
    const isActive = selectedEntityIds.has(node.expressId);
    const isLeaf = node.depth > 0 && !node.hasChildren;

    return (
      <button
        type="button"
        data-tree-node-id={node.id}
        className={clsx(
          'group tree-node',
          isActive && 'tree-node-active',
          isHidden && 'opacity-50 grayscale',
        )}
        onClick={(event) => onNodeClick(node, event)}
        onDoubleClick={(event) => { event.stopPropagation(); onFocus(node.expressId); }}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContextMenu(node, event); }}
        style={{ ...style, paddingLeft }}
        title={`${formatIfcType(node.ifcType ?? '')} · ${node.name} · #${node.expressId}`}
      >
        <span className="flex items-center min-w-0 gap-[5px]">
          {renderEyeToggle([node.expressId], isHidden, ' entity')}
          {renderNodeContent(node.name, node.subtitle, isActive, isHidden, isLeaf)}
        </span>
        {node.ifcType && (
          <span className="shrink-0 max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap text-text-subtle text-[0.62rem] font-mono" title={formatIfcType(node.ifcType)}>
            {formatIfcType(node.ifcType)}
          </span>
        )}
        {renderActions(node.entityIds, node.expressId, 'element')}
        {node.meta && <span className={clsx('tree-meta-id', isActive && 'text-blue-600')}>{node.meta}</span>}
      </button>
    );
  }

  // ── Group nodes (type-group, type-family) ─────────────────────────────────

  const isFullyHidden = node.entityIds.length > 0 && node.entityIds.every((id) => hiddenEntityIds.has(id));
  const expandKey = node.id;

  return (
    <button
      type="button"
      className={clsx('group tree-node', isFullyHidden && 'opacity-50 grayscale')}
      style={{ ...style, paddingLeft }}
      onClick={(event) => onNodeClick(node, event)}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContextMenu(node, event); }}
    >
      <span className="flex items-center min-w-0 gap-[5px]">
        {renderChevron(expandKey, true, node.isExpanded, false)}
        {renderEyeToggle(node.entityIds, isFullyHidden, ' group')}
        {renderNodeContent(node.name, node.subtitle, false, isFullyHidden, false)}
      </span>
      {renderActions(node.entityIds, node.expressId, 'group')}
      {renderBadges(node, false, false)}
    </button>
  );
}
