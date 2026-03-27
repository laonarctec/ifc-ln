import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadPropertySections = vi.fn();
const hideEntity = vi.fn();
const resetHiddenEntities = vi.fn();
const setModelVisibility = vi.fn();
const closeModel = vi.fn();
const setRightPanelTab = vi.fn();
const startCreateClippingPlane = vi.fn();
const cancelClippingDraft = vi.fn();
const selectClippingPlane = vi.fn();
const renameClippingPlane = vi.fn();
const toggleClippingPlaneEnabled = vi.fn();
const toggleClippingPlaneLocked = vi.fn();
const flipClippingPlane = vi.fn();
const deleteClippingPlane = vi.fn();
const clearClippingPlanes = vi.fn();
const propertyActions = {
  applyEntryChange: vi.fn(),
  revertChange: vi.fn(),
};

const storeState = {
  rightPanelTab: "properties" as const,
  setRightPanelTab,
  interactionMode: "idle",
  measurement: {
    distance: null as number | null,
  },
  trackedChanges: [
    {
      modelId: 7,
      entityExpressId: 101,
      sectionKind: "attributes",
      sectionTitle: "Attributes",
      entryKey: "Name",
      target: {
        lineExpressId: 101,
        attributeName: "Name",
      },
      valueType: "string",
      originalValue: "Old",
      currentValue: "New",
      updatedAt: "2026-03-27T01:00:00.000Z",
    },
  ],
  upsertTrackedChange: vi.fn(),
  removeTrackedChange: vi.fn(),
  setActiveModelId: vi.fn(),
  mergeSelectedProperties: vi.fn(),
  clipping: {
    mode: "idle" as const,
    planes: [],
    activePlaneId: null as string | null,
    draft: null,
    nextPlaneSerial: 1,
  },
  startCreateClippingPlane,
  cancelClippingDraft,
  selectClippingPlane,
  renameClippingPlane,
  toggleClippingPlaneEnabled,
  toggleClippingPlaneLocked,
  flipClippingPlane,
  deleteClippingPlane,
  clearClippingPlanes,
};

vi.mock("@/stores", () => ({
  useViewerStore: (
    selector: (state: typeof storeState) => unknown,
  ) => selector(storeState),
}));

vi.mock("@/hooks/useWebIfc", () => ({
  useWebIfc: () => ({
    loadedModels: [
      {
        fileName: "sample.ifc",
        modelId: 7,
        schema: "IFC4",
        visible: true,
      },
    ],
    activeModelId: 7,
    setModelVisibility,
    closeModel,
  }),
}));

vi.mock("@/hooks/useGeometryMetrics", () => ({
  useGeometryMetrics: () => ({
    primary: null,
    aggregate: null,
    entityCount: 1,
  }),
}));

vi.mock("@/components/viewer/properties/usePropertiesPanelData", () => ({
  usePropertiesPanelData: () => ({
    currentFileName: "sample.ifc",
    currentModelId: 7,
    currentModelSchema: "IFC4",
    currentModelMaxExpressId: 999,
    selectedEntityId: 101,
    selectedEntityIds: [101, 102],
    hideEntity,
    hiddenEntityIds: new Set<number>([500]),
    resetHiddenEntities,
    properties: {
      globalId: "gid",
      ifcType: "IFCWALL",
      name: "Wall",
      attributes: [],
      propertySets: [],
      typeProperties: [],
      materials: [],
      documents: [],
      classifications: [],
      metadata: [],
      relations: [],
      inverseRelations: [],
      quantitySets: [],
      loadedSections: [],
    },
    propertiesLoading: false,
    propertiesError: null,
    propertiesLoadingSections: [],
    loadPropertySections,
  }),
}));

vi.mock("./usePropertyMutationActions", () => ({
  usePropertyMutationActions: () => propertyActions,
}));

import { usePropertiesController } from "./usePropertiesController";

describe("usePropertiesController", () => {
  beforeEach(() => {
    loadPropertySections.mockReset();
    hideEntity.mockReset();
    resetHiddenEntities.mockReset();
    setModelVisibility.mockReset();
    closeModel.mockReset();
    setRightPanelTab.mockReset();
    startCreateClippingPlane.mockReset();
    cancelClippingDraft.mockReset();
    selectClippingPlane.mockReset();
    renameClippingPlane.mockReset();
    toggleClippingPlaneEnabled.mockReset();
    toggleClippingPlaneLocked.mockReset();
    flipClippingPlane.mockReset();
    deleteClippingPlane.mockReset();
    clearClippingPlanes.mockReset();
  });

  it("loads property sections for the active tab", async () => {
    const { result } = renderHook(() => usePropertiesController());

    await waitFor(() => {
      expect(loadPropertySections).toHaveBeenCalledWith([
        "propertySets",
        "typeProperties",
        "materials",
        "documents",
        "classifications",
        "metadata",
        "relations",
        "inverseRelations",
      ]);
    });

    act(() => {
      result.current.setActiveTab("quantities");
    });

    await waitFor(() => {
      expect(loadPropertySections).toHaveBeenLastCalledWith(["quantitySets"]);
    });
    expect(setRightPanelTab).toHaveBeenCalledWith("quantities");
  });

  it("routes hide/reset/model actions through the controller handlers", async () => {
    const { result } = renderHook(() => usePropertiesController());

    act(() => {
      result.current.handleHideSelectedEntities();
      result.current.handleResetHiddenEntities();
      result.current.handleSetModelVisibility(7, false);
      result.current.handleFocusModel(7);
    });

    expect(hideEntity).toHaveBeenCalledTimes(2);
    expect(resetHiddenEntities).toHaveBeenCalledWith(7);
    expect(setModelVisibility).toHaveBeenCalledWith(7, false);
    expect(storeState.setActiveModelId).toHaveBeenCalledWith(7);

    await act(async () => {
      await result.current.handleCloseModel(7);
    });

    expect(closeModel).toHaveBeenCalledWith(7);
  });

  it("routes clipping editor actions through the controller handlers", () => {
    const { result } = renderHook(() => usePropertiesController());

    act(() => {
      result.current.handleStartCreateClippingPlane();
      result.current.handleCancelCreateClippingPlane();
      result.current.handleSelectClippingPlane("clipping-plane-1");
      result.current.handleRenameClippingPlane("clipping-plane-1", "Section A");
      result.current.handleToggleClippingPlaneEnabled("clipping-plane-1");
      result.current.handleToggleClippingPlaneLocked("clipping-plane-1");
      result.current.handleFlipClippingPlane("clipping-plane-1");
      result.current.handleDeleteClippingPlane("clipping-plane-1");
      result.current.handleClearClippingPlanes();
    });

    expect(setRightPanelTab).toHaveBeenCalledWith("editor");
    expect(startCreateClippingPlane).toHaveBeenCalled();
    expect(cancelClippingDraft).toHaveBeenCalled();
    expect(selectClippingPlane).toHaveBeenCalledWith("clipping-plane-1");
    expect(renameClippingPlane).toHaveBeenCalledWith("clipping-plane-1", "Section A");
    expect(toggleClippingPlaneEnabled).toHaveBeenCalledWith("clipping-plane-1");
    expect(toggleClippingPlaneLocked).toHaveBeenCalledWith("clipping-plane-1");
    expect(flipClippingPlane).toHaveBeenCalledWith("clipping-plane-1");
    expect(deleteClippingPlane).toHaveBeenCalledWith("clipping-plane-1");
    expect(clearClippingPlanes).toHaveBeenCalled();
  });
});
