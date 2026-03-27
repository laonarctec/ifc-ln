import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadPropertySections = vi.fn();
const hideEntity = vi.fn();
const resetHiddenEntities = vi.fn();
const setModelVisibility = vi.fn();
const closeModel = vi.fn();
const propertyActions = {
  applyEntryChange: vi.fn(),
  revertChange: vi.fn(),
};

const storeState = {
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
});
