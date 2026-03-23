import type { IfcSpatialNode, IfcTypeTreeGroup } from '@/types/worker-messages';
import type { EntitySummary, TreeNode } from '@/types/hierarchy';
import {
  formatIfcType,
  getNodeElevation,
  formatElevation,
  formatCount,
  getNodeName,
  matchesSearch,
} from './treeHelpers';
import type { SpatialNodeMetrics } from './treeEntityUtils';

// Re-export everything from sub-modules so existing imports keep working
export {
  formatIfcType, getNodeElevation, formatElevation, formatCount, getNodeName,
  collectExpandedIds, filterNodes, countNodes, findNodeById, matchesSearch,
} from './treeHelpers';
export {
  buildEntityNameMap, collectSpatialEntities, buildSpatialMetrics,
  collectNodeEntityIds, collectRenderableNodeEntityIds, collectStoreys,
  type SpatialNodeMetrics, type StoreyInfo,
} from './treeEntityUtils';

// ---------------------------------------------------------------------------
// Internal helpers for tree builders
// ---------------------------------------------------------------------------

function spatialNodeType(ifcType: string): TreeNode['type'] {
  switch (ifcType) {
    case 'IFCPROJECT': return 'IfcProject';
    case 'IFCSITE': return 'IfcSite';
    case 'IFCBUILDING': return 'IfcBuilding';
    case 'IFCBUILDINGSTOREY': return 'IfcBuildingStorey';
    case 'IFCSPACE': case 'IFCSPACETYPE': case 'IFCZONE': return 'IfcSpace';
    default: return 'element';
  }
}

function collectEntityIdsEager(node: IfcSpatialNode, renderableEntityIds: Set<number>): number[] {
  const ids: number[] = [];
  if (renderableEntityIds.has(node.expressID)) ids.push(node.expressID);
  node.elements?.forEach((el) => ids.push(el.expressID));
  node.children.forEach((child) => {
    const childIds = collectEntityIdsEager(child, renderableEntityIds);
    for (let i = 0; i < childIds.length; i++) ids.push(childIds[i]);
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
  rows: TreeNode[] = [],
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

    const subtleParts = [displayName ? typeLabel : null].filter((v): v is string => Boolean(v));
    const badges = [
      ...(elevation ? [`EL ${elevation}`] : []),
      ...(totalElementCount > 0 ? [formatCount(totalElementCount, 'el')] : []),
    ];

    rows.push({
      id: `spatial-${node.expressID}`, expressId: node.expressID, entityIds,
      name: displayName ?? typeLabel, type: nodeType, ifcType: node.type,
      depth, hasChildren, isExpanded, badges,
      meta: node.type === 'IFCBUILDINGSTOREY' ? null : `#${node.expressID}`,
      subtitle: subtleParts.join(' · ') || null,
      storeyElevation: elevation ? getNodeElevation(node) : null,
      spatialNode: node,
    });

    if (hasChildren && isExpanded) {
      buildSpatialTree(node.children, expandedIds, selectedEntityIds, spatialMetrics, searchActive, entityIdSet, depth + 1, rows);
      if (node.type === 'IFCBUILDINGSTOREY' && elementCount > 0) {
        node.elements?.forEach((element) => {
          rows.push({
            id: `spatial-element-${element.expressID}`, expressId: element.expressID,
            entityIds: [element.expressID],
            name: element.name ?? `${formatIfcType(element.ifcType)} #${element.expressID}`,
            type: 'element', ifcType: element.ifcType, depth: depth + 1,
            hasChildren: false, isExpanded: false,
            meta: `#${element.expressID}`, subtitle: formatIfcType(element.ifcType),
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
  entities: EntitySummary[], expandedIds: Set<string | number>,
  selectedEntityIds: Set<number>, searchQuery: string, entityIdSet: Set<number>,
): TreeNode[] {
  const rows: TreeNode[] = [
    { id: 'class-reset', expressId: 0, entityIds: [], name: 'All Classes', type: 'reset', depth: 0, hasChildren: false, isExpanded: false, subtitle: '전체 IFC 클래스 표시' },
  ];

  const filtered = entities.filter((e) => entityIdSet.has(e.expressId));
  const grouped = new Map<string, EntitySummary[]>();
  filtered.forEach((e) => { if (!grouped.has(e.ifcType)) grouped.set(e.ifcType, []); grouped.get(e.ifcType)!.push(e); });

  const classGroups = [...grouped.entries()]
    .map(([ifcType, items]) => ({ key: `class-${ifcType}`, label: ifcType, entityIds: items.map((i) => i.expressId), children: items }))
    .filter((g) => matchesSearch(searchQuery, g.label, ...g.children.flatMap((c) => [c.label, c.name, String(c.expressId)])))
    .sort((a, b) => a.label.localeCompare(b.label));

  classGroups.forEach((group) => {
    const isExpanded = expandedIds.has(group.key);
    rows.push({
      id: group.key, expressId: 0, entityIds: group.entityIds,
      name: formatIfcType(group.label), type: 'type-group', ifcType: group.label,
      depth: 0, hasChildren: group.children.length > 0, isExpanded,
      subtitle: `${group.children.length} elements`, meta: formatCount(group.children.length, 'el'),
    });
    if (isExpanded) {
      group.children.forEach((child) => {
        rows.push({
          id: `class-entity-${child.expressId}`, expressId: child.expressId, entityIds: [child.expressId],
          name: child.label, type: 'element', ifcType: child.ifcType, depth: 1,
          hasChildren: false, isExpanded: false, subtitle: formatIfcType(child.ifcType), meta: `#${child.expressId}`,
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
  typeGroups: IfcTypeTreeGroup[], expandedIds: Set<string | number>,
  selectedEntityIds: Set<number>, searchQuery: string, entityIdSet: Set<number>,
): TreeNode[] {
  const rows: TreeNode[] = [
    { id: 'type-reset', expressId: 0, entityIds: [], name: 'All Types', type: 'reset', depth: 0, hasChildren: false, isExpanded: false, subtitle: '전체 타입 그룹 표시' },
  ];

  const filteredGroups: Array<{ group: IfcTypeTreeGroup; key: string; families: Array<{ family: IfcTypeTreeGroup['families'][number]; key: string }> }> = [];
  typeGroups.forEach((group) => {
    const families = group.families
      .map((f) => ({ family: f, key: `type-family-${group.typeClassName}-${f.typeExpressID ?? f.typeName}` }))
      .filter(({ family: f }) => matchesSearch(searchQuery, group.typeClassName, f.typeName, ...f.children.flatMap((c) => [c.name, c.ifcType, String(c.expressID)])));
    if (families.length > 0) filteredGroups.push({ group, key: `type-class-${group.typeClassName}`, families });
  });

  filteredGroups.forEach(({ group, key, families }) => {
    const isGroupExpanded = expandedIds.has(key);
    const filteredGroupEntityIds = group.entityIds.filter((id) => entityIdSet.has(id));
    rows.push({
      id: key, expressId: 0, entityIds: filteredGroupEntityIds,
      name: formatIfcType(group.typeClassName), type: 'type-group', ifcType: group.typeClassName,
      depth: 0, hasChildren: families.length > 0, isExpanded: isGroupExpanded,
      subtitle: `${families.length} type groups`, meta: formatCount(group.entityIds.length, 'el'),
    });
    if (!isGroupExpanded) return;

    families.forEach(({ family, key: familyKey }) => {
      const isFamilyExpanded = expandedIds.has(familyKey);
      const filteredChildren = family.children.filter((c) => entityIdSet.has(c.expressID));
      const filteredEntityIds = family.entityIds.filter((id) => entityIdSet.has(id));
      if (filteredChildren.length === 0) return;

      rows.push({
        id: familyKey, expressId: 0, entityIds: filteredEntityIds,
        name: family.typeName, type: 'type-family', ifcType: family.typeClassName,
        entityExpressId: family.typeExpressID ?? undefined, depth: 1,
        hasChildren: filteredChildren.length > 0, isExpanded: isFamilyExpanded,
        subtitle: family.isUntyped ? `${formatIfcType(group.typeClassName)} · ${filteredChildren.length} untyped` : `${formatIfcType(family.typeClassName)} · ${filteredChildren.length} instances`,
        meta: formatCount(filteredChildren.length, 'el'),
        typeBadge: family.typeExpressID !== null ? `#${family.typeExpressID}` : null,
      });
      if (!isFamilyExpanded) return;

      filteredChildren.forEach((child) => {
        rows.push({
          id: `type-entity-${child.expressID}`, expressId: child.expressID, entityIds: [child.expressID],
          name: child.name ?? `${formatIfcType(child.ifcType)} #${child.expressID}`,
          type: 'element', ifcType: child.ifcType, depth: 2,
          hasChildren: false, isExpanded: false,
          subtitle: formatIfcType(child.ifcType), meta: `#${child.expressID}`,
        });
      });
    });
  });
  return rows;
}
