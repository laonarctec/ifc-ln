import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MutableRefObject,
} from "react";
import { useShallow } from "zustand/react/shallow";
import { useWebIfc } from "@/hooks/useWebIfc";
import { useToolbarClippingActions } from "@/hooks/controllers/useToolbarClippingActions";
import { useToolbarEngineActions } from "@/hooks/controllers/useToolbarEngineActions";
import { useToolbarExportActions } from "@/hooks/controllers/useToolbarExportActions";
import { useToolbarFileActions } from "@/hooks/controllers/useToolbarFileActions";
import { useToolbarMenuAutoClose } from "@/hooks/controllers/useToolbarMenuAutoClose";
import { useViewportGeometry, viewportGeometryStore } from "@/services/viewportGeometryStore";
import { getActiveClippingPlane } from "@/stores/slices/clippingStateUtils";
import { useViewerStore } from "@/stores";
import { selectPanelState, selectSelectionState, selectVisibilityState } from "@/stores/viewerSelectors";
import type {
  ToolbarActionConfig,
  ToolbarMenuConfig,
  TypeVisibilityKey,
} from "@/components/viewer/mainToolbarPrimitives";
import { collectStoreys } from "@/components/viewer/hierarchy/treeDataBuilder";
import {
  buildPanelActions,
  buildFileActions,
  buildVisibilityActions,
  buildCameraActions,
  buildUtilityActions,
  buildViewMenu,
  buildFloorplanMenu,
  buildClassVisibilityMenu,
  buildMeasureMenu,
  buildSectionViewAction,
  buildQuantitySplitAction,
  buildExportMenu,
  buildEngineMenu,
  buildPanelsMenu,
  checkTypeGeometry,
  type ToolbarState,
  type ToolbarHandlers,
} from "@/components/viewer/toolbar/toolbarConfigs";

export interface MainToolbarController {
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  addModelInputRef: MutableRefObject<HTMLInputElement | null>;
  toolbarRef: MutableRefObject<HTMLElement | null>;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAddModelChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  leftPanelAction: ToolbarActionConfig | null;
  rightPanelAction: ToolbarActionConfig | null;
  fileActions: ToolbarActionConfig[];
  visibilityActions: ToolbarActionConfig[];
  cameraActions: ToolbarActionConfig[];
  utilityActions: ToolbarActionConfig[];
  sectionViewAction: ToolbarActionConfig;
  quantitySplitAction: ToolbarActionConfig;
  viewMenu: ToolbarMenuConfig;
  engineMenu: ToolbarMenuConfig;
  panelsMenu: ToolbarMenuConfig;
  floorplanMenu: ToolbarMenuConfig | null;
  classVisibilityMenu: ToolbarMenuConfig | null;
  measureMenu: ToolbarMenuConfig;
  exportMenu: ToolbarMenuConfig;
}

export function useMainToolbarController(): MainToolbarController {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const toolbarRef = useRef<HTMLElement | null>(null);

  const panelState = useViewerStore(useShallow(selectPanelState));
  const selectionState = useViewerStore(useShallow(selectSelectionState));
  const visibilityState = useViewerStore(useShallow(selectVisibilityState));
  const interactionMode = useViewerStore((state) => state.interactionMode);
  const measurement = useViewerStore((state) => state.measurement);
  const trackedChanges = useViewerStore((state) => state.trackedChanges);
  const toggleMeasurementMode = useViewerStore(
    (state) => state.toggleMeasurementMode,
  );
  const clearMeasurement = useViewerStore((state) => state.clearMeasurement);
  const rightPanelMode = useViewerStore((state) => state.rightPanelMode);
  const bottomPanelMode = useViewerStore((state) => state.bottomPanelMode);
  const toggleRightPanelMode = useViewerStore((state) => state.toggleRightPanelMode);
  const toggleBottomPanelMode = useViewerStore((state) => state.toggleBottomPanelMode);
  const quantitySplitState = useViewerStore((state) => state.quantitySplit);
  const startQuantitySplit = useViewerStore((state) => state.startQuantitySplit);
  const clearQuantitySplit = useViewerStore((state) => state.clearQuantitySplit);
  const setInteractionMode = useViewerStore((state) => state.setInteractionMode);
  const setRightPanelMode = useViewerStore((state) => state.setRightPanelMode);
  const clipping = useViewerStore((state) => state.clipping);
  const startCreateClippingPlane = useViewerStore(
    (state) => state.startCreateClippingPlane,
  );
  const flipClippingPlane = useViewerStore((state) => state.flipClippingPlane);
  const deleteClippingPlane = useViewerStore((state) => state.deleteClippingPlane);
  const clearClippingPlanes = useViewerStore((state) => state.clearClippingPlanes);
  const setActiveStoreyFilter = useViewerStore(
    (state) => state.setActiveStoreyFilter,
  );

  const {
    loadFile,
    resetSession,
    loading,
    initEngine,
    engineState,
    engineMessage,
    loadedModels,
    currentFileName,
    currentModelId,
    currentModelSchema,
    spatialTree,
  } = useWebIfc();
  const { combinedManifest } = useViewportGeometry();
  const {
    fileInputRef,
    addModelInputRef,
    handleOpenFile,
    handleAddModel,
    handleFileChange,
    handleAddModelChange,
  } = useToolbarFileActions({
    loadFile,
    resetSession,
  });

  const entityIds = useMemo(
    () =>
      [
        ...new Set(
          combinedManifest?.chunks.flatMap((chunk) => chunk.entityIds) ?? [],
        ),
      ],
    [combinedManifest],
  );
  const storeys = useMemo(() => collectStoreys(spatialTree), [spatialTree]);
  const typeGeometryExists = useMemo<Record<TypeVisibilityKey, boolean>>(() => {
    const result = { spaces: false, openings: false, site: false };
    for (const node of spatialTree) {
      checkTypeGeometry(node, result);
      if (result.spaces && result.openings && result.site) break;
    }
    return result;
  }, [spatialTree]);

  const hasRenderableGeometry = entityIds.length > 0;
  const hasLoadedModel = loadedModels.length > 0;
  const hasSelection = selectionState.selectedEntityIds.length > 0;
  const hasSpatialTree = spatialTree.length > 0;
  const selectedClippingPlane = getActiveClippingPlane(clipping);
  const {
    handleStartCreateClippingPlane,
    handleFlipSelectedClippingPlane,
    handleDeleteSelectedClippingPlane,
    handleClearClippingPlanes,
  } = useToolbarClippingActions({
    hasLoadedModel,
    rightPanelCollapsed: panelState.rightPanelCollapsed,
    toggleRightPanel: panelState.toggleRightPanel,
    setRightPanelTab: panelState.setRightPanelTab,
    startCreateClippingPlane,
    selectedClippingPlaneId: selectedClippingPlane?.id ?? null,
    flipClippingPlane,
    deleteClippingPlane,
    clearClippingPlanes,
  });
  const {
    handleInitEngine,
    handleInitEngineST,
    handleInitEngineMT,
  } = useToolbarEngineActions({
    initEngine,
  });

  useToolbarMenuAutoClose(toolbarRef);


  const exportActions = useToolbarExportActions({
    currentFileName,
    currentModelId,
    currentModelSchema,
    selectedEntityId: selectionState.selectedEntityId,
    spatialTree,
    trackedChanges,
    loadedModels,
    hasSpatialTree,
  });

  const toolbarState: ToolbarState = {
    leftPanelCollapsed: panelState.leftPanelCollapsed,
    rightPanelCollapsed: panelState.rightPanelCollapsed,
    hasLoadedModel,
    viewportProjectionMode: panelState.viewportProjectionMode,
    hoverTooltipsEnabled: panelState.hoverTooltipsEnabled,
    edgesVisible: panelState.edgesVisible,
    typeVisibility: visibilityState.typeVisibility,
    interactionMode,
    measurement,
    clippingMode: clipping.mode,
    clippingPlaneCount: clipping.planes.length,
    hasSelectedClippingPlane: selectedClippingPlane !== null,
    selectedClippingPlaneLocked: selectedClippingPlane?.locked ?? false,
    engineState,
    engineMessage,
    loading,
    hasRenderableGeometry,
    hasSelection,
    hasSpatialTree,
    selectedEntityId: selectionState.selectedEntityId,
    selectedEntityIds: selectionState.selectedEntityIds,
    currentModelId,
    currentFileName,
    trackedChanges,
    typeGeometryExists,
    storeys,
    rightPanelMode,
    bottomPanelMode,
    quantitySplitActive: quantitySplitState.active,
  };

  const toolbarHandlers: ToolbarHandlers = {
    toggleLeftPanel: panelState.toggleLeftPanel,
    toggleRightPanel: panelState.toggleRightPanel,
    toggleViewportProjectionMode: panelState.toggleViewportProjectionMode,
    toggleHoverTooltips: panelState.toggleHoverTooltips,
    toggleEdgesVisible: panelState.toggleEdgesVisible,
    toggleTypeVisibility: visibilityState.toggleTypeVisibility,
    toggleMeasurementMode,
    clearMeasurement,
    startCreateClippingPlane: handleStartCreateClippingPlane,
    flipSelectedClippingPlane: handleFlipSelectedClippingPlane,
    deleteSelectedClippingPlane: handleDeleteSelectedClippingPlane,
    clearClippingPlanes: handleClearClippingPlanes,
    isolateEntities: visibilityState.isolateEntities,
    hideEntity: visibilityState.hideEntity,
    resetHiddenEntities: () => visibilityState.resetHiddenEntities(),
    clearSelection: selectionState.clearSelection,
    runViewportCommand: panelState.runViewportCommand,
    setActiveStoreyFilter,
    initEngine: handleInitEngine,
    initEngineST: handleInitEngineST,
    initEngineMT: handleInitEngineMT,
    handleOpenFile,
    handleAddModel,
    resetSession,
    setShortcutsOpen,
    ...exportActions,
    toggleRightPanelMode,
    toggleBottomPanelMode,
    toggleQuantitySplit: () => {
      if (quantitySplitState.active) {
        clearQuantitySplit();
        setInteractionMode("select");
        setRightPanelMode("properties");
      } else {
        // Auto-compute bounds from loaded geometry
        const geo = viewportGeometryStore.getSnapshot();
        const manifest = geo.combinedManifest;
        if (!manifest) return;
        const [minX, minY, minZ, maxX, maxY] = manifest.modelBounds;
        const dx = maxX - minX;
        const dy = maxY - minY;
        const padding = 0.1;
        startQuantitySplit(minZ, {
          min: [minX - dx * padding, minY - dy * padding],
          max: [maxX + dx * padding, maxY + dy * padding],
        });
        setInteractionMode("quantity-split");
        setRightPanelMode("split");
      }
    },
  };

  const [leftPanelAction, rightPanelAction] = buildPanelActions(
    toolbarState,
    toolbarHandlers,
  );

  return {
    shortcutsOpen,
    setShortcutsOpen,
    fileInputRef,
    addModelInputRef,
    toolbarRef,
    handleFileChange,
    handleAddModelChange,
    leftPanelAction,
    rightPanelAction,
    fileActions: buildFileActions(toolbarState, toolbarHandlers),
    visibilityActions: buildVisibilityActions(
      toolbarState,
      toolbarHandlers,
      entityIds,
    ),
    cameraActions: buildCameraActions(toolbarState, toolbarHandlers),
    utilityActions: buildUtilityActions(toolbarHandlers),
    sectionViewAction: buildSectionViewAction(toolbarState, toolbarHandlers),
    quantitySplitAction: buildQuantitySplitAction(toolbarState, toolbarHandlers),
    viewMenu: buildViewMenu(toolbarState, toolbarHandlers),
    engineMenu: buildEngineMenu(toolbarState, toolbarHandlers),
    floorplanMenu: buildFloorplanMenu(toolbarState, toolbarHandlers),
    classVisibilityMenu: buildClassVisibilityMenu(
      toolbarState,
      toolbarHandlers,
    ),
    measureMenu: buildMeasureMenu(toolbarState, toolbarHandlers),
    panelsMenu: buildPanelsMenu(toolbarState, toolbarHandlers),
    exportMenu: buildExportMenu(toolbarState, toolbarHandlers),
  };
}
