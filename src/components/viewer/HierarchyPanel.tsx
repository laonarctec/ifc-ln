import { Boxes, Building2, ChevronRight, FileBox, Folder, FolderTree, Layers3, Search } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useWebIfc } from '@/hooks/useWebIfc';
import { useViewportGeometry } from '@/services/viewportGeometryStore';
import { useViewerStore } from '@/stores';
import type { IfcSpatialNode } from '@/types/worker-messages';
import { resolveIfcClass } from '@/utils/ifc-class';

type HierarchyTab = 'spatial' | 'class' | 'type';

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
  const setActiveClassFilter = useViewerStore((state) => state.setActiveClassFilter);
  const setActiveTypeFilter = useViewerStore((state) => state.setActiveTypeFilter);
  const {
    currentFileName,
    spatialTree,
    activeClassFilter,
    activeTypeFilter,
  } = useWebIfc();
  const { meshes } = useViewportGeometry();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [activeTab, setActiveTab] = useState<HierarchyTab>('spatial');

  useEffect(() => {
    setExpandedIds(collectExpandedIds(spatialTree, 2));
  }, [spatialTree]);

  const filteredNodes = useMemo(() => filterNodes(spatialTree, searchQuery), [spatialTree, searchQuery]);
  const hasSpatialTree = currentFileName !== null && filteredNodes.length > 0 && filteredNodes[0]?.expressID !== 0;
  const totalNodes = useMemo(() => countNodes(filteredNodes), [filteredNodes]);
  const typeItems = useMemo(() => {
    const counts = new Map<string, number>();
    meshes.forEach((mesh) => {
      counts.set(mesh.ifcType, (counts.get(mesh.ifcType) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .filter(([type]) =>
        searchQuery.trim().length === 0
          ? true
          : type.toLowerCase().includes(searchQuery.trim().toLowerCase())
      );
  }, [meshes, searchQuery]);
  const classItems = useMemo(() => {
    const counts = new Map<string, number>();
    meshes.forEach((mesh) => {
      const className = resolveIfcClass(mesh.ifcType);
      counts.set(className, (counts.get(className) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .filter(([className]) =>
        searchQuery.trim().length === 0
          ? true
          : className.toLowerCase().includes(searchQuery.trim().toLowerCase())
      );
  }, [meshes, searchQuery]);

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
          <small>
            {activeTab === 'spatial'
              ? hasSpatialTree
                ? `${totalNodes} nodes`
                : 'waiting'
              : activeTab === 'class'
                ? `${classItems.length} classes`
                : `${typeItems.length} types`}
          </small>
        </div>
        <div className="viewer-panel__tabs">
          <button
            type="button"
            className={`viewer-panel__tab${activeTab === 'spatial' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('spatial')}
          >
            <Building2 size={14} strokeWidth={2} />
            <span>Spatial</span>
          </button>
          <button
            type="button"
            className={`viewer-panel__tab${activeTab === 'class' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('class')}
          >
            <Layers3 size={14} strokeWidth={2} />
            <span>Class</span>
          </button>
          <button
            type="button"
            className={`viewer-panel__tab${activeTab === 'type' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('type')}
          >
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
              placeholder={
                activeTab === 'spatial'
                  ? 'Search tree...'
                  : activeTab === 'class'
                    ? 'Search classes...'
                    : 'Search types...'
              }
            />
          </div>
          <div className="viewer-panel__meta">
            <span>현재 파일</span>
            <strong>{currentFileName ?? '없음'}</strong>
          </div>
          <div className="viewer-panel__meta">
            <span>
              {activeTab === 'spatial'
                ? '선택 엔티티'
                : activeTab === 'class'
                  ? '활성 클래스 필터'
                  : '활성 타입 필터'}
            </span>
            <strong>
              {activeTab === 'spatial'
                ? selectedEntityId ?? '없음'
                : activeTab === 'class'
                  ? activeClassFilter ?? '없음'
                  : activeTypeFilter ?? '없음'}
            </strong>
          </div>
        </div>
        <div className="viewer-panel__scroll">
          {activeTab === 'spatial' ? (
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
          ) : activeTab === 'class' ? (
            <div className="viewer-tree viewer-tree--directory">
              <button
                type="button"
                className={`viewer-tree__item viewer-tree__item--type${activeClassFilter === null ? ' is-active' : ''}`}
                onClick={() => setActiveClassFilter(null)}
              >
                <span className="viewer-tree__item-main">
                  <span className="viewer-tree__icon">
                    <Layers3 size={14} strokeWidth={2} />
                  </span>
                  <span className="viewer-tree__copy">
                    <span className="viewer-tree__label">All Classes</span>
                    <span className="viewer-tree__subtle">전체 클래스 표시</span>
                  </span>
                </span>
              </button>
              {classItems.length > 0 ? (
                classItems.map(([className, count]) => (
                  <button
                    key={className}
                    type="button"
                    className={`viewer-tree__item viewer-tree__item--type${activeClassFilter === className ? ' is-active' : ''}`}
                    onClick={() => setActiveClassFilter(className)}
                  >
                    <span className="viewer-tree__item-main">
                      <span className="viewer-tree__icon">
                        <Layers3 size={14} strokeWidth={2} />
                      </span>
                      <span className="viewer-tree__copy">
                        <span className="viewer-tree__label">{className}</span>
                        <span className="viewer-tree__subtle">{count} elements</span>
                      </span>
                    </span>
                    <span className="viewer-tree__meta-id">{count}</span>
                  </button>
                ))
              ) : (
                <div className="viewer-tree__empty">
                  <Layers3 size={16} strokeWidth={2} />
                  <span>표시할 클래스가 없습니다.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="viewer-tree viewer-tree--directory">
              <button
                type="button"
                className={`viewer-tree__item viewer-tree__item--type${activeTypeFilter === null ? ' is-active' : ''}`}
                onClick={() => setActiveTypeFilter(null)}
              >
                <span className="viewer-tree__item-main">
                  <span className="viewer-tree__icon">
                    <Boxes size={14} strokeWidth={2} />
                  </span>
                  <span className="viewer-tree__copy">
                    <span className="viewer-tree__label">All Types</span>
                    <span className="viewer-tree__subtle">전체 타입 표시</span>
                  </span>
                </span>
              </button>
              {typeItems.length > 0 ? (
                typeItems.map(([type, count]) => (
                  <button
                    key={type}
                    type="button"
                    className={`viewer-tree__item viewer-tree__item--type${activeTypeFilter === type ? ' is-active' : ''}`}
                    onClick={() => setActiveTypeFilter(type)}
                  >
                    <span className="viewer-tree__item-main">
                      <span className="viewer-tree__icon">
                        <Boxes size={14} strokeWidth={2} />
                      </span>
                      <span className="viewer-tree__copy">
                        <span className="viewer-tree__label">{type}</span>
                        <span className="viewer-tree__subtle">{count} elements</span>
                      </span>
                    </span>
                    <span className="viewer-tree__meta-id">{count}</span>
                  </button>
                ))
              ) : (
                <div className="viewer-tree__empty">
                  <Boxes size={16} strokeWidth={2} />
                  <span>표시할 타입이 없습니다.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="viewer-panel__footer">
        <span>
          {activeTab === 'spatial'
            ? hasSpatialTree
              ? 'Spatial tree synced'
              : 'Spatial tree idle'
            : activeTab === 'class'
              ? activeClassFilter
                ? 'Class filter active'
                : 'Class filter idle'
              : activeTypeFilter
                ? 'Type filter active'
                : 'Type filter idle'}
        </span>
        <strong>
          {activeTab === 'spatial'
            ? selectedEntityId ?? 'No selection'
            : activeTab === 'class'
              ? activeClassFilter ?? 'All'
              : activeTypeFilter ?? 'All'}
        </strong>
      </div>
    </aside>
  );
}
