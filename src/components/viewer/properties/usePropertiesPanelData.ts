import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ifcWorkerClient } from '@/services/IfcWorkerClient';
import { useViewerStore } from '@/stores';
import type { PropertySectionKind } from '@/types/worker-messages';

export function usePropertiesPanelData() {
  const store = useViewerStore(useShallow((state) => ({
    currentModelId: state.currentModelId,
    selectedEntityId: state.selectedEntityId,
    selectedEntityIds: state.selectedEntityIds,
    hideEntity: state.hideEntity,
    hiddenEntityIds: state.hiddenEntityIds,
    resetHiddenEntities: state.resetHiddenEntities,
    properties: state.selectedProperties,
    propertiesLoading: state.propertiesLoading,
    propertiesError: state.propertiesError,
    propertiesLoadingSections: state.propertiesLoadingSections,
    setPropertiesState: state.setPropertiesState,
    mergeSelectedProperties: state.mergeSelectedProperties,
  })));

  const loadPropertySections = useCallback(async (sections: PropertySectionKind[]) => {
    if (store.currentModelId === null || store.selectedEntityId === null) {
      return;
    }

    const missingSections = sections.filter(
      (section) =>
        !store.properties.loadedSections.includes(section) &&
        !store.propertiesLoadingSections.includes(section)
    );
    if (missingSections.length === 0) {
      return;
    }

    store.setPropertiesState(true, null, missingSections);

    try {
      const result = await ifcWorkerClient.getPropertiesSections(
        store.currentModelId,
        store.selectedEntityId,
        missingSections
      );
      store.mergeSelectedProperties(result.properties);
    } catch (error) {
      store.setPropertiesState(false, error instanceof Error ? error.message : '속성 조회 실패');
    }
  }, [
    store.currentModelId,
    store.mergeSelectedProperties,
    store.properties.loadedSections,
    store.propertiesLoadingSections,
    store.selectedEntityId,
    store.setPropertiesState,
  ]);

  return {
    currentModelId: store.currentModelId,
    selectedEntityId: store.selectedEntityId,
    selectedEntityIds: store.selectedEntityIds,
    hideEntity: store.hideEntity,
    hiddenEntityIds: store.hiddenEntityIds,
    resetHiddenEntities: store.resetHiddenEntities,
    properties: store.properties,
    propertiesLoading: store.propertiesLoading,
    propertiesError: store.propertiesError,
    propertiesLoadingSections: store.propertiesLoadingSections,
    loadPropertySections,
  };
}
