import type {
  IfcSpatialElement,
  IfcSpatialNode,
  IfcTypeTreeGroup,
} from '@/types/worker-messages';
import type { EntitySummary, TreeNode } from './types';
import { COUNT_FORMATTER } from './types';

// ---------------------------------------------------------------------------
// Formatting & normalization (migrated from hierarchyUtils.ts)
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

// ---------------------------------------------------------------------------
// Node name extraction
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tree navigation helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Entity data helpers
// ---------------------------------------------------------------------------

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

export interface SpatialNodeMetrics {
  totalElementCount: number;
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

// ---------------------------------------------------------------------------
// Spatial node → NodeType mapping
// ---------------------------------------------------------------------------

function spatialNodeType(ifcType: string): TreeNode['type'] {
  switch (ifcType) {
    case 'IFCPROJECT':
      return 'IfcProject';
    case 'IFCSITE':
      return 'IfcSite';
    case 'IFCBUILDING':
      return 'IfcBuilding';
    case 'IFCBUILDINGSTOREY':
      return 'IfcBuildingStorey';
    case 'IFCSPACE':
    case 'IFCSPACETYPE':
    case 'IFCZONE':
      return 'IfcSpace';
    default:
      return 'element';
  }
}

// ---------------------------------------------------------------------------
// Eagerly collect entity IDs for a spatial node (for visibility control)
// ---------------------------------------------------------------------------

function collectEntityIdsEager(node: IfcSpatialNode, renderableEntityIds: Set<number>): number[] {
  const ids: number[] = [];

  if (renderableEntityIds.has(node.expressID)) {
    ids.push(node.expressID);
  }

  node.elements?.forEach((element) => {
    ids.push(element.expressID);
  });

  node.children.forEach((child) => {
    const childIds = collectEntityIdsEager(child, renderableEntityIds);
    for (let i = 0; i < childIds.length; i++) {
      ids.push(childIds[i]);
    }
  });

  return ids;
}

// ---------------------------------------------------------------------------
// buildSpatialTree — IfcSpatialNode[] → TreeNode[]
// ---------------------------------------------------------------------------

export function buildSpatialTree(
  nodes: IfcSpatialNode[],
  expandedIds: Set<string | number>,
  selectedEntityIds: Set<number>,
  spatialMetrics: Map<number, SpatialNodeMetrics>,
  searchActive: boolean,
  entityIdSet: Set<number>,
  depth = 0,
  rows: TreeNode[] = []
): TreeNode[] {
  nodes.forEach((node) => {
    const elementCount = node.elements?.length ?? 0;
    const totalElementCount = spatialMetrics.get(node.expressID)?.totalElementCount ?? elementCount;
    const hasChildren = node.children.length > 0 || elementCount > 0;
    const isExpanded = expandedIds.has(node.expressID) || searchActive;
    const displayName = getNodeName(node);
    const elevation = formatElevation(getNodeElevation(node));
    const typeLabel = formatIfcType(node.type);
    const nodeType = spatialNodeType(node.type);
    const entityIds = collectEntityIdsEager(node, entityIdSet);

    const subtleParts = [displayName ? typeLabel : null]
      .filter((value): value is string => Boolean(value));
    const badges = [
      ...(elevation ? [`EL ${elevation}`] : []),
      ...(totalElementCount > 0 ? [formatCount(totalElementCount, 'el')] : []),
    ];

    rows.push({
      id: `spatial-${node.expressID}`,
      expressId: node.expressID,
      entityIds,
      name: displayName ?? typeLabel,
      type: nodeType,
      ifcType: node.type,
      depth,
      hasChildren,
      isExpanded,
      badges,
      meta: node.type === 'IFCBUILDINGSTOREY' ? null : `#${node.expressID}`,
      subtitle: subtleParts.join(' · ') || null,
      storeyElevation: elevation ? getNodeElevation(node) : null,
      spatialNode: node,
    });

    if (hasChildren && isExpanded) {
      buildSpatialTree(
        node.children,
        expandedIds,
        selectedEntityIds,
        spatialMetrics,
        searchActive,
        entityIdSet,
        depth + 1,
        rows
      );

      if (node.type === 'IFCBUILDINGSTOREY' && elementCount > 0) {
        node.elements?.forEach((element) => {
          rows.push({
            id: `spatial-element-${element.expressID}`,
            expressId: element.expressID,
            entityIds: [element.expressID],
            name: element.name ?? `${formatIfcType(element.ifcType)} #${element.expressID}`,
            type: 'element',
            ifcType: element.ifcType,
            depth: depth + 1,
            hasChildren: false,
            isExpanded: false,
            meta: `#${element.expressID}`,
            subtitle: formatIfcType(element.ifcType),
          });
        });
      }
    }
  });

  return rows;
}

// ---------------------------------------------------------------------------
// buildClassTree — EntitySummary[] → TreeNode[]
// ---------------------------------------------------------------------------

export function buildClassTree(
  entities: EntitySummary[],
  expandedIds: Set<string | number>,
  selectedEntityIds: Set<number>,
  searchQuery: string
): TreeNode[] {
  const rows: TreeNode[] = [
    {
      id: 'class-reset',
      expressId: 0,
      entityIds: [],
      name: 'All Classes',
      type: 'reset',
      depth: 0,
      hasChildren: false,
      isExpanded: false,
      subtitle: '전체 IFC 클래스 표시',
    },
  ];

  // Group entities by IFC type
  const grouped = new Map<string, EntitySummary[]>();
  entities.forEach((entity) => {
    if (!grouped.has(entity.ifcType)) {
      grouped.set(entity.ifcType, []);
    }
    grouped.get(entity.ifcType)!.push(entity);
  });

  // Filter and sort groups
  const classGroups = [...grouped.entries()]
    .map(([ifcType, items]) => ({
      key: `class-${ifcType}`,
      label: ifcType,
      entityIds: items.map((item) => item.expressId),
      children: items,
    }))
    .filter((group) =>
      matchesSearch(
        searchQuery,
        group.label,
        ...group.children.flatMap((child) => [child.label, child.name, String(child.expressId)])
      )
    )
    .sort((left, right) => left.label.localeCompare(right.label));

  classGroups.forEach((group) => {
    const isExpanded = expandedIds.has(group.key);
    rows.push({
      id: group.key,
      expressId: 0,
      entityIds: group.entityIds,
      name: formatIfcType(group.label),
      type: 'type-group',
      ifcType: group.label,
      depth: 0,
      hasChildren: group.children.length > 0,
      isExpanded,
      subtitle: `${group.children.length} elements`,
      meta: formatCount(group.children.length, 'el'),
    });

    if (isExpanded) {
      group.children.forEach((child) => {
        rows.push({
          id: `class-entity-${child.expressId}`,
          expressId: child.expressId,
          entityIds: [child.expressId],
          name: child.label,
          type: 'element',
          ifcType: child.ifcType,
          depth: 1,
          hasChildren: false,
          isExpanded: false,
          subtitle: formatIfcType(child.ifcType),
          meta: `#${child.expressId}`,
        });
      });
    }
  });

  return rows;
}

// ---------------------------------------------------------------------------
// buildTypeTree — IfcTypeTreeGroup[] → TreeNode[]
// ---------------------------------------------------------------------------

export function buildTypeTree(
  typeGroups: IfcTypeTreeGroup[],
  expandedIds: Set<string | number>,
  selectedEntityIds: Set<number>,
  searchQuery: string
): TreeNode[] {
  const rows: TreeNode[] = [
    {
      id: 'type-reset',
      expressId: 0,
      entityIds: [],
      name: 'All Types',
      type: 'reset',
      depth: 0,
      hasChildren: false,
      isExpanded: false,
      subtitle: '전체 타입 그룹 표시',
    },
  ];

  // Filter type groups
  const filteredGroups: Array<{
    group: IfcTypeTreeGroup;
    key: string;
    families: Array<{ family: IfcTypeTreeGroup['families'][number]; key: string }>;
  }> = [];

  typeGroups.forEach((group) => {
    const families = group.families
      .map((family) => ({
        family,
        key: `type-family-${group.typeClassName}-${family.typeExpressID ?? family.typeName}`,
      }))
      .filter(({ family }) =>
        matchesSearch(
          searchQuery,
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
      group,
      key: `type-class-${group.typeClassName}`,
      families,
    });
  });

  filteredGroups.forEach(({ group, key, families }) => {
    const isGroupExpanded = expandedIds.has(key);
    rows.push({
      id: key,
      expressId: 0,
      entityIds: group.entityIds,
      name: formatIfcType(group.typeClassName),
      type: 'type-group',
      ifcType: group.typeClassName,
      depth: 0,
      hasChildren: families.length > 0,
      isExpanded: isGroupExpanded,
      subtitle: `${families.length} type groups`,
      meta: formatCount(group.entityIds.length, 'el'),
    });

    if (!isGroupExpanded) {
      return;
    }

    families.forEach(({ family, key: familyKey }) => {
      const isFamilyExpanded = expandedIds.has(familyKey);
      rows.push({
        id: familyKey,
        expressId: 0,
        entityIds: family.entityIds,
        name: family.typeName,
        type: 'type-family',
        ifcType: family.typeClassName,
        depth: 1,
        hasChildren: family.children.length > 0,
        isExpanded: isFamilyExpanded,
        subtitle: family.isUntyped
          ? `${formatIfcType(group.typeClassName)} · ${family.children.length} untyped`
          : `${formatIfcType(family.typeClassName)} · ${family.children.length} instances`,
        meta: formatCount(family.children.length, 'el'),
        typeBadge: family.typeExpressID !== null ? `#${family.typeExpressID}` : null,
      });

      if (!isFamilyExpanded) {
        return;
      }

      family.children.forEach((child) => {
        rows.push({
          id: `type-entity-${child.expressID}`,
          expressId: child.expressID,
          entityIds: [child.expressID],
          name: child.name ?? `${formatIfcType(child.ifcType)} #${child.expressID}`,
          type: 'element',
          ifcType: child.ifcType,
          depth: 2,
          hasChildren: false,
          isExpanded: false,
          subtitle: formatIfcType(child.ifcType),
          meta: `#${child.expressID}`,
        });
      });
    });
  });

  return rows;
}
