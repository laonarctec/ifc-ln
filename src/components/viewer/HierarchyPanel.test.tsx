import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 36,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        size: 36,
        start: index * 36,
      })),
  }),
}));

vi.mock("./hierarchy/HierarchyNode", () => ({
  HierarchyNode: ({ node }: { node: { id: string } }) => (
    <div data-testid="hierarchy-node">{node.id}</div>
  ),
}));

vi.mock("./hierarchy/TreeContextMenu", () => ({
  TreeContextMenu: () => null,
}));

vi.mock("./hierarchy/treeDataBuilder", () => ({
  formatIfcType: (value: string) => value,
}));

vi.mock("@/hooks/useHierarchyController", async () => {
  const React = await import("react");

  return {
    useHierarchyController: () => {
      const [groupingMode, setGroupingMode] = React.useState<
        "spatial" | "class" | "type"
      >("spatial");
      const [leftPanelTab, setLeftPanelTab] = React.useState<
        "hierarchy" | "editor"
      >("hierarchy");

      return {
        leftPanelTab,
        setLeftPanelTab,
        groupingMode,
        setGroupingMode,
        filteredSpatialNodes:
          groupingMode === "spatial" ? [{ expressID: 1 }] : [],
        treeNodes: [],
        selectedEntityId: null,
        treeContextMenu: null,
        closeTreeContextMenu: vi.fn(),
        searchQuery: "",
        setSearchQuery: vi.fn(),
        activeStoreyFilter: null,
        activeStoreyLabel: null,
        activeStoreyEntityIds: [],
        clearStoreyFilter: vi.fn(),
        handleStoreyScopeSelect: vi.fn(),
        handleStoreyScopeIsolate: vi.fn(),
        hiddenEntityIds: new Set<number>(),
        selectedEntityIdSet: new Set<number>(),
        selectedSpatialNodeIds: new Set<number>(),
        handleNodeClick: vi.fn(),
        toggleExpand: vi.fn(),
        handleVisibilityToggle: vi.fn(),
        handleGroupIsolate: vi.fn(),
        handleEntityFocus: vi.fn(),
        handleResetGroupView: vi.fn(),
        handleTreeContextMenu: vi.fn(),
        activeClassFilter: null,
        activeTypeFilter: null,
        setActiveClassFilter: vi.fn(),
        setActiveTypeFilter: vi.fn(),
        clearSemanticFilters: vi.fn(),
        clipping: {
          mode: "idle",
          planes: [],
          activePlaneId: null,
          draft: null,
          nextPlaneSerial: 1,
        },
        filteredClippingPlanes: [],
        selectedClippingPlane: null,
        handleCreateClippingPlane: vi.fn(),
        handleSelectClippingPlane: vi.fn(),
        handleRenameClippingPlane: vi.fn(),
        handleToggleClippingPlaneEnabled: vi.fn(),
        handleToggleClippingPlaneLocked: vi.fn(),
        handleFlipClippingPlane: vi.fn(),
        handleDeleteClippingPlane: vi.fn(),
        handleClearClippingPlanes: vi.fn(),
        handleCtxSelect: vi.fn(),
        handleCtxHide: vi.fn(),
        handleCtxShow: vi.fn(),
        handleCtxFocus: vi.fn(),
      };
    },
  };
});

import { HierarchyPanel } from "./HierarchyPanel";

describe("HierarchyPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("updates grouping mode UI when the segmented control changes", async () => {
    const user = userEvent.setup();

    render(<HierarchyPanel />);

    expect(
      screen.getByPlaceholderText("Search hierarchy..."),
    ).toBeTruthy();
    expect(screen.getByText("Spatial tree synced")).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: "Class" }));

    expect(screen.getByRole("radio", { name: "Class" }).getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByPlaceholderText("Search classes or entities..."),
    ).toBeTruthy();
    expect(screen.getByText("표시할 클래스가 없습니다.")).toBeTruthy();
    expect(screen.getByText("By IFC class")).toBeTruthy();
  });
});
