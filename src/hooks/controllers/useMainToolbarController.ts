import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MutableRefObject,
} from "react";
import { useShallow } from "zustand/react/shallow";
import { useWebIfc } from "@/hooks/useWebIfc";
import { useToolbarExportActions } from "@/hooks/controllers/useToolbarExportActions";
import { viewerNotificationPort } from "@/hooks/controllers/viewerPorts";
import { useViewportGeometry } from "@/services/viewportGeometryStore";
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
  buildClippingMenu,
  buildExportMenu,
  buildEngineMenu,
  checkTypeGeometry,
  type ToolbarState,
  type ToolbarHandlers,
} from "@/components/viewer/toolbar/toolbarConfigs";

export interface MainToolbarController {
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  toolbarRef: MutableRefObject<HTMLElement | null>;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  leftPanelAction: ToolbarActionConfig | null;
  rightPanelAction: ToolbarActionConfig | null;
  fileActions: ToolbarActionConfig[];
  visibilityActions: ToolbarActionConfig[];
  cameraActions: ToolbarActionConfig[];
  utilityActions: ToolbarActionConfig[];
  viewMenu: ToolbarMenuConfig;
  engineMenu: ToolbarMenuConfig;
  floorplanMenu: ToolbarMenuConfig | null;
  classVisibilityMenu: ToolbarMenuConfig | null;
  measureMenu: ToolbarMenuConfig;
  clippingMenu: ToolbarMenuConfig;
  exportMenu: ToolbarMenuConfig;
}

export function useMainToolbarController(): MainToolbarController {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const toolbar = toolbarRef.current;
      if (!toolbar) return;
      const openDetails = toolbar.querySelectorAll("details[open]");
      for (const details of openDetails) {
        if (!details.contains(event.target as Node)) {
          details.removeAttribute("open");
        }
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

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

  const handleOpenFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) return;
      try {
        for (const file of files) {
          await loadFile(file);
        }
        viewerNotificationPort.success(`${files.length}개 IFC 로딩 완료`);
      } catch (error) {
        console.error(error);
        viewerNotificationPort.error(
          `파일 로딩 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        );
      } finally {
        event.target.value = "";
      }
    },
    [loadFile],
  );

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
    startCreateClippingPlane: () => {
      if (!hasLoadedModel) {
        return;
      }
      if (panelState.rightPanelCollapsed) {
        panelState.toggleRightPanel();
      }
      panelState.setRightPanelTab("editor");
      startCreateClippingPlane();
    },
    flipSelectedClippingPlane: () => {
      if (!selectedClippingPlane) return;
      flipClippingPlane(selectedClippingPlane.id);
    },
    deleteSelectedClippingPlane: () => {
      if (!selectedClippingPlane) return;
      deleteClippingPlane(selectedClippingPlane.id);
    },
    clearClippingPlanes,
    isolateEntities: visibilityState.isolateEntities,
    hideEntity: visibilityState.hideEntity,
    resetHiddenEntities: () => visibilityState.resetHiddenEntities(),
    clearSelection: selectionState.clearSelection,
    runViewportCommand: panelState.runViewportCommand,
    setActiveStoreyFilter,
    initEngine: async () => {
      await initEngine();
    },
    initEngineST: () => {
      void initEngine("single");
    },
    initEngineMT: () => {
      void initEngine("multi");
    },
    handleOpenFile,
    resetSession,
    setShortcutsOpen,
    ...exportActions,
  };

  const [leftPanelAction, rightPanelAction] = buildPanelActions(
    toolbarState,
    toolbarHandlers,
  );

  return {
    shortcutsOpen,
    setShortcutsOpen,
    fileInputRef,
    toolbarRef,
    handleFileChange,
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
    viewMenu: buildViewMenu(toolbarState, toolbarHandlers),
    engineMenu: buildEngineMenu(toolbarState, toolbarHandlers),
    floorplanMenu: buildFloorplanMenu(toolbarState, toolbarHandlers),
    classVisibilityMenu: buildClassVisibilityMenu(
      toolbarState,
      toolbarHandlers,
    ),
    measureMenu: buildMeasureMenu(toolbarState, toolbarHandlers),
    clippingMenu: buildClippingMenu(toolbarState, toolbarHandlers),
    exportMenu: buildExportMenu(toolbarState, toolbarHandlers),
  };
}
