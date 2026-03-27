import type { ViewerState } from "./index";

export const selectCurrentModelState = (state: ViewerState) => ({
  activeModelId: state.activeModelId,
  currentFileName: state.currentFileName,
  currentModelId: state.currentModelId,
  currentModelSchema: state.currentModelSchema,
  currentModelMaxExpressId: state.currentModelMaxExpressId,
  geometryReady: state.geometryReady,
  geometryMeshCount: state.geometryMeshCount,
  geometryVertexCount: state.geometryVertexCount,
  geometryIndexCount: state.geometryIndexCount,
  loadedModels: state.loadedModels,
  spatialTree: state.spatialTree,
  typeTree: state.typeTree,
  selectedProperties: state.selectedProperties,
  propertiesLoading: state.propertiesLoading,
  propertiesError: state.propertiesError,
  propertiesLoadingSections: state.propertiesLoadingSections,
  setActiveModelId: state.setActiveModelId,
  setModelVisibility: state.setModelVisibility,
  mergeSelectedProperties: state.mergeSelectedProperties,
  setPropertiesState: state.setPropertiesState,
  setSpatialTree: state.setSpatialTree,
  setTypeTree: state.setTypeTree,
  clearTypeTree: state.clearTypeTree,
  addLoadedModel: state.addLoadedModel,
  removeLoadedModel: state.removeLoadedModel,
  clearLoadedModels: state.clearLoadedModels,
  setGeometryReady: state.setGeometryReady,
  setGeometrySummary: state.setGeometrySummary,
});

export const selectSelectionState = (state: ViewerState) => ({
  selectedModelId: state.selectedModelId,
  selectedEntityId: state.selectedEntityId,
  selectedEntityIds: state.selectedEntityIds,
  setSelectedEntity: state.setSelectedEntity,
  setSelectedEntities: state.setSelectedEntities,
  setSelectedEntityId: state.setSelectedEntityId,
  setSelectedEntityIds: state.setSelectedEntityIds,
  clearSelection: state.clearSelection,
});

export const selectVisibilityState = (state: ViewerState) => ({
  hiddenEntityKeys: state.hiddenEntityKeys,
  isolatedEntityKeys: state.isolatedEntityKeys,
  typeVisibility: state.typeVisibility,
  activeTypeToggles: state.activeTypeToggles,
  hideEntity: state.hideEntity,
  showEntity: state.showEntity,
  isolateEntity: state.isolateEntity,
  isolateEntities: state.isolateEntities,
  setIsolation: state.setIsolation,
  clearIsolation: state.clearIsolation,
  resetHiddenEntities: state.resetHiddenEntities,
  toggleTypeVisibility: state.toggleTypeVisibility,
  toggleIfcTypeFilter: state.toggleIfcTypeFilter,
  clearIfcTypeFilters: state.clearIfcTypeFilters,
});

export const selectPanelState = (state: ViewerState) => ({
  leftPanelCollapsed: state.leftPanelCollapsed,
  rightPanelCollapsed: state.rightPanelCollapsed,
  leftPanelTab: state.leftPanelTab,
  rightPanelTab: state.rightPanelTab,
  viewportProjectionMode: state.viewportProjectionMode,
  viewportCommand: state.viewportCommand,
  theme: state.theme,
  hoverTooltipsEnabled: state.hoverTooltipsEnabled,
  edgesVisible: state.edgesVisible,
  autoStoreyTracking: state.autoStoreyTracking,
  setLeftPanelCollapsed: state.setLeftPanelCollapsed,
  setRightPanelCollapsed: state.setRightPanelCollapsed,
  setLeftPanelTab: state.setLeftPanelTab,
  setRightPanelTab: state.setRightPanelTab,
  toggleLeftPanel: state.toggleLeftPanel,
  toggleRightPanel: state.toggleRightPanel,
  setViewportProjectionMode: state.setViewportProjectionMode,
  toggleViewportProjectionMode: state.toggleViewportProjectionMode,
  runViewportCommand: state.runViewportCommand,
  toggleTheme: state.toggleTheme,
  toggleHoverTooltips: state.toggleHoverTooltips,
  toggleEdgesVisible: state.toggleEdgesVisible,
  toggleAutoStoreyTracking: state.toggleAutoStoreyTracking,
});

export const selectEngineState = (state: ViewerState) => ({
  isLoading: state.isLoading,
  loadingProgress: state.loadingProgress,
  progressLabel: state.progressLabel,
  viewerError: state.viewerError,
  engineState: state.engineState,
  engineMessage: state.engineMessage,
  frameRate: state.frameRate,
  setLoading: state.setLoading,
  setLoadingProgress: state.setLoadingProgress,
  resetLoading: state.resetLoading,
  setViewerError: state.setViewerError,
  clearViewerError: state.clearViewerError,
  setEngineState: state.setEngineState,
});

export const selectStatusBarState = (state: ViewerState) => ({
  currentFileName: state.currentFileName,
  currentModelId: state.currentModelId,
  currentModelSchema: state.currentModelSchema,
  currentModelMaxExpressId: state.currentModelMaxExpressId,
  engineState: state.engineState,
  geometryReady: state.geometryReady,
  isLoading: state.isLoading,
  progressLabel: state.progressLabel,
  viewerError: state.viewerError,
  selectedEntityId: state.selectedEntityId,
  selectedEntityIds: state.selectedEntityIds,
  hiddenEntityKeys: state.hiddenEntityKeys,
  frameRate: state.frameRate,
  interactionMode: state.interactionMode,
  measurement: state.measurement,
});

export const countHiddenEntitiesForModel = (
  hiddenEntityKeys: Set<string>,
  modelId: number | null,
) => {
  if (modelId === null) {
    return hiddenEntityKeys.size;
  }

  const prefix = `${modelId}:`;
  return [...hiddenEntityKeys].filter((key) => key.startsWith(prefix)).length;
};

export const getHiddenEntityIdsForModel = (
  hiddenEntityKeys: Set<string>,
  modelId: number | null,
) => {
  if (modelId === null) {
    return new Set<number>();
  }

  const prefix = `${modelId}:`;
  return new Set(
    [...hiddenEntityKeys]
      .filter((key) => key.startsWith(prefix))
      .map((key) => Number(key.slice(prefix.length))),
  );
};
