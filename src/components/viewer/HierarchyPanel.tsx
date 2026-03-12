import {
  Box,
  Boxes,
  Building2,
  ChevronRight,
  DoorOpen,
  Eye,
  EyeOff,
  FileBox,
  Focus,
  Folder,
  FolderTree,
  Layers3,
  MapPin,
  Search,
  Square,
} from 'lucide-react';
import type { ElementType } from 'react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ifcWorkerClient } from '@/services/IfcWorkerClient';
import { useViewerStore } from '@/stores';
import type {
  IfcSpatialElement,
  IfcSpatialNode,
  IfcTypeTreeFamily,
  IfcTypeTreeGroup,
} from '@/types/worker-messages';
import { useHierarchyPanelData } from './hierarchy/useHierarchyPanelData';

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

const OVERSCAN = 12;
const ROW_HEIGHT = 32;
const COUNT_FORMATTER = new Intl.NumberFormat();

const TYPE_ICONS: Record<string, ElementType> = {
  IFCPROJECT: FolderTree,
  IFCSITE: MapPin,
  IFCBUILDING: Building2,
  IFCBUILDINGSTOREY: Layers3,
  IFCSPACE: Box,
  IFCSPACETYPE: Box,
  IFCZONE: Box,
  IFCWALL: Square,
  IFCWALLSTANDARDCASE: Square,
  IFCSLAB: Square,
  IFCROOF: Square,
  IFCCOVERING: Square,
  IFCPLATE: Square,
  IFCCOLUMN: Square,
  IFCBEAM: Square,
  IFCMEMBER: Square,
  IFCDOOR: DoorOpen,
  IFCDOORTYPE: DoorOpen,
  IFCWINDOW: DoorOpen,
  IFCWINDOWTYPE: DoorOpen,
};

interface SpatialNodeMetrics {
  totalElementCount: number;
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

function normalizeIfcType(typeName: string) {
  return typeName.replace(/[^a-z0-9]/gi, '').toUpperCase();
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

function formatCount(count: number, suffix: string) {
  return `${COUNT_FORMATTER.format(count)} ${suffix}`;
}

function resolveTreeIcon(typeName: string, fallback: ElementType) {
  const normalizedType = normalizeIfcType(typeName);
  const formattedType = formatIfcType(typeName);

  if (TYPE_ICONS[normalizedType]) {
    return TYPE_ICONS[normalizedType];
  }

  if (normalizedType.includes('STOREY') || normalizedType.includes('LEVEL')) {
    return Layers3;
  }

  if (normalizedType.includes('SITE') || normalizedType.includes('ADDRESS')) {
    return MapPin;
  }

  if (normalizedType.includes('BUILDING') || normalizedType.includes('FACILITY')) {
    return Building2;
  }

  if (normalizedType.includes('SPACE') || normalizedType.includes('ZONE') || normalizedType.includes('ROOM')) {
    return Box;
  }

  if (
    normalizedType.includes('DOOR') ||
    normalizedType.includes('WINDOW') ||
    normalizedType.includes('OPENING')
  ) {
    return DoorOpen;
  }

  if (
    normalizedType.includes('WALL') ||
    normalizedType.includes('SLAB') ||
    normalizedType.includes('ROOF') ||
    normalizedType.includes('COLUMN') ||
    normalizedType.includes('BEAM') ||
    normalizedType.includes('MEMBER') ||
    normalizedType.includes('PLATE') ||
    normalizedType.includes('COVERING')
  ) {
    return Square;
  }

  if (
    normalizedType.includes('TYPE') ||
    normalizedType.includes('FLOW') ||
    normalizedType.includes('PIPE') ||
    normalizedType.includes('DUCT') ||
    normalizedType.includes('TERMINAL') ||
    normalizedType.includes('FITTING') ||
    normalizedType.includes('PROXY') ||
    normalizedType.includes('FURNISH')
  ) {
    return Boxes;
  }

  return TYPE_ICONS[normalizeIfcType(formattedType)] ?? fallback;
}

function getNodeName(node: IfcSpatialNode | null | undefined) {
  if (!node) {
    return null;
  }

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

function collectSpatialEntities(nodes: IfcSpatialNode[], result = new Map<number, EntitySummary>()) {
  for (const node of nodes) {
    node.elements?.forEach((element) => {
      if (result.has(element.expressID)) {
        return;
      }

      const label = element.name ?? `${formatIfcType(element.ifcType)} #${element.expressID}`;
      result.set(element.expressID, {
        expressId: element.expressID,
        ifcType: element.ifcType,
        name: element.name ?? null,
        label,
      });
    });

    collectSpatialEntities(node.children, result);
  }

  return result;
}

function buildSpatialMetrics(nodes: IfcSpatialNode[], result = new Map<number, SpatialNodeMetrics>()) {
  const visit = (node: IfcSpatialNode) => {
    let totalElementCount = node.elements?.length ?? 0;

    node.children.forEach((child) => {
      const childMetrics = visit(child);
      totalElementCount += childMetrics.totalElementCount;
    });

    const metrics = { totalElementCount };
    result.set(node.expressID, metrics);
    return metrics;
  };

  nodes.forEach((node) => {
    visit(node);
  });

  return result;
}

function collectNodeEntityIds(
  node: IfcSpatialNode,
  renderableEntityIds: Set<number>,
  bucket = new Set<number>()
) {
  if (renderableEntityIds.has(node.expressID)) {
    bucket.add(node.expressID);
  }

  node.elements?.forEach((element) => {
    bucket.add(element.expressID);
  });

  node.children.forEach((child) => {
    collectNodeEntityIds(child, renderableEntityIds, bucket);
  });

  return [...bucket];
}

function matchesSearch(query: string, ...values: Array<string | null | undefined>) {
  if (query.length === 0) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(query));
}

function buildSpatialRows(
  nodes: IfcSpatialNode[],
  spatialMetrics: Map<number, SpatialNodeMetrics>,
  expandedIds: Set<string | number>,
  selectedEntityIds: Set<number>,
  selectedSpatialNodeIds: Set<number>,
  searchActive: boolean,
  depth = 0,
  rows: TreeRow[] = []
) {
  nodes.forEach((node) => {
    const elementCount = node.elements?.length ?? 0;
    const totalElementCount = spatialMetrics.get(node.expressID)?.totalElementCount ?? elementCount;
    const hasChildren = node.children.length > 0 || elementCount > 0;
    const isExpanded = expandedIds.has(node.expressID) || searchActive;
    const displayName = getNodeName(node);
    const elevation = formatElevation(getNodeElevation(node));
    const typeLabel = formatIfcType(node.type);
    const subtleParts = [displayName ? typeLabel : null]
      .filter((value): value is string => Boolean(value));
    const badges = [
      ...(elevation ? [`EL ${elevation}`] : []),
      ...(totalElementCount > 0 ? [formatCount(totalElementCount, 'el')] : []),
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
      isActive: selectedSpatialNodeIds.has(node.expressID) || selectedEntityIds.has(node.expressID),
      hasChildren,
      isExpanded,
      disabled: node.expressID === 0,
      node,
    });

    if (hasChildren && isExpanded) {
      buildSpatialRows(
        node.children,
        spatialMetrics,
        expandedIds,
        selectedEntityIds,
        selectedSpatialNodeIds,
        searchActive,
        depth + 1,
        rows
      );

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
            isActive: selectedEntityIds.has(element.expressID),
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
  selectedEntityIds: Set<number>
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
      meta: formatCount(group.children.length, 'el'),
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
          isActive: selectedEntityIds.has(child.expressId),
        });
      });
    }
  });

  return rows;
}

function buildTypeRows(
  typeGroups: TypeGroupView[],
  expandedIds: Set<string | number>,
  selectedEntityIds: Set<number>
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
      meta: formatCount(group.entityIds.length, 'el'),
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
        meta: formatCount(family.children.length, 'el'),
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
          isActive: selectedEntityIds.has(child.expressID),
        });
      });
    });
  });

  return rows;
}

export function HierarchyPanel() {
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const selectedEntityIds = useViewerStore((state) => state.selectedEntityIds);
  const setSelectedEntityId = useViewerStore((state) => state.setSelectedEntityId);
  const setSelectedEntityIds = useViewerStore((state) => state.setSelectedEntityIds);
  const toggleSelectedEntityId = useViewerStore((state) => state.toggleSelectedEntityId);
  const clearSelection = useViewerStore((state) => state.clearSelection);
  const hiddenEntityIds = useViewerStore((state) => state.hiddenEntityIds);
  const hideEntity = useViewerStore((state) => state.hideEntity);
  const showEntity = useViewerStore((state) => state.showEntity);
  const resetHiddenEntities = useViewerStore((state) => state.resetHiddenEntities);
  const isolateEntities = useViewerStore((state) => state.isolateEntities);
  const runViewportCommand = useViewerStore((state) => state.runViewportCommand);
  const setActiveClassFilter = useViewerStore((state) => state.setActiveClassFilter);
  const setActiveTypeFilter = useViewerStore((state) => state.setActiveTypeFilter);
  const setActiveStoreyFilter = useViewerStore((state) => state.setActiveStoreyFilter);
  const {
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
    geometryResult,
    loading,
    progress,
    engineMessage,
    spatialTree,
    typeTree,
    activeClassFilter,
    activeTypeFilter,
    activeStoreyFilter,
  } = useHierarchyPanelData();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(() => new Set());
  const [selectedSpatialNodeIds, setSelectedSpatialNodeIds] = useState<Set<number>>(() => new Set());
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

  useEffect(() => {
    if (activeTab !== 'type' || currentModelId === null || typeTree.length > 0) {
      return;
    }

    const allEntityIds = [...collectSpatialEntities(spatialTree).keys()];
    if (allEntityIds.length === 0) {
      return;
    }

    let cancelled = false;
    void ifcWorkerClient.getTypeTree(currentModelId, allEntityIds).then((result) => {
      if (cancelled) {
        return;
      }

      useViewerStore.getState().setTypeTree(result.groups);
    }).catch((error) => {
      console.error(error);
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab, currentModelId, spatialTree, typeTree.length]);

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const searchActive = normalizedSearchQuery.length > 0;
  const entityNameMap = useMemo(() => buildEntityNameMap(spatialTree), [spatialTree]);
  const entityIds = useMemo(
    () => [...collectSpatialEntities(spatialTree).keys()],
    [spatialTree]
  );
  const entityIdSet = useMemo(() => new Set(entityIds), [entityIds]);
  const selectedEntityIdSet = useMemo(() => new Set(selectedEntityIds), [selectedEntityIds]);

  const entities = useMemo(() => {
    const deduped = collectSpatialEntities(spatialTree);

    return [...deduped.values()]
      .map((entity) => ({
        ...entity,
        name: entity.name ?? entityNameMap.get(entity.expressId) ?? null,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [entityNameMap, spatialTree]);

  const filteredNodes = useMemo(
    () => filterNodes(spatialTree, normalizedSearchQuery),
    [normalizedSearchQuery, spatialTree]
  );
  const spatialMetrics = useMemo(() => buildSpatialMetrics(spatialTree), [spatialTree]);
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
  const activeStoreyEntityIds = useMemo(
    () => (activeStoreyNode ? collectNodeEntityIds(activeStoreyNode, entityIdSet) : []),
    [activeStoreyNode, entityIdSet]
  );

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

  const handleEntitySelection = (entityId: number | null, additive = false) => {
    if (entityId === null) {
      setSelectedSpatialNodeIds(new Set());
      clearSelection();
      return;
    }

    if (additive) {
      toggleSelectedEntityId(entityId);
      return;
    }

    setSelectedSpatialNodeIds(new Set());
    setSelectedEntityId(entityId);
  };

  const handleSpatialNodeSelection = (nodeId: number, additive = false) => {
    setSelectedSpatialNodeIds((current) => {
      const next = additive ? new Set(current) : new Set<number>();
      if (additive && next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSpatialNodeClick = (
    node: IfcSpatialNode,
    targetEntityId: number | null,
    additive = false
  ) => {
    handleSpatialNodeSelection(node.expressID, additive);
    handleEntitySelection(targetEntityId ?? node.expressID, additive);
    if (node.type === 'IFCBUILDINGSTOREY') {
      setActiveStoreyFilter(activeStoreyFilter === node.expressID ? null : node.expressID);
    }
  };

  const handleGroupIsolate = (targetEntityIds: number[]) => {
    setSelectedSpatialNodeIds(new Set());
    clearSemanticFilters();
    clearSelection();
    isolateEntities(targetEntityIds, entityIds);
  };

  const handleEntityFocus = (entityId: number) => {
    setSelectedSpatialNodeIds(new Set());
    clearSemanticFilters();
    handleEntitySelection(entityId);
    runViewportCommand('fit-selected');
  };

  const handleResetGroupView = () => {
    clearSemanticFilters();
    resetHiddenEntities();
  };

  const clearStoreyFilter = () => {
    setActiveStoreyFilter(null);
  };

  const handleStoreyScopeSelect = () => {
    if (activeStoreyFilter === null) {
      return;
    }

    if (activeStoreyEntityIds.length > 0) {
      setSelectedSpatialNodeIds(new Set());
      setSelectedEntityIds(activeStoreyEntityIds);
      return;
    }

    handleEntitySelection(activeStoreyFilter);
  };

  const handleStoreyScopeIsolate = () => {
    if (activeStoreyFilter === null || activeStoreyEntityIds.length === 0) {
      return;
    }

    setSelectedSpatialNodeIds(new Set());
    setActiveClassFilter(null);
    setActiveTypeFilter(null);
    setSelectedEntityIds(activeStoreyEntityIds);
    isolateEntities(activeStoreyEntityIds, entityIds);
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
    if (selectedEntityIds.some((entityId) => targetEntityIds.includes(entityId))) {
      setSelectedEntityIds(selectedEntityIds.filter((entityId) => !targetEntityIds.includes(entityId)));
    }
  };

  const renderTreeAction = (
    label: string,
    icon: JSX.Element,
    onActivate: () => void,
    accent = false
  ) => (
    <span
      className={`viewer-tree__action${accent ? ' viewer-tree__action--accent' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={label}
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

  const spatialRows = useMemo(
    () =>
      buildSpatialRows(
        filteredNodes,
        spatialMetrics,
        expandedIds,
        selectedEntityIdSet,
        selectedSpatialNodeIds,
        searchActive
      ),
    [expandedIds, filteredNodes, searchActive, selectedEntityIdSet, selectedSpatialNodeIds, spatialMetrics]
  );
  const classRows = useMemo(
    () => buildClassRows(classGroups, expandedIds, selectedEntityIdSet),
    [classGroups, expandedIds, selectedEntityIdSet]
  );
  const typeRows = useMemo(
    () => buildTypeRows(typeGroups, expandedIds, selectedEntityIdSet),
    [expandedIds, selectedEntityIdSet, typeGroups]
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

  const headerStatusText = useMemo(() => {
    if (loading) {
      return progress || 'Loading model...';
    }

    if (currentModelId !== null) {
      return `${currentModelSchema ?? 'Unknown schema'} · ${COUNT_FORMATTER.format(geometryResult.meshCount)} meshes · max #${currentModelMaxExpressId ?? 'n/a'}`;
    }

    return engineMessage || 'No IFC model loaded';
  }, [
    currentModelId,
    currentModelMaxExpressId,
    currentModelSchema,
    engineMessage,
    geometryResult.meshCount,
    loading,
    progress,
  ]);

  const headerSelectionText = useMemo(() => {
    if (activeTab !== 'spatial') {
      return activeTab === 'class'
        ? `${classGroups.length} class groups`
        : `${typeGroups.length} type classes`;
    }

    if (selectedEntityIds.length > 0) {
      return `${selectedEntityIds.length} selected${selectedEntityId !== null ? ` · primary #${selectedEntityId}` : ''}`;
    }

    if (activeStoreyFilter !== null) {
      return `Storey filter · ${activeStoreyLabel ?? `#${activeStoreyFilter}`}`;
    }

    return 'Shift+Click multi-select';
  }, [
    activeStoreyFilter,
    activeStoreyLabel,
    activeTab,
    classGroups.length,
    selectedEntityId,
    selectedEntityIds.length,
    typeGroups.length,
  ]);

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
      const visibilityEntityIds = collectNodeEntityIds(row.node, entityIdSet);
      const primaryEntityId = entityIdSet.has(row.expressId)
        ? row.expressId
        : visibilityEntityIds[0] ?? null;
      const supportsVisibility = visibilityEntityIds.length > 0;
      const isHidden = supportsVisibility && visibilityEntityIds.every((entityId) => hiddenEntityIds.has(entityId));
      const isStoreyFiltered = row.node.type === 'IFCBUILDINGSTOREY' && activeStoreyFilter === row.expressId;
      return (
        <button
          key={row.key}
          type="button"
          data-tree-node-id={row.nodeId}
          className={`viewer-tree__item${row.isActive ? ' is-active' : ''}${isStoreyFiltered ? ' is-filtered' : ''}`}
          onClick={(event) => handleSpatialNodeClick(row.node, primaryEntityId, event.shiftKey)}
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
              {renderTreeAction(
                'Isolate group',
                <Layers3 size={13} strokeWidth={2} />,
                () => handleGroupIsolate(visibilityEntityIds),
                true
              )}
              {renderTreeAction(
                isHidden ? 'Show entity' : 'Hide entity',
                isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />,
                () => handleVisibilityToggle(visibilityEntityIds)
              )}
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
          onClick={(event) => handleEntitySelection(row.expressId, event.shiftKey)}
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
            {renderTreeAction(
              'Focus entity',
              <Focus size={13} strokeWidth={2} />,
              () => handleEntityFocus(row.expressId),
              true
            )}
            {renderTreeAction(
              isHidden ? 'Show entity' : 'Hide entity',
              isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />,
              () => handleVisibilityToggle([row.expressId])
            )}
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
          onClick={() => toggleExpanded(row.key)}
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
            {renderTreeAction(
              'Isolate class group',
              <Layers3 size={13} strokeWidth={2} />,
              () => handleGroupIsolate(row.entityIds),
              true
            )}
            {renderTreeAction(
              isFullyHidden ? 'Show class group' : 'Hide class group',
              isFullyHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />,
              () => handleVisibilityToggle(row.entityIds)
            )}
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
          onClick={(event) => handleEntitySelection(row.expressId, event.shiftKey)}
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
            {renderTreeAction(
              'Focus entity',
              <Focus size={13} strokeWidth={2} />,
              () => handleEntityFocus(row.expressId),
              true
            )}
            {renderTreeAction(
              isHidden ? 'Show entity' : 'Hide entity',
              isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />,
              () => handleVisibilityToggle([row.expressId])
            )}
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
            {renderTreeAction(
              'Isolate type class',
              <Layers3 size={13} strokeWidth={2} />,
              () => handleGroupIsolate(row.entityIds),
              true
            )}
            {renderTreeAction(
              isFullyHidden ? 'Show type class' : 'Hide type class',
              isFullyHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />,
              () => handleVisibilityToggle(row.entityIds)
            )}
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
          onClick={() => toggleExpanded(row.key)}
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
            {renderTreeAction(
              'Isolate type family',
              <Layers3 size={13} strokeWidth={2} />,
              () => handleGroupIsolate(row.entityIds),
              true
            )}
            {renderTreeAction(
              isFullyHidden ? 'Show type family' : 'Hide type family',
              isFullyHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />,
              () => handleVisibilityToggle(row.entityIds)
            )}
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
        onClick={(event) => handleEntitySelection(row.expressId, event.shiftKey)}
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
          {renderTreeAction(
            'Focus entity',
            <Focus size={13} strokeWidth={2} />,
            () => handleEntityFocus(row.expressId),
            true
          )}
          {renderTreeAction(
            isHidden ? 'Show entity' : 'Hide entity',
            isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />,
            () => handleVisibilityToggle([row.expressId])
          )}
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
        <div className="viewer-panel__meta viewer-panel__meta--inline">
          <span>Model status</span>
          <strong title={headerStatusText}>{headerStatusText}</strong>
        </div>
        <div className="viewer-panel__meta viewer-panel__meta--inline">
          <span>{activeTab === 'spatial' ? 'Selection' : 'Current tab'}</span>
          <strong title={headerSelectionText}>{headerSelectionText}</strong>
        </div>
      </div>
      <div className="viewer-panel__body viewer-panel__body--tree">
        <div className="viewer-panel__section viewer-panel__section--compact">
          {activeTab === 'spatial' && activeStoreyFilter !== null && (
            <div className="viewer-panel__meta viewer-panel__meta--accent">
              <span>활성 Storey</span>
              <strong>{activeStoreyLabel ?? `#${activeStoreyFilter}`}</strong>
              <button type="button" onClick={clearStoreyFilter}>
                Clear
              </button>
            </div>
          )}
          {activeTab === 'spatial' && activeStoreyFilter !== null && (
            <div className="viewer-tree__scope-card viewer-tree__scope-card--compact">
              <div className="viewer-tree__scope-copy">
                <strong>Storey Scope</strong>
                <small>{activeStoreyEntityIds.length > 0 ? `${COUNT_FORMATTER.format(activeStoreyEntityIds.length)} entities in scope` : 'No renderable entities in this storey'}</small>
              </div>
              <div className="viewer-tree__scope-actions">
                <button type="button" onClick={handleStoreyScopeSelect}>
                  Select
                </button>
                <button
                  type="button"
                  onClick={handleStoreyScopeIsolate}
                  disabled={activeStoreyEntityIds.length === 0}
                >
                  Isolate
                </button>
                <button type="button" onClick={clearStoreyFilter}>
                  Clear Scope
                </button>
              </div>
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
        <div className="viewer-panel__footer-meta">
          <strong>
            {activeTab === 'spatial' ? `${spatialRows.length} rows` : `${currentRows.length} rows`} ·{' '}
            {hiddenEntityIds.size} hidden
          </strong>
          {(activeStoreyFilter !== null || activeFilterChips.length > 0) && (
            <button type="button" onClick={clearSemanticFilters}>
              Clear Filters
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
