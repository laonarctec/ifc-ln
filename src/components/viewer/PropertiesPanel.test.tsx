import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadPropertySections = vi.fn();
const hideEntity = vi.fn();
const resetHiddenEntities = vi.fn();
const setModelVisibility = vi.fn();
const closeModel = vi.fn();

const storeState = {
  interactionMode: "idle",
  measurement: {
    distance: null as number | null,
  },
  trackedChanges: [] as Array<unknown>,
  upsertTrackedChange: vi.fn(),
  removeTrackedChange: vi.fn(),
  setActiveModelId: vi.fn(),
  mergeSelectedProperties: vi.fn(),
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
    loadedModels: [],
    activeModelId: null,
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
    storeState.upsertTrackedChange.mockReset();
    storeState.removeTrackedChange.mockReset();
    storeState.setActiveModelId.mockReset();
    storeState.mergeSelectedProperties.mockReset();
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
  });
});
