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
import { formatIfcType } from './treeDataBuilder';

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

function resolveIfcIcon(ifcType: string | undefined): string | null {
  if (!ifcType) return null;
  const formatted = formatIfcType(ifcType);
  return IFC_ICON_CODEPOINTS[formatted] ?? null;
}

function TreeAction({
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
}

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

  const renderIcon = () => {
    if (iconCodepoint) {
      return (
        <span className="inline-flex items-center justify-center text-[#7c8ba1]">
          <span className="material-symbols-outlined text-[14px] leading-none select-none">{iconCodepoint}</span>
        </span>
      );
    }

    // Fallback for reset and non-IFC nodes
    if (node.type === 'reset') {
      const Icon = node.subtitle?.includes('\ud074\ub798\uc2a4') ? Layers3 : Boxes;
      return (
        <span className="inline-flex items-center justify-center text-[#7c8ba1]">
          <Icon size={14} strokeWidth={2} />
        </span>
      );
    }

    return (
      <span className="inline-flex items-center justify-center text-[#7c8ba1]">
        <span className="material-symbols-outlined text-[14px] leading-none select-none">{IFC_ICON_DEFAULT}</span>
      </span>
    );
  };

  // --- Reset row ---
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
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.74rem] font-semibold leading-[1.15] dark:text-slate-200">{node.name}</span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.65rem] leading-[1.1] dark:text-slate-400">{node.subtitle}</span>
          </span>
        </span>
      </button>
    );
  }

  // --- Spatial container or spatial element ---
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
          'group flex items-center justify-start gap-2.5 text-left min-h-[30px] px-2 py-[0.3rem] border-0 rounded-none bg-transparent relative hover:bg-primary/6 dark:hover:bg-blue-500/8',
          isActive && 'bg-primary/10 text-primary-text shadow-[inset_3px_0_0_#2563eb] dark:bg-blue-500/15',
          isStoreyFiltered && 'bg-blue-200/50',
        )}
        onClick={(event) => onNodeClick(node, event)}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContextMenu(node, event); }}
        style={{ ...style, paddingLeft }}
        disabled={node.expressId === 0}
      >
        <span className="flex items-center min-w-0 gap-[5px]">
          <span
            className={clsx(
              'inline-flex items-center justify-center w-3 text-text-subtle opacity-0 [&>svg]:transition-transform [&>svg]:duration-150 [&>svg]:ease-in-out',
              node.hasChildren && 'opacity-100',
              node.isExpanded && '[&>svg]:rotate-90',
              isActive && 'text-blue-600',
            )}
            onClick={(event) => {
              event.stopPropagation();
              if (node.hasChildren) {
                onToggleExpand(node.expressId);
              }
            }}
          >
            <ChevronRight size={13} strokeWidth={2.3} />
          </span>

          {/* Visibility toggle (ifc-lite style: hover reveal) */}
          {supportsVisibility && (
            <span
              className={clsx(
                'inline-flex items-center justify-center w-[18px] h-[18px] p-0 border-0 rounded-full bg-transparent text-text-subtle cursor-pointer opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-slate-700 hover:bg-slate-400/16',
                isHidden && 'opacity-100',
              )}
              role="button"
              tabIndex={0}
              aria-label={isHidden ? 'Show' : 'Hide'}
              title={isHidden ? 'Show' : 'Hide'}
              onClick={(event) => {
                event.stopPropagation();
                onVisibilityToggle(node.entityIds);
              }}
            >
              {isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
            </span>
          )}

          {renderIcon()}
          <span className="grid min-w-0 gap-0">
            <span className={clsx('overflow-hidden text-ellipsis whitespace-nowrap text-[0.74rem] font-semibold leading-[1.15] dark:text-slate-200', isActive && 'text-primary-text')}>{node.name}</span>
            {node.subtitle && <span className="overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.65rem] leading-[1.1] dark:text-slate-400">{node.subtitle}</span>}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <TreeAction
            label="Isolate group"
            icon={<Layers3 size={13} strokeWidth={2} />}
            onActivate={() => onIsolate(node.entityIds)}
            accent
          />
        </span>
        <span className="inline-flex items-center gap-1 ml-1.5 flex-wrap justify-end">
          {isStoreyFiltered && <span className="inline-flex items-center justify-center min-h-4 px-[5px] border border-primary/24 bg-blue-100/92 text-primary-text text-[0.6rem] font-bold leading-none tracking-tight whitespace-nowrap">Filtered</span>}
          {/* Elevation badge (emerald, ifc-lite style) */}
          {node.storeyElevation !== null && node.storeyElevation !== undefined && (
            <span className="inline-flex items-center justify-center min-h-4 px-[5px] border border-emerald-500/30 bg-emerald-100/90 text-emerald-700 text-[0.6rem] font-bold leading-none tracking-tight whitespace-nowrap" title={`Elevation: ${node.storeyElevation >= 0 ? '+' : ''}${node.storeyElevation.toFixed(2)}m`}>
              {node.storeyElevation >= 0 ? '+' : ''}{node.storeyElevation.toFixed(2)}m
            </span>
          )}
          {node.badges?.filter((b) => !b.startsWith('EL ')).map((badge) => (
            <span key={`${node.id}-${badge}`} className="inline-flex items-center justify-center min-h-4 px-[5px] border border-border-subtle bg-slate-50/92 text-text-secondary text-[0.6rem] font-bold leading-none tracking-tight whitespace-nowrap dark:border-slate-600 dark:bg-slate-800/92 dark:text-slate-400">
              {badge}
            </span>
          ))}
          {node.meta && <span className={clsx('shrink-0 text-text-muted text-[0.63rem] font-mono opacity-90', isActive && 'text-blue-600')}>{node.meta}</span>}
        </span>
      </button>
    );
  }

  // --- Element leaf (spatial-element, class-entity, type-entity) ---
  if (node.type === 'element') {
    const isHidden = hiddenEntityIds.has(node.expressId);
    const isActive = selectedEntityIds.has(node.expressId);
    const isLeaf = node.depth > 0 && !node.hasChildren;

    return (
      <button
        type="button"
        data-tree-node-id={node.id}
        className={clsx(
          'group flex items-center justify-start gap-2.5 text-left min-h-[30px] px-2 py-[0.3rem] border-0 rounded-none bg-transparent relative hover:bg-primary/6 dark:hover:bg-blue-500/8',
          isActive && 'bg-primary/10 text-primary-text shadow-[inset_3px_0_0_#2563eb] dark:bg-blue-500/15',
        )}
        onClick={(event) => onNodeClick(node, event)}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContextMenu(node, event); }}
        style={{ ...style, paddingLeft }}
      >
        <span className="flex items-center min-w-0 gap-[5px]">
          {/* Visibility toggle for elements (ifc-lite style) */}
          <span
            className={clsx(
              'inline-flex items-center justify-center w-[18px] h-[18px] p-0 border-0 rounded-full bg-transparent text-text-subtle cursor-pointer opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-slate-700 hover:bg-slate-400/16',
              isHidden && 'opacity-100',
            )}
            role="button"
            tabIndex={0}
            aria-label={isHidden ? 'Show entity' : 'Hide entity'}
            title={isHidden ? 'Show entity' : 'Hide entity'}
            onClick={(event) => {
              event.stopPropagation();
              onVisibilityToggle([node.expressId]);
            }}
          >
            {isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
          </span>

          {renderIcon()}
          <span className="grid min-w-0 gap-0">
            <span className={clsx(
              'overflow-hidden text-ellipsis whitespace-nowrap text-[0.74rem] font-semibold leading-[1.15] dark:text-slate-200',
              isLeaf && 'text-[0.75rem] font-medium',
              isActive && 'text-primary-text',
            )}>{node.name}</span>
            <span className={clsx(
              'overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.65rem] leading-[1.1] dark:text-slate-400',
              isLeaf && 'text-[0.65rem]',
            )}>{node.subtitle}</span>
          </span>
        </span>
        {/* Element ifcType display (ifc-lite style) */}
        {node.ifcType && (
          <span className="shrink-0 max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap text-text-subtle text-[0.62rem] font-mono" title={formatIfcType(node.ifcType)}>
            {formatIfcType(node.ifcType)}
          </span>
        )}
        <span className="inline-flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <TreeAction
            label="Focus entity"
            icon={<Focus size={13} strokeWidth={2} />}
            onActivate={() => onFocus(node.expressId)}
            accent
          />
        </span>
        {node.meta && <span className={clsx('shrink-0 text-text-muted text-[0.63rem] font-mono opacity-90', isActive && 'text-blue-600')}>{node.meta}</span>}
      </button>
    );
  }

  // --- Group nodes (type-group, type-family) ---
  const isFullyHidden = node.entityIds.length > 0 && node.entityIds.every((id) => hiddenEntityIds.has(id));
  const expandKey = node.id;

  return (
    <button
      type="button"
      className="group flex items-center justify-start gap-2.5 text-left min-h-[30px] px-2 py-[0.3rem] border-0 rounded-none bg-transparent relative hover:bg-primary/6 dark:hover:bg-blue-500/8"
      style={{ ...style, paddingLeft }}
      onClick={(event) => onNodeClick(node, event)}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContextMenu(node, event); }}
    >
      <span className="flex items-center min-w-0 gap-[5px]">
        <span
          className={clsx(
            'inline-flex items-center justify-center w-3 text-text-subtle opacity-100 [&>svg]:transition-transform [&>svg]:duration-150 [&>svg]:ease-in-out',
            node.isExpanded && '[&>svg]:rotate-90',
          )}
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand(expandKey);
          }}
        >
          <ChevronRight size={13} strokeWidth={2.3} />
        </span>

        {/* Visibility toggle for groups (ifc-lite style) */}
        <span
          className={clsx(
            'inline-flex items-center justify-center w-[18px] h-[18px] p-0 border-0 rounded-full bg-transparent text-text-subtle cursor-pointer opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-slate-700 hover:bg-slate-400/16',
            isFullyHidden && 'opacity-100',
          )}
          role="button"
          tabIndex={0}
          aria-label={isFullyHidden ? 'Show group' : 'Hide group'}
          title={isFullyHidden ? 'Show group' : 'Hide group'}
          onClick={(event) => {
            event.stopPropagation();
            onVisibilityToggle(node.entityIds);
          }}
        >
          {isFullyHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
        </span>

        {renderIcon()}
        <span className="grid min-w-0 gap-0">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.74rem] font-semibold leading-[1.15] dark:text-slate-200">{node.name}</span>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-text-muted text-[0.65rem] leading-[1.1] dark:text-slate-400">{node.subtitle}</span>
        </span>
      </span>
      <span className="inline-flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <TreeAction
          label="Isolate group"
          icon={<Layers3 size={13} strokeWidth={2} />}
          onActivate={() => onIsolate(node.entityIds)}
          accent
        />
      </span>
      <span className="inline-flex items-center gap-1 ml-1.5 flex-wrap justify-end">
        {/* Element count badge */}
        {node.elementCount !== undefined && (
          <span className="inline-flex items-center justify-center min-h-4 px-[5px] border border-border-subtle bg-slate-50/92 text-text-secondary text-[0.6rem] font-bold leading-none tracking-tight whitespace-nowrap dark:border-slate-600 dark:bg-slate-800/92 dark:text-slate-400" title={`${node.elementCount} elements`}>
            {node.elementCount}
          </span>
        )}
        {node.typeBadge && <span className="inline-flex items-center justify-center min-h-4 px-[5px] border border-border-subtle bg-slate-50/92 text-text-secondary text-[0.6rem] font-bold leading-none tracking-tight whitespace-nowrap dark:border-slate-600 dark:bg-slate-800/92 dark:text-slate-400">{node.typeBadge}</span>}
        <span className="shrink-0 text-text-muted text-[0.63rem] font-mono opacity-90">{node.meta}</span>
      </span>
    </button>
  );
}
