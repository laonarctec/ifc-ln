import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useWebIfc } from "@/hooks/useWebIfc";
import { useViewportGeometry } from "@/services/viewportGeometryStore";
import { useViewerStore } from "@/stores";
import { addToast } from "@/components/ui/Toast";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { ThemeSwitch } from "./ThemeSwitch";
import { collectStoreys } from "./hierarchy/treeDataBuilder";
import {
  ToolbarActionButtons,
  ToolbarMenu,
  type TypeVisibilityKey,
} from "./mainToolbarPrimitives";
import { useToolbarExport } from "./toolbar/useToolbarExport";
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
  buildExportMenu,
  checkTypeGeometry,
  type ToolbarState,
  type ToolbarHandlers,
} from "./toolbar/toolbarConfigs";

export function MainToolbar() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const leftPanelCollapsed = useViewerStore((state) => state.leftPanelCollapsed);
  const rightPanelCollapsed = useViewerStore((state) => state.rightPanelCollapsed);
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const selectedEntityIds = useViewerStore((state) => state.selectedEntityIds);
  const viewportProjectionMode = useViewerStore((state) => state.viewportProjectionMode);
  const hoverTooltipsEnabled = useViewerStore((state) => state.hoverTooltipsEnabled);
  const edgesVisible = useViewerStore((state) => state.edgesVisible);
  const typeVisibility = useViewerStore((state) => state.typeVisibility);
  const interactionMode = useViewerStore((state) => state.interactionMode);
  const measurement = useViewerStore((state) => state.measurement);
  const trackedChanges = useViewerStore((state) => state.trackedChanges);
  const toggleLeftPanel = useViewerStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useViewerStore((state) => state.toggleRightPanel);
  const toggleViewportProjectionMode = useViewerStore((state) => state.toggleViewportProjectionMode);
  const toggleHoverTooltips = useViewerStore((state) => state.toggleHoverTooltips);
  const toggleEdgesVisible = useViewerStore((state) => state.toggleEdgesVisible);
  const toggleTypeVisibility = useViewerStore((state) => state.toggleTypeVisibility);
  const isolateEntities = useViewerStore((state) => state.isolateEntities);
  const hideEntity = useViewerStore((state) => state.hideEntity);
  const resetHiddenEntities = useViewerStore((state) => state.resetHiddenEntities);
  const clearSelection = useViewerStore((state) => state.clearSelection);
  const runViewportCommand = useViewerStore((state) => state.runViewportCommand);
  const setActiveStoreyFilter = useViewerStore((state) => state.setActiveStoreyFilter);
  const toggleMeasurementMode = useViewerStore((state) => state.toggleMeasurementMode);
  const clearMeasurement = useViewerStore((state) => state.clearMeasurement);
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
  const toolbarRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entityIds = useMemo(
    () => [...new Set(combinedManifest?.chunks.flatMap((chunk) => chunk.entityIds) ?? [])],
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
  const hasSelection = selectedEntityIds.length > 0;
  const hasSpatialTree = spatialTree.length > 0;

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

  const handleOpenFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    try {
      for (const file of files) {
        await loadFile(file);
      }
      addToast("success", `${files.length}개 IFC 로딩 완료`);
    } catch (error) {
      console.error(error);
      addToast("error", `파일 로딩 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      event.target.value = "";
    }
  };

  const exportHandlers = useToolbarExport({
    currentFileName,
    currentModelId,
    currentModelSchema,
    selectedEntityId,
    spatialTree,
    trackedChanges,
    loadedModels,
    hasSpatialTree,
    hasRenderableGeometry,
  });

  const state: ToolbarState = {
    leftPanelCollapsed,
    rightPanelCollapsed,
    viewportProjectionMode,
    hoverTooltipsEnabled,
    edgesVisible,
    typeVisibility,
    interactionMode,
    measurement,
    engineState,
    engineMessage,
    loading,
    hasRenderableGeometry,
    hasSelection,
    hasSpatialTree,
    selectedEntityId,
    selectedEntityIds,
    currentModelId,
    currentFileName,
    trackedChanges,
    typeGeometryExists,
    storeys,
  };

  const handlers: ToolbarHandlers = {
    toggleLeftPanel,
    toggleRightPanel,
    toggleViewportProjectionMode,
    toggleHoverTooltips,
    toggleEdgesVisible,
    toggleTypeVisibility,
    toggleMeasurementMode,
    clearMeasurement,
    isolateEntities,
    hideEntity,
    resetHiddenEntities,
    clearSelection,
    runViewportCommand,
    setActiveStoreyFilter,
    initEngine,
    handleOpenFile,
    resetSession,
    setShortcutsOpen,
    ...exportHandlers,
  };

  const panelActions = buildPanelActions(state, handlers);
  const [leftPanelAction, rightPanelAction] = panelActions;
  const fileActions = buildFileActions(state, handlers);
  const visibilityActions = buildVisibilityActions(state, handlers, entityIds);
  const cameraActions = buildCameraActions(state, handlers);
  const utilityActions = buildUtilityActions(handlers);
  const viewMenu = buildViewMenu(state, handlers);
  const floorplanMenu = buildFloorplanMenu(state, handlers);
  const classVisibilityMenu = buildClassVisibilityMenu(state, handlers);
  const measureMenu = buildMeasureMenu(state, handlers);
  const exportMenu = buildExportMenu(state, handlers);

  return (
    <header ref={toolbarRef} className="toolbar">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc,.ifcz,.ifcb"
        multiple
        className="viewer-hidden-input"
        onChange={(event) => { void handleFileChange(event); }}
      />

      <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-3 overflow-visible">
        {leftPanelAction ? (
          <>
            <div className="toolbar-group shrink-0">
              <ToolbarActionButtons actions={[leftPanelAction]} />
            </div>
            <span className="toolbar-sep" />
          </>
        ) : null}

        <div className="toolbar-group">
          <ToolbarActionButtons actions={fileActions} />
        </div>

        <span className="toolbar-sep" />

        <div className="toolbar-group">
          <ToolbarActionButtons actions={visibilityActions} />
        </div>

        <span className="toolbar-sep" />

        <div className="toolbar-group">
          <ToolbarActionButtons actions={cameraActions} />
          <ToolbarMenu menu={viewMenu} />
          <ToolbarMenu menu={measureMenu} />
          {floorplanMenu ? <ToolbarMenu menu={floorplanMenu} /> : null}
          {classVisibilityMenu ? <ToolbarMenu menu={classVisibilityMenu} /> : null}
        </div>

        <span className="toolbar-sep" />

        <div className="toolbar-group">
          <ToolbarMenu menu={exportMenu} />
          <ToolbarActionButtons actions={utilityActions} />
          <ThemeSwitch />
        </div>

        {rightPanelAction ? (
          <>
            <span className="toolbar-sep" />
            <div className="toolbar-group shrink-0">
              <ToolbarActionButtons actions={[rightPanelAction]} />
            </div>
          </>
        ) : null}
      </div>

      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </header>
  );
}
