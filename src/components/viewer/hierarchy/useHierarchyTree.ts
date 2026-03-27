import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { IfcSpatialNode, IfcTypeTreeGroup } from '@/types/worker-messages';
import type { GroupingMode } from '@/types/hierarchy';
import {
  buildClassTree,
  buildEntityNameMap,
  buildSpatialMetrics,
  buildSpatialTree,
  buildTypeTree,
  collectExpandedIds,
  collectSpatialEntities,
  countNodes,
  filterNodes,
} from './treeDataBuilder';

interface UseHierarchyTreeParams {
  spatialTree: IfcSpatialNode[];
  typeTree: IfcTypeTreeGroup[];
  entityIdSet: Set<number>;
}

export function useHierarchyTree(params: UseHierarchyTreeParams) {
  const { spatialTree, typeTree, entityIdSet } = params;

  const [groupingMode, setGroupingModeRaw] = useState<GroupingMode>(() => {
    const stored = localStorage.getItem('ifc-ln:hierarchy-grouping');
    return (stored === 'class' || stored === 'type') ? stored : 'spatial';
  });
  const setGroupingMode = (mode: GroupingMode) => {
    setGroupingModeRaw(mode);
    localStorage.setItem('ifc-ln:hierarchy-grouping', mode);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(() => new Set());

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const searchActive = normalizedSearchQuery.length > 0;

  // Auto-expand spatial tree to depth 2 when tree changes
  useEffect(() => {
    setExpandedIds(collectExpandedIds(spatialTree, 2) as Set<string | number>);
  }, [spatialTree]);

  // Entity data
  const entityNameMap = useMemo(() => buildEntityNameMap(spatialTree), [spatialTree]);
  const spatialMetrics = useMemo(() => buildSpatialMetrics(spatialTree), [spatialTree]);

  const entities = useMemo(() => {
    const deduped = collectSpatialEntities(spatialTree);
    return [...deduped.values()]
      .map((entity) => ({
        ...entity,
        name: entity.name ?? entityNameMap.get(entity.expressId) ?? null,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [entityNameMap, spatialTree]);

  // Filtered spatial nodes
  const filteredSpatialNodes = useMemo(
    () => filterNodes(spatialTree, normalizedSearchQuery),
    [normalizedSearchQuery, spatialTree]
  );

  const totalNodeCount = useMemo(() => countNodes(filteredSpatialNodes), [filteredSpatialNodes]);

  // Build tree nodes based on current grouping mode
  const treeNodes = useMemo(() => {
    if (groupingMode === 'spatial') {
      return buildSpatialTree(
        filteredSpatialNodes,
        expandedIds,
        spatialMetrics,
        searchActive,
        entityIdSet
      );
    }

    if (groupingMode === 'class') {
      return buildClassTree(entities, expandedIds, normalizedSearchQuery, entityIdSet);
    }

    return buildTypeTree(typeTree, expandedIds, normalizedSearchQuery, entityIdSet);
  }, [
    groupingMode,
    filteredSpatialNodes,
    expandedIds,
    spatialMetrics,
    searchActive,
    entityIdSet,
    entities,
    normalizedSearchQuery,
    typeTree,
  ]);

  const toggleExpand = (nodeId: string | number) => {
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

  return {
    groupingMode,
    setGroupingMode,
    searchQuery,
    setSearchQuery,
    treeNodes,
    filteredSpatialNodes,
    spatialMetrics,
    entities,
    toggleExpand,
    totalNodeCount,
    expandedIds,
  };
}
