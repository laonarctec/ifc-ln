import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useViewerStore } from '@/stores';
import type { IfcSpatialNode, IfcTypeTreeGroup } from '@/types/worker-messages';

interface HierarchyPanelData {
  currentModelId: number | null;
  spatialTree: IfcSpatialNode[];
  typeTree: IfcTypeTreeGroup[];
  activeClassFilter: string | null;
  activeTypeFilter: string | null;
  activeStoreyFilter: number | null;
}

export function useHierarchyPanelData(): HierarchyPanelData {
  const store = useViewerStore(useShallow((state) => ({
    currentFileName: state.currentFileName,
    currentModelId: state.currentModelId,
    spatialTree: state.spatialTree,
    typeTree: state.typeTree,
    activeClassFilter: state.activeClassFilter,
    activeTypeFilter: state.activeTypeFilter,
    activeStoreyFilter: state.activeStoreyFilter,
  })));

  const resolvedSpatialTree = useMemo<IfcSpatialNode[]>(
    () =>
      store.spatialTree.length > 0
        ? store.spatialTree
        : [{ expressID: 0, type: store.currentFileName ? 'IFCPROJECT' : 'EMPTY', children: [] }],
    [store.currentFileName, store.spatialTree],
  );

  return {
    currentModelId: store.currentModelId,
    spatialTree: resolvedSpatialTree,
    typeTree: store.typeTree,
    activeClassFilter: store.activeClassFilter,
    activeTypeFilter: store.activeTypeFilter,
    activeStoreyFilter: store.activeStoreyFilter,
  };
}
