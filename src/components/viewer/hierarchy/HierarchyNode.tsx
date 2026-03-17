import {
  Boxes,
  ChevronRight,
  Eye,
  EyeOff,
  Focus,
  Layers3,
} from 'lucide-react';
import type { TreeNode } from './types';
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
      className={`viewer-tree__action${accent ? ' viewer-tree__action--accent' : ''}`}
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
}: HierarchyNodeProps) {
  const paddingLeft = `${14 + node.depth * 16}px`;
  const iconCodepoint = resolveIfcIcon(node.ifcType);

  const renderIcon = () => {
    if (iconCodepoint) {
      return (
        <span className="viewer-tree__icon">
          <span className="material-symbols-outlined">{iconCodepoint}</span>
        </span>
      );
    }

    // Fallback for reset and non-IFC nodes
    if (node.type === 'reset') {
      const Icon = node.subtitle?.includes('클래스') ? Layers3 : Boxes;
      return (
        <span className="viewer-tree__icon">
          <Icon size={14} strokeWidth={2} />
        </span>
      );
    }

    return (
      <span className="viewer-tree__icon">
        <span className="material-symbols-outlined">{IFC_ICON_DEFAULT}</span>
      </span>
    );
  };

  // --- Reset row ---
  if (node.type === 'reset') {
    return (
      <button
        type="button"
        className="viewer-tree__item viewer-tree__item--type"
        style={{ ...style, paddingLeft }}
        onClick={onReset}
      >
        <span className="viewer-tree__item-main">
          {renderIcon()}
          <span className="viewer-tree__copy">
            <span className="viewer-tree__label">{node.name}</span>
            <span className="viewer-tree__subtle">{node.subtitle}</span>
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
        className={`viewer-tree__item${isActive ? ' is-active' : ''}${isStoreyFiltered ? ' is-filtered' : ''}`}
        onClick={(event) => onNodeClick(node, event)}
        style={{ ...style, paddingLeft }}
        disabled={node.expressId === 0}
      >
        <span className="viewer-tree__item-main">
          <span
            className={`viewer-tree__chevron${node.hasChildren ? ' is-visible' : ''}${node.isExpanded ? ' is-expanded' : ''}`}
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
              className={`viewer-tree__visibility${isHidden ? ' viewer-tree__visibility--visible' : ''}`}
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
          <span className="viewer-tree__copy">
            <span className="viewer-tree__label">{node.name}</span>
            {node.subtitle && <span className="viewer-tree__subtle">{node.subtitle}</span>}
          </span>
        </span>
        <span className="viewer-tree__actions">
          <TreeAction
            label="Isolate group"
            icon={<Layers3 size={13} strokeWidth={2} />}
            onActivate={() => onIsolate(node.entityIds)}
            accent
          />
        </span>
        <span className="viewer-tree__meta-group">
          {isStoreyFiltered && <span className="viewer-tree__badge viewer-tree__badge--accent">Filtered</span>}
          {/* Elevation badge (emerald, ifc-lite style) */}
          {node.storeyElevation !== null && node.storeyElevation !== undefined && (
            <span className="viewer-tree__badge viewer-tree__badge--elevation" title={`Elevation: ${node.storeyElevation >= 0 ? '+' : ''}${node.storeyElevation.toFixed(2)}m`}>
              {node.storeyElevation >= 0 ? '+' : ''}{node.storeyElevation.toFixed(2)}m
            </span>
          )}
          {node.badges?.filter((b) => !b.startsWith('EL ')).map((badge) => (
            <span key={`${node.id}-${badge}`} className="viewer-tree__badge">
              {badge}
            </span>
          ))}
          {node.meta && <span className="viewer-tree__meta-id">{node.meta}</span>}
        </span>
      </button>
    );
  }

  // --- Element leaf (spatial-element, class-entity, type-entity) ---
  if (node.type === 'element') {
    const isHidden = hiddenEntityIds.has(node.expressId);
    const isActive = selectedEntityIds.has(node.expressId);

    return (
      <button
        type="button"
        data-tree-node-id={node.id}
        className={`viewer-tree__item${node.depth > 0 && !node.hasChildren ? ' viewer-tree__item--leaf' : ''}${isActive ? ' is-active' : ''}`}
        onClick={(event) => onNodeClick(node, event)}
        style={{ ...style, paddingLeft }}
      >
        <span className="viewer-tree__item-main">
          {/* Visibility toggle for elements (ifc-lite style) */}
          <span
            className={`viewer-tree__visibility${isHidden ? ' viewer-tree__visibility--visible' : ''}`}
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
          <span className="viewer-tree__copy">
            <span className="viewer-tree__label">{node.name}</span>
            <span className="viewer-tree__subtle">{node.subtitle}</span>
          </span>
        </span>
        {/* Element ifcType display (ifc-lite style) */}
        {node.ifcType && (
          <span className="viewer-tree__element-type" title={formatIfcType(node.ifcType)}>
            {formatIfcType(node.ifcType)}
          </span>
        )}
        <span className="viewer-tree__actions">
          <TreeAction
            label="Focus entity"
            icon={<Focus size={13} strokeWidth={2} />}
            onActivate={() => onFocus(node.expressId)}
            accent
          />
        </span>
        {node.meta && <span className="viewer-tree__meta-id">{node.meta}</span>}
      </button>
    );
  }

  // --- Group nodes (type-group, type-family) ---
  const isFullyHidden = node.entityIds.length > 0 && node.entityIds.every((id) => hiddenEntityIds.has(id));
  const expandKey = node.id;

  return (
    <button
      type="button"
      className="viewer-tree__item viewer-tree__item--type"
      style={{ ...style, paddingLeft }}
      onClick={(event) => onNodeClick(node, event)}
    >
      <span className="viewer-tree__item-main">
        <span
          className={`viewer-tree__chevron is-visible${node.isExpanded ? ' is-expanded' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand(expandKey);
          }}
        >
          <ChevronRight size={13} strokeWidth={2.3} />
        </span>

        {/* Visibility toggle for groups (ifc-lite style) */}
        <span
          className={`viewer-tree__visibility${isFullyHidden ? ' viewer-tree__visibility--visible' : ''}`}
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
        <span className="viewer-tree__copy">
          <span className="viewer-tree__label">{node.name}</span>
          <span className="viewer-tree__subtle">{node.subtitle}</span>
        </span>
      </span>
      <span className="viewer-tree__actions">
        <TreeAction
          label="Isolate group"
          icon={<Layers3 size={13} strokeWidth={2} />}
          onActivate={() => onIsolate(node.entityIds)}
          accent
        />
      </span>
      <span className="viewer-tree__meta-group">
        {/* Element count badge */}
        {node.elementCount !== undefined && (
          <span className="viewer-tree__badge" title={`${node.elementCount} elements`}>
            {node.elementCount}
          </span>
        )}
        {node.typeBadge && <span className="viewer-tree__badge">{node.typeBadge}</span>}
        <span className="viewer-tree__meta-id">{node.meta}</span>
      </span>
    </button>
  );
}
