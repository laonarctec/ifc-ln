import { useMemo } from 'react';
import { useViewerStore } from '@/stores';
import type { IfcSpatialNode } from '@/types/worker-messages';
import {
  findNodeById,
  collectRenderableNodeEntityIds,
  collectSpatialEntities,
} from '@/components/viewer/hierarchy/treeDataBuilder';
import type { EntitySummary } from '@/types/hierarchy';

export function useViewportEntityFilters(
  spatialTree: IfcSpatialNode[],
  activeClassFilter: string | null,
  activeTypeFilter: string | null,
  activeStoreyFilter: number | null,
) {
  const hiddenEntityIds = useViewerStore((state) => state.hiddenEntityIds);
  const isolatedEntityIds = useViewerStore((state) => state.isolatedEntityIds);
  const typeVisibility = useViewerStore((state) => state.typeVisibility);
  const activeTypeToggles = useViewerStore((state) => state.activeTypeToggles);

  const entitySummaries = useMemo(
    () => collectSpatialEntities(spatialTree),
    [spatialTree],
  );

  const entityIds = useMemo(() => [...entitySummaries.keys()], [entitySummaries]);
  const renderableEntityIdSet = useMemo(() => new Set(entityIds), [entityIds]);

  const filteredHiddenIdSet = useMemo(() => {
    if (entityIds.length === 0) return new Set<number>();

    const hasTypeFilter = activeTypeFilter !== null;
    const hasClassFilter = activeClassFilter !== null;
    const hasStoreyFilter = activeStoreyFilter !== null;

    if (!hasTypeFilter && !hasClassFilter && !hasStoreyFilter) {
      return new Set<number>();
    }

    let storeyVisibleIds: Set<number> | null = null;
    if (hasStoreyFilter) {
      const storeyNode = findNodeById(spatialTree, activeStoreyFilter);
      storeyVisibleIds = storeyNode
        ? collectRenderableNodeEntityIds(storeyNode, renderableEntityIdSet)
        : new Set<number>();
    }

    const result = new Set<number>();
    for (const entityId of entityIds) {
      let visible = true;
      if (hasTypeFilter && entitySummaries.get(entityId)?.ifcType !== activeTypeFilter) visible = false;
      if (visible && hasClassFilter) {
        const ifcType = entitySummaries.get(entityId)?.ifcType;
        if (!ifcType || ifcType !== activeClassFilter) visible = false;
      }
      if (visible && storeyVisibleIds && !storeyVisibleIds.has(entityId)) visible = false;
      if (!visible) result.add(entityId);
    }

    return result;
  }, [activeClassFilter, activeStoreyFilter, activeTypeFilter, entityIds, entitySummaries, renderableEntityIdSet, spatialTree]);

  const typeHiddenIdSet = useMemo(() => {
    const allVisible = typeVisibility.spaces && typeVisibility.openings && typeVisibility.site;
    if (allVisible || entitySummaries.size === 0) return new Set<number>();
    const hiddenTypes = new Set<string>();
    if (!typeVisibility.spaces) hiddenTypes.add('IFCSPACE');
    if (!typeVisibility.openings) hiddenTypes.add('IFCOPENINGELEMENT');
    if (!typeVisibility.site) hiddenTypes.add('IFCSITE');
    const result = new Set<number>();
    for (const [entityId, summary] of entitySummaries) {
      if (hiddenTypes.has(summary.ifcType.toUpperCase())) {
        result.add(entityId);
      }
    }
    return result;
  }, [typeVisibility, entitySummaries]);

  const typeToggleHiddenIdSet = useMemo(() => {
    if (activeTypeToggles.size === 0 || entitySummaries.size === 0) return new Set<number>();
    const result = new Set<number>();
    for (const [entityId, summary] of entitySummaries) {
      const upper = summary.ifcType.toUpperCase();
      const base = upper.replace(/STANDARDCASE$|ELEMENTEDCASE$/, '');
      if (!activeTypeToggles.has(upper) && !activeTypeToggles.has(base)) {
        result.add(entityId);
      }
    }
    return result;
  }, [activeTypeToggles, entitySummaries]);

  const isolationHiddenIdSet = useMemo(() => {
    if (!isolatedEntityIds || entityIds.length === 0) return new Set<number>();
    const result = new Set<number>();
    for (const entityId of entityIds) {
      if (!isolatedEntityIds.has(entityId)) result.add(entityId);
    }
    return result;
  }, [isolatedEntityIds, entityIds]);

  const effectiveHiddenIdSet = useMemo(() => {
    if (filteredHiddenIdSet.size === 0 && hiddenEntityIds.size === 0 && typeHiddenIdSet.size === 0 && typeToggleHiddenIdSet.size === 0 && isolationHiddenIdSet.size === 0) {
      return new Set<number>();
    }
    const result = new Set(filteredHiddenIdSet);
    hiddenEntityIds.forEach((id) => result.add(id));
    typeHiddenIdSet.forEach((id) => result.add(id));
    typeToggleHiddenIdSet.forEach((id) => result.add(id));
    isolationHiddenIdSet.forEach((id) => result.add(id));
    return result;
  }, [filteredHiddenIdSet, hiddenEntityIds, typeHiddenIdSet, typeToggleHiddenIdSet, isolationHiddenIdSet]);

  const effectiveHiddenIds = useMemo(() => [...effectiveHiddenIdSet], [effectiveHiddenIdSet]);

  const activeFilterSummary = useMemo(() => {
    const segments: string[] = [];
    if (activeClassFilter) segments.push(`class ${activeClassFilter}`);
    if (activeTypeFilter) segments.push(`type ${activeTypeFilter}`);
    if (activeStoreyFilter) segments.push(`storey ${activeStoreyFilter}`);
    return segments.length > 0 ? segments.join(' · ') : null;
  }, [activeClassFilter, activeStoreyFilter, activeTypeFilter]);

  return {
    entitySummaries: entitySummaries as Map<number, EntitySummary>,
    entityIds,
    effectiveHiddenIdSet,
    effectiveHiddenIds,
    activeFilterSummary,
  };
}
