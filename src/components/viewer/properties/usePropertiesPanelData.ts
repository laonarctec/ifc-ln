import { useCallback } from 'react';
import { ifcWorkerClient } from '@/services/IfcWorkerClient';
import { useViewerStore } from '@/stores';
import type { PropertySectionKind } from '@/types/worker-messages';

export function usePropertiesPanelData() {
  const currentModelId = useViewerStore((state) => state.currentModelId);
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const selectedEntityIds = useViewerStore((state) => state.selectedEntityIds);
  const hideEntity = useViewerStore((state) => state.hideEntity);
  const hiddenEntityIds = useViewerStore((state) => state.hiddenEntityIds);
  const resetHiddenEntities = useViewerStore((state) => state.resetHiddenEntities);
  const properties = useViewerStore((state) => state.selectedProperties);
  const propertiesLoading = useViewerStore((state) => state.propertiesLoading);
  const propertiesError = useViewerStore((state) => state.propertiesError);
  const propertiesLoadingSections = useViewerStore((state) => state.propertiesLoadingSections);
  const setPropertiesState = useViewerStore((state) => state.setPropertiesState);
  const mergeSelectedProperties = useViewerStore((state) => state.mergeSelectedProperties);

  const loadPropertySections = useCallback(async (sections: PropertySectionKind[]) => {
    if (currentModelId === null || selectedEntityId === null) {
      return;
    }

    const missingSections = sections.filter(
      (section) =>
        !properties.loadedSections.includes(section) &&
        !propertiesLoadingSections.includes(section)
    );
    if (missingSections.length === 0) {
      return;
    }

    setPropertiesState(true, null, missingSections);

    try {
      const result = await ifcWorkerClient.getPropertiesSections(
        currentModelId,
        selectedEntityId,
        missingSections
      );
      mergeSelectedProperties(result.properties);
    } catch (error) {
      setPropertiesState(false, error instanceof Error ? error.message : '속성 조회 실패');
    }
  }, [
    currentModelId,
    mergeSelectedProperties,
    properties.loadedSections,
    propertiesLoadingSections,
    selectedEntityId,
    setPropertiesState,
  ]);

  return {
    currentModelId,
    selectedEntityId,
    selectedEntityIds,
    hideEntity,
    hiddenEntityIds,
    resetHiddenEntities,
    properties,
    propertiesLoading,
    propertiesError,
    propertiesLoadingSections,
    loadPropertySections,
  };
}
