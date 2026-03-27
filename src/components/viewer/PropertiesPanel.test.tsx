import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const webIfcState = {
  loadedModels: [] as Array<{
    fileName: string;
    modelId: number;
    schema: string;
    visible: boolean;
  }>,
  activeModelId: null as number | null,
};

const storeState = {
  rightPanelTab: "properties" as "properties" | "quantities" | "editor",
  setRightPanelTab,
  interactionMode: "idle",
  measurement: {
    distance: null as number | null,
  },
  trackedChanges: [] as Array<unknown>,
  upsertTrackedChange: vi.fn(),
  removeTrackedChange: vi.fn(),
  setActiveModelId: vi.fn(),
  mergeSelectedProperties: vi.fn(),
  clipping: {
    mode: "idle" as const,
    planes: [] as Array<{
      id: string;
      name: string;
      enabled: boolean;
      locked: boolean;
      selected: boolean;
      origin: [number, number, number];
      normal: [number, number, number];
      uAxis: [number, number, number];
      vAxis: [number, number, number];
      width: number;
      height: number;
      flipped: boolean;
      labelVisible: boolean;
    }>,
    activePlaneId: null as string | null,
    draft: null,
    interaction: {
      planeId: null as string | null,
      kind: null as "move" | "rotate" | "resize" | null,
      dragging: false,
    },
    nextPlaneSerial: 1,
  },
  startCreateClippingPlane,
  beginClippingInteraction: vi.fn(),
  endClippingInteraction: vi.fn(),
  cancelClippingDraft,
  selectClippingPlane,
  renameClippingPlane,
  toggleClippingPlaneEnabled,
  toggleClippingPlaneLocked,
  flipClippingPlane,
  deleteClippingPlane,
  clearClippingPlanes,
};

vi.mock("@/services/IfcWorkerClient", () => ({
  ifcWorkerClient: {
    updatePropertyValue: vi.fn(),
  },
}));

vi.mock("@/stores", () => ({
  useViewerStore: (
    selector: (state: typeof storeState) => unknown,
  ) => selector(storeState),
}));

vi.mock("@/components/ui/Toast", () => ({
  addToast: vi.fn(),
}));

vi.mock("@/hooks/useGeometryMetrics", () => ({
  useGeometryMetrics: () => ({
    primary: null,
    aggregate: null,
    entityCount: 0,
  }),
}));

vi.mock("@/hooks/useWebIfc", () => ({
  useWebIfc: () => ({
    ...webIfcState,
    setModelVisibility,
    closeModel,
  }),
}));

vi.mock("./properties/EditableEntryRow", () => ({
  EditableEntryRow: () => null,
}));

vi.mock("./properties/LensRulesCard", () => ({
  LensRulesCard: () => <div>Lens rules</div>,
}));

vi.mock("./properties/PropertySectionList", () => ({
  PropertySectionList: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("./properties/usePropertiesPanelData", () => ({
  usePropertiesPanelData: () => ({
    currentFileName: null,
    currentModelId: null,
    currentModelSchema: null,
    currentModelMaxExpressId: null,
    selectedEntityId: null,
    selectedEntityIds: [],
    hideEntity,
    hiddenEntityIds: new Set<number>(),
    resetHiddenEntities,
    properties: {
      globalId: null,
      ifcType: null,
      name: null,
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
    },
    propertiesLoading: false,
    propertiesError: null,
    propertiesLoadingSections: [],
    loadPropertySections,
  }),
}));

import { PropertiesPanel } from "./PropertiesPanel";

describe("PropertiesPanel", () => {
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
    webIfcState.loadedModels = [];
    webIfcState.activeModelId = null;
    storeState.upsertTrackedChange.mockReset();
    storeState.removeTrackedChange.mockReset();
    storeState.setActiveModelId.mockReset();
    storeState.mergeSelectedProperties.mockReset();
    storeState.rightPanelTab = "properties";
    storeState.clipping = {
      mode: "idle",
      planes: [],
      activePlaneId: null,
      draft: null,
      interaction: {
        planeId: null,
        kind: null,
        dragging: false,
      },
      nextPlaneSerial: 1,
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the property and quantity loading branches wired to the segmented control", async () => {
    const user = userEvent.setup();

    render(<PropertiesPanel />);

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

    await user.click(screen.getByRole("radio", { name: "Quantities" }));

    await waitFor(() => {
      expect(loadPropertySections).toHaveBeenLastCalledWith(["quantitySets"]);
    });
    expect(screen.getByRole("radio", { name: "Quantities" }).getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByText("기본 메타 정보는 속성 탭에서 확인할 수 있습니다."),
    ).toBeTruthy();
    const editorTab = screen.getAllByRole("radio")[2];
    expect(editorTab?.getAttribute("disabled")).not.toBeNull();
  });

  it("renders clipping controls in the right-side editor tab", async () => {
    const user = userEvent.setup();
    webIfcState.loadedModels = [
      {
        fileName: "sample.ifc",
        modelId: 7,
        schema: "IFC4",
        visible: true,
      },
    ];
    webIfcState.activeModelId = 7;
    storeState.rightPanelTab = "editor";
    storeState.clipping = {
      mode: "idle",
      planes: [
        {
          id: "clipping-plane-1",
          name: "Section 01",
          enabled: true,
          locked: false,
          selected: true,
          origin: [1, 2, 3],
          normal: [0, 0, 1],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0],
          width: 4,
          height: 2,
          flipped: false,
          labelVisible: true,
        },
      ],
      activePlaneId: "clipping-plane-1",
      draft: null,
      interaction: {
        planeId: null,
        kind: null,
        dragging: false,
      },
      nextPlaneSerial: 2,
    };

    render(<PropertiesPanel />);

    expect(screen.getByText("Clipping Editor")).toBeTruthy();
    expect(screen.getAllByText("Section 01").length).toBeGreaterThan(0);
    expect(screen.getByText("Selected Plane")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "절단 방향 반전" }));
    expect(flipClippingPlane).toHaveBeenCalledWith("clipping-plane-1");
  });
});
