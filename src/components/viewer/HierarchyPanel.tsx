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
import { Fragment, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useWebIfc } from '@/hooks/useWebIfc';
import { useViewportGeometry } from '@/services/viewportGeometryStore';
import { useViewerStore } from '@/stores';
import type { IfcSpatialNode } from '@/types/worker-messages';

type HierarchyTab = 'spatial' | 'class' | 'type';

interface EntitySummary {
  expressId: number;
  ifcType: string;
  name: string | null;
  label: string;
}

interface ClassGroup {
  key: string;
  label: string;
  entityIds: number[];
  children: EntitySummary[];
}

interface TypeFamily {
  key: string;
  label: string;
  ifcType: string;
  entityIds: number[];
  children: EntitySummary[];
}

interface TypeGroup {
  key: string;
  label: string;
  entityIds: number[];
  families: TypeFamily[];
}

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

function collectExpandedIds(
  nodes: IfcSpatialNode[],
  depthLimit: number,
  depth = 0,
  ids = new Set<number>()
) {
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

function findNodePath(nodes: IfcSpatialNode[], targetId: number, path: number[] = []): number[] | null {
  for (const node of nodes) {
    const nextPath = [...path, node.expressID];
    if (node.expressID === targetId) {
      return nextPath;
    }

    const childPath = findNodePath(node.children, targetId, nextPath);
    if (childPath) {
      return childPath;
    }
  }

  return null;
}

function buildEntityNameMap(nodes: IfcSpatialNode[], result = new Map<number, string>()) {
  for (const node of nodes) {
    const name = getNodeName(node);
    if (name) {
      result.set(node.expressID, name);
    }
    buildEntityNameMap(node.children, result);
  }
  return result;
}

function normalizeTypeLabel(name: string | null, ifcType: string) {
  if (!name || name.trim().length === 0) {
    return `Unnamed ${formatIfcType(ifcType)}`;
  }
  return name.trim();
}

function matchesSearch(query: string, ...values: Array<string | null | undefined>) {
  if (query.length === 0) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(query));
}

export function HierarchyPanel() {
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const setSelectedEntityId = useViewerStore((state) => state.setSelectedEntityId);
  const resetHiddenEntities = useViewerStore((state) => state.resetHiddenEntities);
  const isolateEntities = useViewerStore((state) => state.isolateEntities);
  const setActiveClassFilter = useViewerStore((state) => state.setActiveClassFilter);
  const setActiveTypeFilter = useViewerStore((state) => state.setActiveTypeFilter);
  const { currentFileName, spatialTree } = useWebIfc();
  const { meshes } = useViewportGeometry();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(() => new Set());
  const [activeTab, setActiveTab] = useState<HierarchyTab>('spatial');

  useEffect(() => {
    setExpandedIds(collectExpandedIds(spatialTree, 2) as Set<string | number>);
  }, [spatialTree]);

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const entityNameMap = useMemo(() => buildEntityNameMap(spatialTree), [spatialTree]);
  const entityIds = useMemo(() => [...new Set(meshes.map((mesh) => mesh.expressId))], [meshes]);

  const entities = useMemo(() => {
    const deduped = new Map<number, EntitySummary>();

    meshes.forEach((mesh) => {
      if (deduped.has(mesh.expressId)) {
        return;
      }

      const name = entityNameMap.get(mesh.expressId) ?? null;
      deduped.set(mesh.expressId, {
        expressId: mesh.expressId,
        ifcType: mesh.ifcType,
        name,
        label: name ?? `${formatIfcType(mesh.ifcType)} #${mesh.expressId}`,
      });
    });

    return [...deduped.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [entityNameMap, meshes]);

  const filteredNodes = useMemo(
    () => filterNodes(spatialTree, normalizedSearchQuery),
    [normalizedSearchQuery, spatialTree]
  );
  const hasSpatialTree =
    currentFileName !== null && filteredNodes.length > 0 && filteredNodes[0]?.expressID !== 0;
  const totalNodes = useMemo(() => countNodes(filteredNodes), [filteredNodes]);

  const classGroups = useMemo(() => {
    const grouped = new Map<string, EntitySummary[]>();

    entities.forEach((entity) => {
      if (!grouped.has(entity.ifcType)) {
        grouped.set(entity.ifcType, []);
      }
      grouped.get(entity.ifcType)?.push(entity);
    });

    return [...grouped.entries()]
      .map(([ifcType, items]) => ({
        key: `class-${ifcType}`,
        label: ifcType,
        entityIds: items.map((item) => item.expressId),
        children: items,
      }))
      .filter((group) =>
        matchesSearch(
          normalizedSearchQuery,
          group.label,
          ...group.children.flatMap((child) => [child.label, child.name, String(child.expressId)])
        )
      )
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [entities, normalizedSearchQuery]);

  const typeGroups = useMemo(() => {
    const byIfcType = new Map<string, Map<string, EntitySummary[]>>();

    entities.forEach((entity) => {
      const familyLabel = normalizeTypeLabel(entity.name, entity.ifcType);
      if (!byIfcType.has(entity.ifcType)) {
        byIfcType.set(entity.ifcType, new Map());
      }

      const familyMap = byIfcType.get(entity.ifcType)!;
      if (!familyMap.has(familyLabel)) {
        familyMap.set(familyLabel, []);
      }
      familyMap.get(familyLabel)?.push(entity);
    });

    return [...byIfcType.entries()]
      .map(([ifcType, familyMap]) => {
        const families: TypeFamily[] = [...familyMap.entries()]
          .map(([label, items]) => ({
            key: `type-family-${ifcType}-${label}`,
            label,
            ifcType,
            entityIds: items.map((item) => item.expressId),
            children: items.sort((left, right) => left.label.localeCompare(right.label)),
          }))
          .filter((family) =>
            matchesSearch(
              normalizedSearchQuery,
              family.label,
              family.ifcType,
              ...family.children.flatMap((child) => [child.label, child.name, String(child.expressId)])
            )
          )
          .sort((left, right) => left.label.localeCompare(right.label));

        return {
          key: `type-class-${ifcType}`,
          label: ifcType,
          entityIds: families.flatMap((family) => family.entityIds),
          families,
        } satisfies TypeGroup;
      })
      .filter((group) => group.families.length > 0)
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [entities, normalizedSearchQuery]);

  useEffect(() => {
    if (selectedEntityId === null) {
      return;
    }

    if (activeTab === 'spatial') {
      const path = findNodePath(spatialTree, selectedEntityId);
      if (!path) {
        return;
      }

      setExpandedIds((current) => {
        const next = new Set(current);
        path.slice(0, -1).forEach((nodeId) => next.add(nodeId));
        return next;
      });

      const frameId = window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-tree-node-id="spatial-${selectedEntityId}"]`)
          ?.scrollIntoView({ block: 'nearest' });
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    if (activeTab === 'class') {
      const group = classGroups.find((item) => item.entityIds.includes(selectedEntityId));
      if (!group) {
        return;
      }

      setExpandedIds((current) => {
        const next = new Set(current);
        next.add(group.key);
        return next;
      });

      const frameId = window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-tree-node-id="class-entity-${selectedEntityId}"]`)
          ?.scrollIntoView({ block: 'nearest' });
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    const typeGroup = typeGroups.find((group) =>
      group.families.some((family) => family.entityIds.includes(selectedEntityId))
    );
    const typeFamily = typeGroup?.families.find((family) => family.entityIds.includes(selectedEntityId));
    if (!typeGroup || !typeFamily) {
      return;
    }

    setExpandedIds((current) => {
      const next = new Set(current);
      next.add(typeGroup.key);
      next.add(typeFamily.key);
      return next;
    });

    const frameId = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-tree-node-id="type-entity-${selectedEntityId}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, classGroups, selectedEntityId, spatialTree, typeGroups]);

  const clearSemanticFilters = () => {
    setActiveClassFilter(null);
    setActiveTypeFilter(null);
  };

  const toggleExpanded = (nodeId: string | number) => {
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

  const handleSpatialNodeClick = (node: IfcSpatialNode) => {
    setSelectedEntityId(node.expressID);
    if (node.children.length > 0) {
      toggleExpanded(node.expressID);
    }
  };

  const handleGroupIsolate = (targetEntityIds: number[]) => {
    clearSemanticFilters();
    setSelectedEntityId(null);
    isolateEntities(targetEntityIds, entityIds);
  };

  const handleResetGroupView = () => {
    clearSemanticFilters();
    resetHiddenEntities();
  };

  const renderSpatialTree = (nodes: IfcSpatialNode[], depth = 0) =>
    nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedIds.has(node.expressID) || normalizedSearchQuery.length > 0;
      const displayName = getNodeName(node);

      return (
        <Fragment key={node.expressID}>
          <button
            type="button"
            data-tree-node-id={`spatial-${node.expressID}`}
            className={`viewer-tree__item${selectedEntityId === node.expressID ? ' is-active' : ''}`}
            onClick={() => handleSpatialNodeClick(node)}
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
          {hasChildren && isExpanded && (
            <div className="viewer-tree__group">{renderSpatialTree(node.children, depth + 1)}</div>
          )}
        </Fragment>
      );
    });

  const renderClassTree = () => (
    <div className="viewer-tree viewer-tree--directory">
      <button
        type="button"
        className="viewer-tree__item viewer-tree__item--type"
        onClick={handleResetGroupView}
      >
        <span className="viewer-tree__item-main">
          <span className="viewer-tree__icon">
            <Layers3 size={14} strokeWidth={2} />
          </span>
          <span className="viewer-tree__copy">
            <span className="viewer-tree__label">All Classes</span>
            <span className="viewer-tree__subtle">전체 IFC 클래스 표시</span>
          </span>
        </span>
      </button>
      {classGroups.length > 0 ? (
        classGroups.map((group) => {
          const isExpanded = expandedIds.has(group.key);

          return (
            <Fragment key={group.key}>
              <button
                type="button"
                className="viewer-tree__item viewer-tree__item--type"
                onClick={() => handleGroupIsolate(group.entityIds)}
              >
                <span className="viewer-tree__item-main">
                  <span
                    className={`viewer-tree__chevron is-visible${isExpanded ? ' is-expanded' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleExpanded(group.key);
                    }}
                  >
                    <ChevronRight size={13} strokeWidth={2.3} />
                  </span>
                  <span className="viewer-tree__icon">
                    <Layers3 size={14} strokeWidth={2} />
                  </span>
                  <span className="viewer-tree__copy">
                    <span className="viewer-tree__label">{group.label}</span>
                    <span className="viewer-tree__subtle">{group.children.length} elements</span>
                  </span>
                </span>
                <span className="viewer-tree__meta-id">{group.children.length}</span>
              </button>
              {isExpanded && (
                <div className="viewer-tree__group">
                  {group.children.map((child) => (
                    <button
                      key={`class-entity-${child.expressId}`}
                      type="button"
                      data-tree-node-id={`class-entity-${child.expressId}`}
                      className={`viewer-tree__item${selectedEntityId === child.expressId ? ' is-active' : ''}`}
                      onClick={() => setSelectedEntityId(child.expressId)}
                      style={{ paddingLeft: '30px' }}
                    >
                      <span className="viewer-tree__item-main">
                        <span className="viewer-tree__icon">
                          <FileBox size={14} strokeWidth={2} />
                        </span>
                        <span className="viewer-tree__copy">
                          <span className="viewer-tree__label">{child.label}</span>
                          <span className="viewer-tree__subtle">{formatIfcType(child.ifcType)}</span>
                        </span>
                      </span>
                      <span className="viewer-tree__meta-id">#{child.expressId}</span>
                    </button>
                  ))}
                </div>
              )}
            </Fragment>
          );
        })
      ) : (
        <div className="viewer-tree__empty">
          <Layers3 size={16} strokeWidth={2} />
          <span>표시할 클래스가 없습니다.</span>
        </div>
      )}
    </div>
  );

  const renderTypeTree = () => (
    <div className="viewer-tree viewer-tree--directory">
      <button
        type="button"
        className="viewer-tree__item viewer-tree__item--type"
        onClick={handleResetGroupView}
      >
        <span className="viewer-tree__item-main">
          <span className="viewer-tree__icon">
            <Boxes size={14} strokeWidth={2} />
          </span>
          <span className="viewer-tree__copy">
            <span className="viewer-tree__label">All Types</span>
            <span className="viewer-tree__subtle">전체 타입 그룹 표시</span>
          </span>
        </span>
      </button>
      {typeGroups.length > 0 ? (
        typeGroups.map((group) => {
          const isGroupExpanded = expandedIds.has(group.key);

          return (
            <Fragment key={group.key}>
              <button
                type="button"
                className="viewer-tree__item viewer-tree__item--type"
                onClick={() => toggleExpanded(group.key)}
              >
                <span className="viewer-tree__item-main">
                  <span className={`viewer-tree__chevron is-visible${isGroupExpanded ? ' is-expanded' : ''}`}>
                    <ChevronRight size={13} strokeWidth={2.3} />
                  </span>
                  <span className="viewer-tree__icon">
                    <Boxes size={14} strokeWidth={2} />
                  </span>
                  <span className="viewer-tree__copy">
                    <span className="viewer-tree__label">{group.label}</span>
                    <span className="viewer-tree__subtle">{group.families.length} type groups</span>
                  </span>
                </span>
                <span className="viewer-tree__meta-id">{group.entityIds.length}</span>
              </button>
              {isGroupExpanded && (
                <div className="viewer-tree__group">
                  {group.families.map((family) => {
                    const isFamilyExpanded = expandedIds.has(family.key);

                    return (
                      <Fragment key={family.key}>
                        <button
                          type="button"
                          className="viewer-tree__item viewer-tree__item--type"
                          onClick={() => handleGroupIsolate(family.entityIds)}
                          style={{ paddingLeft: '30px' }}
                        >
                          <span className="viewer-tree__item-main">
                            <span
                              className={`viewer-tree__chevron is-visible${isFamilyExpanded ? ' is-expanded' : ''}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleExpanded(family.key);
                              }}
                            >
                              <ChevronRight size={13} strokeWidth={2.3} />
                            </span>
                            <span className="viewer-tree__icon">
                              <FileBox size={14} strokeWidth={2} />
                            </span>
                            <span className="viewer-tree__copy">
                              <span className="viewer-tree__label">{family.label}</span>
                              <span className="viewer-tree__subtle">
                                {formatIfcType(family.ifcType)} · {family.children.length} instances
                              </span>
                            </span>
                          </span>
                          <span className="viewer-tree__meta-id">{family.children.length}</span>
                        </button>
                        {isFamilyExpanded && (
                          <div className="viewer-tree__group">
                            {family.children.map((child) => (
                              <button
                                key={`type-entity-${child.expressId}`}
                                type="button"
                                data-tree-node-id={`type-entity-${child.expressId}`}
                                className={`viewer-tree__item${selectedEntityId === child.expressId ? ' is-active' : ''}`}
                                onClick={() => setSelectedEntityId(child.expressId)}
                                style={{ paddingLeft: '46px' }}
                              >
                                <span className="viewer-tree__item-main">
                                  <span className="viewer-tree__icon">
                                    <FileBox size={14} strokeWidth={2} />
                                  </span>
                                  <span className="viewer-tree__copy">
                                    <span className="viewer-tree__label">{child.label}</span>
                                    <span className="viewer-tree__subtle">{formatIfcType(child.ifcType)}</span>
                                  </span>
                                </span>
                                <span className="viewer-tree__meta-id">#{child.expressId}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </Fragment>
          );
        })
      ) : (
        <div className="viewer-tree__empty">
          <Boxes size={16} strokeWidth={2} />
          <span>표시할 타입 그룹이 없습니다.</span>
        </div>
      )}
    </div>
  );

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
                ? `${classGroups.length} classes`
                : `${typeGroups.length} type classes`}
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
                  ? 'Search hierarchy...'
                  : activeTab === 'class'
                    ? 'Search classes or entities...'
                    : 'Search type groups or entities...'
              }
            />
          </div>
          <div className="viewer-panel__meta">
            <span>현재 파일</span>
            <strong>{currentFileName ?? '없음'}</strong>
          </div>
          <div className="viewer-panel__meta">
            <span>{activeTab === 'spatial' ? '선택 엔티티' : '현재 탭 요약'}</span>
            <strong>
              {activeTab === 'spatial'
                ? selectedEntityId ?? '없음'
                : activeTab === 'class'
                  ? `${classGroups.length} class groups`
                  : `${typeGroups.length} type classes`}
            </strong>
          </div>
        </div>
        <div className="viewer-panel__scroll">
          {activeTab === 'spatial'
            ? (
              <div className="viewer-tree viewer-tree--directory">
                {filteredNodes.length > 0 ? (
                  renderSpatialTree(filteredNodes)
                ) : (
                  <div className="viewer-tree__empty">
                    <FolderTree size={16} strokeWidth={2} />
                    <span>검색 결과가 없습니다.</span>
                  </div>
                )}
              </div>
            )
            : activeTab === 'class'
              ? renderClassTree()
              : renderTypeTree()}
        </div>
      </div>
      <div className="viewer-panel__footer">
        <span>
          {activeTab === 'spatial'
            ? hasSpatialTree
              ? 'Spatial tree synced'
              : 'Spatial tree idle'
            : activeTab === 'class'
              ? 'By IFC class'
              : 'By type-like group'}
        </span>
        <strong>
          {activeTab === 'spatial'
            ? selectedEntityId ?? 'No selection'
            : activeTab === 'class'
              ? `${entities.length} items`
              : `${entities.length} items`}
        </strong>
      </div>
    </aside>
  );
}
