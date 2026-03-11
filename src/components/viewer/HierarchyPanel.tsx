import {
  Box,
  Boxes,
  Building2,
  ChevronRight,
  DoorOpen,
  Eye,
  EyeOff,
  FileBox,
  Folder,
  FolderTree,
  Layers3,
  MapPin,
  Search,
  Square,
} from 'lucide-react';
import type { ElementType } from 'react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useWebIfc } from '@/hooks/useWebIfc';
import { useViewportGeometry } from '@/services/viewportGeometryStore';
import { useViewerStore } from '@/stores';
import type {
  IfcSpatialElement,
  IfcSpatialNode,
  IfcTypeTreeFamily,
  IfcTypeTreeGroup,
} from '@/types/worker-messages';

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

interface TypeFamilyView extends IfcTypeTreeFamily {
  key: string;
  label: string;
}

interface TypeGroupView extends IfcTypeTreeGroup {
  key: string;
  label: string;
  families: TypeFamilyView[];
}

type TreeRow =
  | {
      kind: 'reset';
      key: string;
      label: string;
      subtle: string;
      icon: 'class' | 'type';
      depth: number;
    }
  | {
      kind: 'spatial';
      key: string;
      nodeId: string;
      expressId: number;
      label: string;
      subtle: string | null;
      badges?: string[];
      meta?: string | null;
      iconName: string;
      depth: number;
      isActive: boolean;
      hasChildren: boolean;
      isExpanded: boolean;
      disabled: boolean;
      node: IfcSpatialNode;
    }
  | {
      kind: 'spatial-element';
      key: string;
      nodeId: string;
      expressId: number;
      label: string;
      subtle: string;
      meta?: string | null;
      iconName: string;
      depth: number;
      isActive: boolean;
      element: IfcSpatialElement;
    }
  | {
      kind: 'class-group';
      key: string;
      label: string;
      subtle: string;
      meta: string;
      iconName: string;
      depth: number;
      entityIds: number[];
      hasChildren: boolean;
      isExpanded: boolean;
    }
  | {
      kind: 'class-entity';
      key: string;
      nodeId: string;
      expressId: number;
      label: string;
      subtle: string;
      meta: string;
      iconName: string;
      depth: number;
      isActive: boolean;
    }
  | {
      kind: 'type-group';
      key: string;
      label: string;
      subtle: string;
      meta: string;
      iconName: string;
      depth: number;
      entityIds: number[];
      hasChildren: boolean;
      isExpanded: boolean;
    }
  | {
      kind: 'type-family';
      key: string;
      label: string;
      subtle: string;
      meta: string;
      badge?: string | null;
      iconName: string;
      depth: number;
      entityIds: number[];
      hasChildren: boolean;
      isExpanded: boolean;
      isUntyped: boolean;
    }
  | {
      kind: 'type-entity';
      key: string;
      nodeId: string;
      expressId: number;
      label: string;
      subtle: string;
      meta: string;
      iconName: string;
      depth: number;
      isActive: boolean;
    };

const ROW_HEIGHT = 34;
const OVERSCAN = 12;

const TYPE_ICONS: Record<string, ElementType> = {
  IfcProject: FolderTree,
  IfcSite: MapPin,
  IfcBuilding: Building2,
  IfcBuildingStorey: Layers3,
  IfcSpace: Box,
  IfcWall: Square,
  IfcWallStandardCase: Square,
  IfcSlab: Square,
  IfcColumn: Square,
  IfcBeam: Square,
  IfcDoor: DoorOpen,
  IfcWindow: DoorOpen,
  IfcWallType: Square,
  IfcDoorType: DoorOpen,
  IfcWindowType: DoorOpen,
  IfcSpaceType: Box,
};

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

function getNodeElevation(node: IfcSpatialNode) {
  const withElevation = node as IfcSpatialNode & {
    elevation?: number;
    Elevation?: number | { value?: number };
  };

  if (typeof withElevation.elevation === 'number') {
    return withElevation.elevation;
  }

  if (typeof withElevation.Elevation === 'number') {
    return withElevation.Elevation;
  }

  if (
    typeof withElevation.Elevation === 'object' &&
    withElevation.Elevation !== null &&
    typeof withElevation.Elevation.value === 'number'
  ) {
    return withElevation.Elevation.value;
  }

  return null;
}

function formatElevation(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return `${normalized >= 0 ? '+' : ''}${normalized.toFixed(2)}m`;
}

function resolveTreeIcon(typeName: string, fallback: ElementType) {
  return TYPE_ICONS[formatIfcType(typeName)] ?? TYPE_ICONS[typeName] ?? fallback;
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

  const filtered: IfcSpatialNode[] = [];

  nodes.forEach((node) => {
    const filteredChildren = filterNodes(node.children, normalizedQuery);
    const filteredElements =
      node.elements?.filter((element) => {
        const label = `${element.ifcType} ${element.expressID} ${element.name ?? ''}`.toLowerCase();
        return label.includes(normalizedQuery);
      }) ?? [];
    const label = `${node.type} ${node.expressID} ${getNodeName(node) ?? ''}`.toLowerCase();

    if (
      label.includes(normalizedQuery) ||
      filteredChildren.length > 0 ||
      filteredElements.length > 0
    ) {
      filtered.push({
        ...node,
        children: filteredChildren,
        elements: filteredElements.length > 0 ? filteredElements : node.elements,
      });
    }
  });

  return filtered;
}

function countNodes(nodes: IfcSpatialNode[]): number {
  return nodes.reduce(
    (count, node) => count + 1 + (node.elements?.length ?? 0) + countNodes(node.children),
    0
  );
}

function findNodePath(nodes: IfcSpatialNode[], targetId: number, path: number[] = []): number[] | null {
  for (const node of nodes) {
    const nextPath = [...path, node.expressID];
    if (node.expressID === targetId) {
      return nextPath;
    }

    if (node.elements?.some((element) => element.expressID === targetId)) {
      return nextPath;
    }

    const childPath = findNodePath(node.children, targetId, nextPath);
    if (childPath) {
      return childPath;
    }
  }

  return null;
}

function findNodeById(nodes: IfcSpatialNode[], targetId: number): IfcSpatialNode | null {
  for (const node of nodes) {
    if (node.expressID === targetId) {
      return node;
    }

    const childNode = findNodeById(node.children, targetId);
    if (childNode) {
      return childNode;
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
    node.elements?.forEach((element) => {
      if (element.name) {
        result.set(element.expressID, element.name);
      }
    });
    buildEntityNameMap(node.children, result);
  }
  return result;
}

function matchesSearch(query: string, ...values: Array<string | null | undefined>) {
  if (query.length === 0) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(query));
}

function buildSpatialRows(
  nodes: IfcSpatialNode[],
  expandedIds: Set<string | number>,
  selectedEntityId: number | null,
  searchActive: boolean,
  depth = 0,
  rows: TreeRow[] = []
) {
  nodes.forEach((node) => {
    const elementCount = node.elements?.length ?? 0;
    const hasChildren = node.children.length > 0 || elementCount > 0;
    const isExpanded = expandedIds.has(node.expressID) || searchActive;
    const displayName = getNodeName(node);
    const elevation = formatElevation(getNodeElevation(node));
    const typeLabel = formatIfcType(node.type);
    const subtleParts = [displayName ? typeLabel : null]
      .filter((value): value is string => Boolean(value));
    const badges = [
      ...(elevation ? [elevation] : []),
      ...(node.type === 'IFCBUILDINGSTOREY' ? [`${elementCount}`] : []),
    ];

    rows.push({
      kind: 'spatial',
      key: `spatial-row-${node.expressID}`,
      nodeId: `spatial-${node.expressID}`,
      expressId: node.expressID,
      label: displayName ?? typeLabel,
      subtle: subtleParts.join(' · ') || null,
      badges,
      meta: node.type === 'IFCBUILDINGSTOREY' ? null : `#${node.expressID}`,
      iconName: typeLabel,
      depth,
      isActive: selectedEntityId === node.expressID,
      hasChildren,
      isExpanded,
      disabled: node.expressID === 0,
      node,
    });

    if (hasChildren && isExpanded) {
      buildSpatialRows(node.children, expandedIds, selectedEntityId, searchActive, depth + 1, rows);

      if (node.type === 'IFCBUILDINGSTOREY' && elementCount > 0) {
        node.elements?.forEach((element) => {
          rows.push({
            kind: 'spatial-element',
            key: `spatial-element-${element.expressID}`,
            nodeId: `spatial-element-${element.expressID}`,
            expressId: element.expressID,
            label: element.name ?? `${formatIfcType(element.ifcType)} #${element.expressID}`,
            subtle: formatIfcType(element.ifcType),
            meta: `#${element.expressID}`,
            iconName: element.ifcType,
            depth: depth + 1,
            isActive: selectedEntityId === element.expressID,
            element,
          });
        });
      }
    }
  });

  return rows;
}

function buildClassRows(
  classGroups: ClassGroup[],
  expandedIds: Set<string | number>,
  selectedEntityId: number | null
) {
  const rows: TreeRow[] = [
    {
      kind: 'reset',
      key: 'class-reset',
      label: 'All Classes',
      subtle: '전체 IFC 클래스 표시',
      icon: 'class',
      depth: 0,
    },
  ];

  classGroups.forEach((group) => {
    const isExpanded = expandedIds.has(group.key);
    rows.push({
      kind: 'class-group',
      key: group.key,
      label: formatIfcType(group.label),
      subtle: `${group.children.length} elements`,
      meta: `${group.children.length}`,
      iconName: group.label,
      depth: 0,
      entityIds: group.entityIds,
      hasChildren: group.children.length > 0,
      isExpanded,
    });

    if (isExpanded) {
      group.children.forEach((child) => {
        rows.push({
          kind: 'class-entity',
          key: `class-entity-${child.expressId}`,
          nodeId: `class-entity-${child.expressId}`,
          expressId: child.expressId,
          label: child.label,
          subtle: formatIfcType(child.ifcType),
          meta: `#${child.expressId}`,
          iconName: child.ifcType,
          depth: 1,
          isActive: selectedEntityId === child.expressId,
        });
      });
    }
  });

  return rows;
}

function buildTypeRows(
  typeGroups: TypeGroupView[],
  expandedIds: Set<string | number>,
  selectedEntityId: number | null
) {
  const rows: TreeRow[] = [
    {
      kind: 'reset',
      key: 'type-reset',
      label: 'All Types',
      subtle: '전체 타입 그룹 표시',
      icon: 'type',
      depth: 0,
    },
  ];

  typeGroups.forEach((group) => {
    const isGroupExpanded = expandedIds.has(group.key);
    rows.push({
      kind: 'type-group',
      key: group.key,
      label: formatIfcType(group.label),
      subtle: `${group.families.length} type groups`,
      meta: `${group.entityIds.length}`,
      iconName: group.label,
      depth: 0,
      entityIds: group.entityIds,
      hasChildren: group.families.length > 0,
      isExpanded: isGroupExpanded,
    });

    if (!isGroupExpanded) {
      return;
    }

    group.families.forEach((family) => {
      const isFamilyExpanded = expandedIds.has(family.key);
      rows.push({
        kind: 'type-family',
        key: family.key,
        label: family.label,
        subtle: family.isUntyped
          ? `${formatIfcType(group.label)} · ${family.children.length} untyped`
          : `${formatIfcType(family.typeClassName)} · ${family.children.length} instances`,
        meta: `${family.children.length}`,
        badge: family.typeExpressID !== null ? `#${family.typeExpressID}` : null,
        iconName: family.typeClassName,
        depth: 1,
        entityIds: family.entityIds,
        hasChildren: family.children.length > 0,
        isExpanded: isFamilyExpanded,
        isUntyped: Boolean(family.isUntyped),
      });

      if (!isFamilyExpanded) {
        return;
      }

      family.children.forEach((child) => {
        rows.push({
          kind: 'type-entity',
          key: `type-entity-${child.expressID}`,
          nodeId: `type-entity-${child.expressID}`,
          expressId: child.expressID,
          label: child.name ?? `${formatIfcType(child.ifcType)} #${child.expressID}`,
          subtle: formatIfcType(child.ifcType),
          meta: `#${child.expressID}`,
          iconName: child.ifcType,
          depth: 2,
          isActive: selectedEntityId === child.expressID,
        });
      });
    });
  });

  return rows;
}

export function HierarchyPanel() {
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const setSelectedEntityId = useViewerStore((state) => state.setSelectedEntityId);
  const clearSelection = useViewerStore((state) => state.clearSelection);
  const hiddenEntityIds = useViewerStore((state) => state.hiddenEntityIds);
  const hideEntity = useViewerStore((state) => state.hideEntity);
  const showEntity = useViewerStore((state) => state.showEntity);
  const resetHiddenEntities = useViewerStore((state) => state.resetHiddenEntities);
  const isolateEntities = useViewerStore((state) => state.isolateEntities);
  const setActiveClassFilter = useViewerStore((state) => state.setActiveClassFilter);
  const setActiveTypeFilter = useViewerStore((state) => state.setActiveTypeFilter);
  const setActiveStoreyFilter = useViewerStore((state) => state.setActiveStoreyFilter);
  const {
    spatialTree,
    typeTree,
    activeClassFilter,
    activeTypeFilter,
    activeStoreyFilter,
  } = useWebIfc();
  const { meshes } = useViewportGeometry();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(() => new Set());
  const [activeTab, setActiveTab] = useState<HierarchyTab>('spatial');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setExpandedIds(collectExpandedIds(spatialTree, 2) as Set<string | number>);
  }, [spatialTree]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => setViewportHeight(element.clientHeight || 480);
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [activeTab]);

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const searchActive = normalizedSearchQuery.length > 0;
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
  const hasSpatialTree = filteredNodes.length > 0 && filteredNodes[0]?.expressID !== 0;
  const totalNodes = useMemo(() => countNodes(filteredNodes), [filteredNodes]);
  const activeStoreyNode = useMemo(
    () => (activeStoreyFilter === null ? null : findNodeById(spatialTree, activeStoreyFilter)),
    [activeStoreyFilter, spatialTree]
  );
  const activeStoreyLabel = useMemo(() => {
    if (!activeStoreyNode) {
      return null;
    }

    return getNodeName(activeStoreyNode) ?? `Storey #${activeStoreyNode.expressID}`;
  }, [activeStoreyNode]);

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
    const filteredGroups: TypeGroupView[] = [];

    typeTree.forEach((group) => {
      const families = group.families
        .map((family) => ({
          ...family,
          key: `type-family-${group.typeClassName}-${family.typeExpressID ?? family.typeName}`,
          label: family.typeName,
        }))
        .filter((family) =>
          matchesSearch(
            normalizedSearchQuery,
            group.typeClassName,
            family.typeName,
            ...family.children.flatMap((child) => [
              child.name,
              child.ifcType,
              String(child.expressID),
            ])
          )
        );

      if (families.length === 0) {
        return;
      }

      filteredGroups.push({
        ...group,
        key: `type-class-${group.typeClassName}`,
        label: group.typeClassName,
        families,
      });
    });

    return filteredGroups;
  }, [normalizedSearchQuery, typeTree]);

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
      return;
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
      return;
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
  }, [activeTab, classGroups, selectedEntityId, spatialTree, typeGroups]);

  const clearSemanticFilters = () => {
    setActiveClassFilter(null);
    setActiveTypeFilter(null);
    setActiveStoreyFilter(null);
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
    if (node.type === 'IFCBUILDINGSTOREY') {
      setActiveStoreyFilter(activeStoreyFilter === node.expressID ? null : node.expressID);
    }
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

  const clearStoreyFilter = () => {
    setActiveStoreyFilter(null);
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];

    if (activeStoreyFilter !== null) {
      chips.push({
        key: `storey-${activeStoreyFilter}`,
        label: `Storey · ${activeStoreyLabel ?? `#${activeStoreyFilter}`}`,
        onClear: clearStoreyFilter,
      });
    }

    if (activeClassFilter) {
      chips.push({
        key: `class-${activeClassFilter}`,
        label: `Class · ${formatIfcType(activeClassFilter)}`,
        onClear: () => setActiveClassFilter(null),
      });
    }

    if (activeTypeFilter) {
      chips.push({
        key: `type-${activeTypeFilter}`,
        label: `Type · ${formatIfcType(activeTypeFilter)}`,
        onClear: () => setActiveTypeFilter(null),
      });
    }

    return chips;
  }, [
    activeClassFilter,
    activeStoreyFilter,
    activeStoreyLabel,
    activeTypeFilter,
    clearStoreyFilter,
    setActiveClassFilter,
    setActiveTypeFilter,
  ]);

  const handleVisibilityToggle = (targetEntityIds: number[]) => {
    if (targetEntityIds.length === 0) {
      return;
    }

    const allHidden = targetEntityIds.every((entityId) => hiddenEntityIds.has(entityId));

    if (allHidden) {
      targetEntityIds.forEach((entityId) => showEntity(entityId));
      return;
    }

    targetEntityIds.forEach((entityId) => hideEntity(entityId));
    if (selectedEntityId !== null && targetEntityIds.includes(selectedEntityId)) {
      clearSelection();
    }
  };

  const spatialRows = useMemo(
    () => buildSpatialRows(filteredNodes, expandedIds, selectedEntityId, searchActive),
    [expandedIds, filteredNodes, searchActive, selectedEntityId]
  );
  const classRows = useMemo(
    () => buildClassRows(classGroups, expandedIds, selectedEntityId),
    [classGroups, expandedIds, selectedEntityId]
  );
  const typeRows = useMemo(
    () => buildTypeRows(typeGroups, expandedIds, selectedEntityId),
    [expandedIds, selectedEntityId, typeGroups]
  );

  const currentRows = useMemo(() => {
    if (activeTab === 'spatial') {
      return spatialRows;
    }
    if (activeTab === 'class') {
      return classRows;
    }
    return typeRows;
  }, [activeTab, classRows, spatialRows, typeRows]);

  const sectionHeader = useMemo(() => {
    if (activeTab === 'spatial') {
      return {
        title: 'Hierarchy',
        subtitle: hasSpatialTree
          ? 'Project / Site / Building / Storey / Elements'
          : 'Waiting for model structure',
        count: hasSpatialTree ? spatialRows.length : 0,
        Icon: Building2,
      };
    }

    if (activeTab === 'class') {
      return {
        title: 'By Class',
        subtitle: 'Grouped by IFC class',
        count: classGroups.length,
        Icon: Layers3,
      };
    }

    return {
      title: 'By Type',
      subtitle: 'Grouped by IfcType relation',
      count: typeGroups.length,
      Icon: Boxes,
    };
  }, [activeTab, classGroups.length, hasSpatialTree, spatialRows.length, typeGroups.length]);

  const footerSummary = useMemo(() => {
    if (activeTab === 'spatial') {
      return hasSpatialTree ? 'Spatial tree synced' : 'Spatial tree idle';
    }

    if (activeTab === 'class') {
      return 'By IFC class';
    }

    return 'By IfcType relation';
  }, [activeTab, hasSpatialTree]);

  useEffect(() => {
    if (selectedEntityId === null || !scrollRef.current) {
      return;
    }

    const targetNodeId =
      activeTab === 'spatial'
        ? currentRows.some((row) => 'nodeId' in row && row.nodeId === `spatial-${selectedEntityId}`)
          ? `spatial-${selectedEntityId}`
          : `spatial-element-${selectedEntityId}`
        : activeTab === 'class'
          ? `class-entity-${selectedEntityId}`
          : `type-entity-${selectedEntityId}`;

    const targetIndex = currentRows.findIndex((row) => 'nodeId' in row && row.nodeId === targetNodeId);
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
  }, [activeTab, currentRows, selectedEntityId]);

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    currentRows.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN
  );
  const visibleRows = currentRows.slice(startIndex, endIndex);
  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (currentRows.length - endIndex) * ROW_HEIGHT);

  const renderRow = (row: TreeRow) => {
    const paddingLeft = `${14 + row.depth * 16}px`;

    if (row.kind === 'reset') {
      return (
        <button
          key={row.key}
          type="button"
          className="viewer-tree__item viewer-tree__item--type"
          style={{ paddingLeft }}
          onClick={handleResetGroupView}
        >
          <span className="viewer-tree__item-main">
            <span className="viewer-tree__icon">
              {row.icon === 'class' ? (
                <Layers3 size={14} strokeWidth={2} />
              ) : (
                <Boxes size={14} strokeWidth={2} />
              )}
            </span>
            <span className="viewer-tree__copy">
              <span className="viewer-tree__label">{row.label}</span>
              <span className="viewer-tree__subtle">{row.subtle}</span>
            </span>
          </span>
        </button>
      );
    }

    if (row.kind === 'spatial') {
      const Icon = resolveTreeIcon(row.iconName, row.hasChildren ? Folder : FileBox);
      const visibilityEntityIds =
        row.node.type === 'IFCBUILDINGSTOREY'
          ? (row.node.elements ?? []).map((element) => element.expressID)
          : entityIds.includes(row.expressId)
            ? [row.expressId]
            : [];
      const supportsVisibility = visibilityEntityIds.length > 0;
      const isHidden = supportsVisibility && visibilityEntityIds.every((entityId) => hiddenEntityIds.has(entityId));
      const isStoreyFiltered = row.node.type === 'IFCBUILDINGSTOREY' && activeStoreyFilter === row.expressId;
      return (
        <button
          key={row.key}
          type="button"
          data-tree-node-id={row.nodeId}
          className={`viewer-tree__item${row.isActive ? ' is-active' : ''}${isStoreyFiltered ? ' is-filtered' : ''}`}
          onClick={() => handleSpatialNodeClick(row.node)}
          style={{ paddingLeft }}
          disabled={row.disabled}
        >
          <span className="viewer-tree__item-main">
            <span
              className={`viewer-tree__chevron${row.hasChildren ? ' is-visible' : ''}${row.isExpanded ? ' is-expanded' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                if (row.hasChildren) {
                  toggleExpanded(row.expressId);
                }
              }}
            >
              <ChevronRight size={13} strokeWidth={2.3} />
            </span>
            <span className="viewer-tree__icon">
              <Icon size={14} strokeWidth={2} />
            </span>
            <span className="viewer-tree__copy">
              <span className="viewer-tree__label">{row.label}</span>
              {row.subtle && <span className="viewer-tree__subtle">{row.subtle}</span>}
            </span>
          </span>
          {supportsVisibility && (
            <span className="viewer-tree__actions">
              <span
                className="viewer-tree__action"
                role="button"
                tabIndex={0}
                aria-label={isHidden ? 'Show entity' : 'Hide entity'}
                onClick={(event) => {
                  event.stopPropagation();
                  handleVisibilityToggle(visibilityEntityIds);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    handleVisibilityToggle(visibilityEntityIds);
                  }
                }}
              >
                {isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
              </span>
            </span>
          )}
          <span className="viewer-tree__meta-group">
            {isStoreyFiltered && <span className="viewer-tree__badge viewer-tree__badge--accent">Filtered</span>}
            {row.badges?.map((badge) => (
              <span key={`${row.key}-${badge}`} className="viewer-tree__badge">
                {badge}
              </span>
            ))}
            {row.meta && <span className="viewer-tree__meta-id">{row.meta}</span>}
          </span>
        </button>
      );
    }

    if (row.kind === 'spatial-element') {
      const Icon = resolveTreeIcon(row.iconName, FileBox);
      const isHidden = hiddenEntityIds.has(row.expressId);
      return (
        <button
          key={row.key}
          type="button"
          data-tree-node-id={row.nodeId}
          className={`viewer-tree__item viewer-tree__item--leaf${row.isActive ? ' is-active' : ''}`}
          onClick={() => setSelectedEntityId(row.expressId)}
          style={{ paddingLeft }}
        >
          <span className="viewer-tree__item-main">
            <span className="viewer-tree__icon">
              <Icon size={14} strokeWidth={2} />
            </span>
            <span className="viewer-tree__copy">
              <span className="viewer-tree__label">{row.label}</span>
              <span className="viewer-tree__subtle">{row.subtle}</span>
            </span>
          </span>
          <span className="viewer-tree__actions">
            <span
              className="viewer-tree__action"
              role="button"
              tabIndex={0}
              aria-label={isHidden ? 'Show entity' : 'Hide entity'}
              onClick={(event) => {
                event.stopPropagation();
                handleVisibilityToggle([row.expressId]);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  handleVisibilityToggle([row.expressId]);
                }
              }}
            >
              {isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
            </span>
          </span>
          {row.meta && <span className="viewer-tree__meta-id">{row.meta}</span>}
        </button>
      );
    }

    if (row.kind === 'class-group') {
      const Icon = resolveTreeIcon(row.iconName, Layers3);
      const isFullyHidden = row.entityIds.length > 0 && row.entityIds.every((entityId) => hiddenEntityIds.has(entityId));
      return (
        <button
          key={row.key}
          type="button"
          className="viewer-tree__item viewer-tree__item--type"
          style={{ paddingLeft }}
          onClick={() => handleGroupIsolate(row.entityIds)}
        >
          <span className="viewer-tree__item-main">
            <span
              className={`viewer-tree__chevron is-visible${row.isExpanded ? ' is-expanded' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded(row.key);
              }}
            >
              <ChevronRight size={13} strokeWidth={2.3} />
            </span>
            <span className="viewer-tree__icon">
              <Icon size={14} strokeWidth={2} />
            </span>
            <span className="viewer-tree__copy">
              <span className="viewer-tree__label">{row.label}</span>
              <span className="viewer-tree__subtle">{row.subtle}</span>
            </span>
          </span>
          <span className="viewer-tree__actions">
            <span
              className="viewer-tree__action"
              role="button"
              tabIndex={0}
              aria-label={isFullyHidden ? 'Show class group' : 'Hide class group'}
              onClick={(event) => {
                event.stopPropagation();
                handleVisibilityToggle(row.entityIds);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  handleVisibilityToggle(row.entityIds);
                }
              }}
            >
              {isFullyHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
            </span>
          </span>
          <span className="viewer-tree__meta-id">{row.meta}</span>
        </button>
      );
    }

    if (row.kind === 'class-entity') {
      const Icon = resolveTreeIcon(row.iconName, FileBox);
      const isHidden = hiddenEntityIds.has(row.expressId);
      return (
        <button
          key={row.key}
          type="button"
          data-tree-node-id={row.nodeId}
          className={`viewer-tree__item${row.isActive ? ' is-active' : ''}`}
          onClick={() => setSelectedEntityId(row.expressId)}
          style={{ paddingLeft }}
        >
          <span className="viewer-tree__item-main">
            <span className="viewer-tree__icon">
              <Icon size={14} strokeWidth={2} />
            </span>
            <span className="viewer-tree__copy">
              <span className="viewer-tree__label">{row.label}</span>
              <span className="viewer-tree__subtle">{row.subtle}</span>
            </span>
          </span>
          <span className="viewer-tree__actions">
            <span
              className="viewer-tree__action"
              role="button"
              tabIndex={0}
              aria-label={isHidden ? 'Show entity' : 'Hide entity'}
              onClick={(event) => {
                event.stopPropagation();
                handleVisibilityToggle([row.expressId]);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  handleVisibilityToggle([row.expressId]);
                }
              }}
            >
              {isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
            </span>
          </span>
          <span className="viewer-tree__meta-id">{row.meta}</span>
        </button>
      );
    }

    if (row.kind === 'type-group') {
      const Icon = resolveTreeIcon(row.iconName, Boxes);
      const isFullyHidden = row.entityIds.length > 0 && row.entityIds.every((entityId) => hiddenEntityIds.has(entityId));
      return (
        <button
          key={row.key}
          type="button"
          className="viewer-tree__item viewer-tree__item--type"
          style={{ paddingLeft }}
          onClick={() => toggleExpanded(row.key)}
        >
          <span className="viewer-tree__item-main">
            <span className={`viewer-tree__chevron is-visible${row.isExpanded ? ' is-expanded' : ''}`}>
              <ChevronRight size={13} strokeWidth={2.3} />
            </span>
            <span className="viewer-tree__icon">
              <Icon size={14} strokeWidth={2} />
            </span>
            <span className="viewer-tree__copy">
              <span className="viewer-tree__label">{row.label}</span>
              <span className="viewer-tree__subtle">{row.subtle}</span>
            </span>
          </span>
          <span className="viewer-tree__actions">
            <span
              className="viewer-tree__action"
              role="button"
              tabIndex={0}
              aria-label={isFullyHidden ? 'Show type class' : 'Hide type class'}
              onClick={(event) => {
                event.stopPropagation();
                handleVisibilityToggle(row.entityIds);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  handleVisibilityToggle(row.entityIds);
                }
              }}
            >
              {isFullyHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
            </span>
          </span>
          <span className="viewer-tree__meta-id">{row.meta}</span>
        </button>
      );
    }

    if (row.kind === 'type-family') {
      const Icon = resolveTreeIcon(row.iconName, FileBox);
      const isFullyHidden = row.entityIds.length > 0 && row.entityIds.every((entityId) => hiddenEntityIds.has(entityId));
      return (
        <button
          key={row.key}
          type="button"
          className="viewer-tree__item viewer-tree__item--type"
          style={{ paddingLeft }}
          onClick={() => handleGroupIsolate(row.entityIds)}
        >
          <span className="viewer-tree__item-main">
            <span
              className={`viewer-tree__chevron is-visible${row.isExpanded ? ' is-expanded' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded(row.key);
              }}
            >
              <ChevronRight size={13} strokeWidth={2.3} />
            </span>
            <span className="viewer-tree__icon">
              <Icon size={14} strokeWidth={2} />
            </span>
            <span className="viewer-tree__copy">
              <span className="viewer-tree__label">{row.label}</span>
              <span className="viewer-tree__subtle">{row.subtle}</span>
            </span>
          </span>
          <span className="viewer-tree__actions">
            <span
              className="viewer-tree__action"
              role="button"
              tabIndex={0}
              aria-label={isFullyHidden ? 'Show type family' : 'Hide type family'}
              onClick={(event) => {
                event.stopPropagation();
                handleVisibilityToggle(row.entityIds);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  handleVisibilityToggle(row.entityIds);
                }
              }}
            >
              {isFullyHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
            </span>
          </span>
          <span className="viewer-tree__meta-group">
            {row.badge && <span className="viewer-tree__badge">{row.badge}</span>}
            <span className="viewer-tree__meta-id">{row.meta}</span>
          </span>
        </button>
      );
    }

    const Icon = resolveTreeIcon(row.iconName, FileBox);
    const isHidden = hiddenEntityIds.has(row.expressId);
    return (
      <button
        key={row.key}
        type="button"
        data-tree-node-id={row.nodeId}
        className={`viewer-tree__item${row.isActive ? ' is-active' : ''}`}
        onClick={() => setSelectedEntityId(row.expressId)}
        style={{ paddingLeft }}
      >
        <span className="viewer-tree__item-main">
          <span className="viewer-tree__icon">
            <Icon size={14} strokeWidth={2} />
          </span>
          <span className="viewer-tree__copy">
            <span className="viewer-tree__label">{row.label}</span>
            <span className="viewer-tree__subtle">{row.subtle}</span>
          </span>
        </span>
        <span className="viewer-tree__actions">
          <span
            className="viewer-tree__action"
            role="button"
            tabIndex={0}
            aria-label={isHidden ? 'Show entity' : 'Hide entity'}
            onClick={(event) => {
              event.stopPropagation();
              handleVisibilityToggle([row.expressId]);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                handleVisibilityToggle([row.expressId]);
              }
            }}
          >
            {isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
          </span>
        </span>
        <span className="viewer-tree__meta-id">{row.meta}</span>
      </button>
    );
  };

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
            <span>{activeTab === 'spatial' ? '선택 엔티티' : '현재 탭 요약'}</span>
            <strong>
              {activeTab === 'spatial'
                ? selectedEntityId ?? '없음'
                : activeTab === 'class'
                  ? `${classGroups.length} class groups`
                  : `${typeGroups.length} type classes`}
            </strong>
          </div>
          {activeTab === 'spatial' && activeStoreyFilter !== null && (
            <div className="viewer-panel__meta viewer-panel__meta--accent">
              <span>활성 Storey</span>
              <strong>{activeStoreyLabel ?? `#${activeStoreyFilter}`}</strong>
              <button type="button" onClick={clearStoreyFilter}>
                Clear
              </button>
            </div>
          )}
        </div>
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
        {activeFilterChips.length > 0 && (
          <div className="viewer-tree__filter-bar">
            <div className="viewer-tree__filter-chips">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="viewer-tree__filter-chip"
                  onClick={chip.onClear}
                >
                  <span>{chip.label}</span>
                  <small>Clear</small>
                </button>
              ))}
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
        <div
          ref={scrollRef}
          className="viewer-panel__scroll"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          {currentRows.length > 0 ? (
            <div className="viewer-tree viewer-tree--directory viewer-tree--virtual">
              {topSpacerHeight > 0 && <div style={{ height: `${topSpacerHeight}px` }} />}
              {visibleRows.map(renderRow)}
              {bottomSpacerHeight > 0 && <div style={{ height: `${bottomSpacerHeight}px` }} />}
            </div>
          ) : (
            <div className="viewer-tree viewer-tree--directory">
              <div className="viewer-tree__empty">
                {activeTab === 'spatial' ? (
                  <FolderTree size={16} strokeWidth={2} />
                ) : activeTab === 'class' ? (
                  <Layers3 size={16} strokeWidth={2} />
                ) : (
                  <Boxes size={16} strokeWidth={2} />
                )}
                <span>
                  {activeTab === 'spatial'
                    ? '검색 결과가 없습니다.'
                    : activeTab === 'class'
                      ? '표시할 클래스가 없습니다.'
                      : '표시할 타입 그룹이 없습니다.'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="viewer-panel__footer">
        <span>{footerSummary}</span>
        <strong>
          {activeTab === 'spatial' ? `${spatialRows.length} rows` : `${currentRows.length} rows`} ·{' '}
          {hiddenEntityIds.size} hidden
        </strong>
      </div>
    </aside>
  );
}
