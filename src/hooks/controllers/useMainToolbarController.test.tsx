import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadFile = vi.fn();
const resetSession = vi.fn();
const initEngine = vi.fn();
const notificationSpies = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

const storeState = {
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  viewportProjectionMode: "perspective" as const,
  viewportCommand: { type: "none" as const, seq: 0 },
  theme: "light" as const,
  hoverTooltipsEnabled: true,
  edgesVisible: true,
  autoStoreyTracking: false,
  setLeftPanelCollapsed: vi.fn(),
  setRightPanelCollapsed: vi.fn(),
  toggleLeftPanel: vi.fn(),
  toggleRightPanel: vi.fn(),
  setViewportProjectionMode: vi.fn(),
  toggleViewportProjectionMode: vi.fn(),
  runViewportCommand: vi.fn(),
  toggleTheme: vi.fn(),
  toggleHoverTooltips: vi.fn(),
  toggleEdgesVisible: vi.fn(),
  toggleAutoStoreyTracking: vi.fn(),
  selectedModelId: 7,
  selectedEntityId: 101,
  selectedEntityIds: [101],
  setSelectedEntity: vi.fn(),
  setSelectedEntities: vi.fn(),
  setSelectedEntityId: vi.fn(),
  setSelectedEntityIds: vi.fn(),
  clearSelection: vi.fn(),
  hiddenEntityKeys: new Set<string>(),
  isolatedEntityKeys: null as Set<string> | null,
  typeVisibility: { spaces: true, openings: true, site: true },
  activeTypeToggles: new Set<string>(),
  hideEntity: vi.fn(),
  showEntity: vi.fn(),
  isolateEntity: vi.fn(),
  isolateEntities: vi.fn(),
  setIsolation: vi.fn(),
  clearIsolation: vi.fn(),
  resetHiddenEntities: vi.fn(),
  toggleTypeVisibility: vi.fn(),
  toggleIfcTypeFilter: vi.fn(),
  clearIfcTypeFilters: vi.fn(),
  interactionMode: "idle",
  measurement: { mode: "distance", distance: null as number | null },
  trackedChanges: [] as Array<{ modelId: number }>,
  toggleMeasurementMode: vi.fn(),
  clearMeasurement: vi.fn(),
  setActiveStoreyFilter: vi.fn(),
};

const webIfcState = {
  loading: false,
  engineState: "idle" as "idle" | "initializing" | "ready" | "error",
  engineMessage: "idle",
  loadedModels: [] as Array<{
    fileName: string;
    modelId: number;
    schema: string;
    visible: boolean;
  }>,
  currentFileName: null as string | null,
  currentModelId: null as number | null,
  currentModelSchema: null as string | null,
  spatialTree: [] as Array<{ type: string }>,
};

vi.mock("@/stores", () => ({
  useViewerStore: (selector: (state: typeof storeState) => unknown) =>
    selector(storeState),
}));

vi.mock("@/hooks/useWebIfc", () => ({
  useWebIfc: () => ({
    loadFile,
    resetSession,
    initEngine,
    ...webIfcState,
  }),
}));

vi.mock("@/services/viewportGeometryStore", () => ({
  useViewportGeometry: () => ({
    combinedManifest: {
      chunks: [{ entityIds: [101, 102] }],
    },
  }),
}));

vi.mock("./useToolbarExportActions", () => ({
  useToolbarExportActions: () => ({
    handleScreenshot: vi.fn(),
    handleExportJSON: vi.fn(),
    handleExportSpatialCSV: vi.fn(),
    handleExportPropertiesCSV: vi.fn(),
    handleExportActiveIfc: vi.fn(),
    handleExportChangedModels: vi.fn(),
    handleExportIfcb: vi.fn(),
  }),
}));

vi.mock("./viewerPorts", () => ({
  viewerNotificationPort: {
    success: notificationSpies.success,
    error: notificationSpies.error,
    info: notificationSpies.info,
  },
}));

import { useMainToolbarController } from "./useMainToolbarController";

describe("useMainToolbarController", () => {
  beforeEach(() => {
    loadFile.mockReset();
    resetSession.mockReset();
    initEngine.mockReset();
    notificationSpies.success.mockReset();
    notificationSpies.error.mockReset();
    notificationSpies.info.mockReset();
    webIfcState.engineState = "idle";
  });

  it("disables file open action until the engine is ready", () => {
    const { result } = renderHook(() => useMainToolbarController());

    expect(result.current.fileActions[0]?.disabled).toBe(true);
  });

  it("loads selected files and emits a success notification", async () => {
    webIfcState.engineState = "ready";
    loadFile.mockResolvedValue(undefined);
    const { result } = renderHook(() => useMainToolbarController());
    const event = {
      target: {
        files: [new File(["a"], "a.ifc"), new File(["b"], "b.ifc")],
        value: "filled",
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleFileChange(event);
    });

    expect(loadFile).toHaveBeenCalledTimes(2);
    expect(notificationSpies.success).toHaveBeenCalledWith("2개 IFC 로딩 완료");
    expect(event.target.value).toBe("");
  });
});
