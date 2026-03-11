import {
  Boxes,
  Building2,
  ChevronRight,
  FileBox,
  Folder,
  FolderTree,
  Layers3,
  Search,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useWebIfc } from '@/hooks/useWebIfc';
import { useViewerStore } from '@/stores';
import type { IfcSpatialNode } from '@/types/worker-messages';

function formatIfcType(type: string) {
  if (!type || type === 'EMPTY') {
    return 'Empty';
  }

  if (type.startsWith('IFC')) {
    return `Ifc${type
      .slice(3)
      .toLowerCase()
      .replace(/(^\w|\s\w)/g, (match) => match.toUpperCase())}`.replace(/\s/g, '');
  }

  return type;
}

function getNodeName(node: IfcSpatialNode) {
  const withNames = node as IfcSpatialNode & {
    name?: string;
    Name?: string | { value?: string };
    longName?: string;
    LongName?: string | { value?: string };
  };

  const candidates = [withNames.name, withNames.longName, withNames.Name, withNames.LongName];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const namedValue = value.value;
      if (typeof namedValue === 'string' && namedValue.trim().length > 0) {
        return namedValue.trim();
      }
    }
  }

  return null;
}

function collectExpandedIds(nodes: IfcSpatialNode[], depthLimit: number, depth = 0, ids = new Set<number>()) {
  for (const node of nodes) {
    if (node.children.length > 0 && depth < depthLimit) {
      ids.add(node.expressID);
      collectExpandedIds(node.children, depthLimit, depth + 1, ids);
    }
  }

  return ids;
}

function filterNodes(nodes: IfcSpatialNode[], query: string): IfcSpatialNode[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return nodes;
  }

  return nodes
    .map((node) => {
      const filteredChildren = filterNodes(node.children, normalizedQuery);
      const label = `${node.type} ${node.expressID} ${getNodeName(node) ?? ''}`.toLowerCase();
      if (label.includes(normalizedQuery) || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    })
    .filter((node): node is IfcSpatialNode => node !== null);
}

function countNodes(nodes: IfcSpatialNode[]): number {
  return nodes.reduce((count, node) => count + 1 + countNodes(node.children), 0);
}

export function HierarchyPanel() {
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const setSelectedEntityId = useViewerStore((state) => state.setSelectedEntityId);
  const { currentFileName, spatialTree } = useWebIfc();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setExpandedIds(collectExpandedIds(spatialTree, 2));
  }, [spatialTree]);

  const filteredNodes = useMemo(() => filterNodes(spatialTree, searchQuery), [spatialTree, searchQuery]);
  const hasSpatialTree = currentFileName !== null && filteredNodes.length > 0 && filteredNodes[0]?.expressID !== 0;
  const totalNodes = useMemo(() => countNodes(filteredNodes), [filteredNodes]);

  const toggleExpanded = (nodeId: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const renderTree = (nodes: IfcSpatialNode[], depth = 0) =>
    nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedIds.has(node.expressID) || searchQuery.trim().length > 0;
      const displayName = getNodeName(node);

      return (
        <Fragment key={node.expressID}>
          <button
            type="button"
            className={`viewer-tree__item${selectedEntityId === node.expressID ? ' is-active' : ''}`}
            onClick={() => setSelectedEntityId(node.expressID)}
            style={{ paddingLeft: `${14 + depth * 16}px` }}
            disabled={node.expressID === 0}
          >
            <span className="viewer-tree__item-main">
              <span
                className={`viewer-tree__chevron${hasChildren ? ' is-visible' : ''}${isExpanded ? ' is-expanded' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (hasChildren) {
                    toggleExpanded(node.expressID);
                  }
                }}
              >
                <ChevronRight size={13} strokeWidth={2.3} />
              </span>
              <span className="viewer-tree__icon">
                {hasChildren ? <Folder size={14} strokeWidth={2} /> : <FileBox size={14} strokeWidth={2} />}
              </span>
              <span className="viewer-tree__copy">
                <span className="viewer-tree__label">{formatIfcType(node.type)}</span>
                {displayName && <span className="viewer-tree__subtle">{displayName}</span>}
              </span>
            </span>
            <span className="viewer-tree__meta-id">#{node.expressID}</span>
          </button>
          {hasChildren && isExpanded && <div className="viewer-tree__group">{renderTree(node.children, depth + 1)}</div>}
        </Fragment>
      );
    });

  return (
    <aside className="viewer-panel viewer-panel--left">
      <div className="viewer-panel__header viewer-panel__header--stacked">
        <div className="viewer-panel__title-row">
          <span>Hierarchy</span>
          <small>{hasSpatialTree ? `${totalNodes} nodes` : 'waiting'}</small>
        </div>
        <div className="viewer-panel__tabs">
          <button type="button" className="viewer-panel__tab is-active">
            <Building2 size={14} strokeWidth={2} />
            <span>Spatial</span>
          </button>
          <button type="button" className="viewer-panel__tab" disabled>
            <Layers3 size={14} strokeWidth={2} />
            <span>Class</span>
          </button>
          <button type="button" className="viewer-panel__tab" disabled>
            <Boxes size={14} strokeWidth={2} />
            <span>Type</span>
          </button>
        </div>
      </div>
      <div className="viewer-panel__body viewer-panel__body--tree">
        <div className="viewer-panel__section viewer-panel__section--compact">
          <div className="viewer-panel__search">
            <Search size={14} strokeWidth={2} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tree..."
            />
          </div>
          <div className="viewer-panel__meta">
            <span>현재 파일</span>
            <strong>{currentFileName ?? '없음'}</strong>
          </div>
          <div className="viewer-panel__meta">
            <span>선택 엔티티</span>
            <strong>{selectedEntityId ?? '없음'}</strong>
          </div>
        </div>
        <div className="viewer-panel__scroll">
          <div className="viewer-tree viewer-tree--directory">
            {filteredNodes.length > 0 ? (
              renderTree(filteredNodes)
            ) : (
              <div className="viewer-tree__empty">
                <FolderTree size={16} strokeWidth={2} />
                <span>검색 결과가 없습니다.</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="viewer-panel__footer">
        <span>{hasSpatialTree ? 'Spatial tree synced' : 'Spatial tree idle'}</span>
        <strong>{selectedEntityId ?? 'No selection'}</strong>
      </div>
    </aside>
  );
}
