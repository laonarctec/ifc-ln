import {
  Box,
  Boxes,
  Building2,
  DoorOpen,
  FileBox,
  Folder,
  FolderTree,
  Layers3,
  MapPin,
  Square,
} from 'lucide-react';
import type { ElementType } from 'react';
import type {
  IfcSpatialElement,
  IfcSpatialNode,
  IfcTypeTreeFamily,
  IfcTypeTreeGroup,
} from '@/types/worker-messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HierarchyTab = 'spatial' | 'class' | 'type';

export interface EntitySummary {
  expressId: number;
  ifcType: string;
  name: string | null;
  label: string;
}

export interface ClassGroup {
  key: string;
  label: string;
  entityIds: number[];
  children: EntitySummary[];
}

export interface TypeFamilyView extends IfcTypeTreeFamily {
  key: string;
  label: string;
}

export interface TypeGroupView extends IfcTypeTreeGroup {
  key: string;
  label: string;
  families: TypeFamilyView[];
}

export type TreeRow =
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

export interface SpatialNodeMetrics {
  totalElementCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const OVERSCAN = 12;
export const ROW_HEIGHT = 32;
export const COUNT_FORMATTER = new Intl.NumberFormat();

export const TYPE_ICONS: Record<string, ElementType> = {
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

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export function formatIfcType(type: string) {
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

export function normalizeIfcType(typeName: string) {
  return typeName.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

export function getNodeElevation(node: IfcSpatialNode) {
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

export function formatElevation(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return `${normalized >= 0 ? '+' : ''}${normalized.toFixed(2)}m`;
}

export function formatCount(count: number, suffix: string) {
  return `${COUNT_FORMATTER.format(count)} ${suffix}`;
}

export function resolveTreeIcon(typeName: string, fallback: ElementType) {
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

export function getNodeName(node: IfcSpatialNode | null | undefined) {
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

export function collectExpandedIds(
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

export function filterNodes(nodes: IfcSpatialNode[], query: string): IfcSpatialNode[] {
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

export function countNodes(nodes: IfcSpatialNode[]): number {
  return nodes.reduce(
    (count, node) => count + 1 + (node.elements?.length ?? 0) + countNodes(node.children),
    0
  );
}

export function findNodeById(nodes: IfcSpatialNode[], targetId: number): IfcSpatialNode | null {
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

export function buildEntityNameMap(nodes: IfcSpatialNode[], result = new Map<number, string>()) {
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

export function collectSpatialEntities(nodes: IfcSpatialNode[], result = new Map<number, EntitySummary>()) {
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

export function buildSpatialMetrics(nodes: IfcSpatialNode[], result = new Map<number, SpatialNodeMetrics>()) {
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

export function collectNodeEntityIds(
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

export function matchesSearch(query: string, ...values: Array<string | null | undefined>) {
  if (query.length === 0) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(query));
}

export function buildSpatialRows(
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

export function buildClassRows(
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

export function buildTypeRows(
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
