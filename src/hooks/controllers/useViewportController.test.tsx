import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createModelEntityKey } from "@/utils/modelEntity";

const storeState = {
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  leftPanelTab: "hierarchy" as const,
  rightPanelTab: "properties" as const,
  viewportProjectionMode: "perspective" as const,
  viewportCommand: { type: "none" as const, seq: 0 },
  theme: "light" as const,
  hoverTooltipsEnabled: true,
  edgesVisible: true,
  autoStoreyTracking: false,
  setLeftPanelCollapsed: vi.fn(),
  setRightPanelCollapsed: vi.fn(),
  setLeftPanelTab: vi.fn(),
  setRightPanelTab: vi.fn(),
  toggleLeftPanel: vi.fn(),
  toggleRightPanel: vi.fn(),
  setViewportProjectionMode: vi.fn(),
  toggleViewportProjectionMode: vi.fn(),
  runViewportCommand: vi.fn(),
  toggleTheme: vi.fn(),
  toggleHoverTooltips: vi.fn(),
  toggleEdgesVisible: vi.fn(),
  toggleAutoStoreyTracking: vi.fn(),
  selectedModelId: 7 as number | null,
  selectedEntityId: 101 as number | null,
  selectedEntityIds: [101, 102],
  setSelectedEntity: vi.fn(),
  setSelectedEntities: vi.fn(),
  setSelectedEntityId: vi.fn(),
  setSelectedEntityIds: vi.fn(),
  clearSelection: vi.fn(),
  hiddenEntityKeys: new Set<string>([createModelEntityKey(7, 999)]),
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
};

const webIfcState = {
  loading: false,
  progress: "idle",
  error: null as string | null,
  engineState: "ready" as const,
  engineMessage: "ready",
  currentFileName: "sample.ifc",
  currentModelId: 7,
  loadedModels: [
    {
      fileName: "sample.ifc",
      modelId: 7,
      schema: "IFC4",
      maxExpressId: 999,
      geometryReady: true,
      geometryMeshCount: 1,
      geometryVertexCount: 3,
      geometryIndexCount: 3,
      spatialTree: [],
      typeTree: [],
      visible: true,
    },
  ],
  activeModelId: 7,
  setActiveModelId: vi.fn(),
  spatialTree: [],
  activeClassFilter: null as string | null,
  activeTypeFilter: null as string | null,
  activeStoreyFilter: null as number | null,
};

const geometryState = {
  modelsById: {
    7: {
      manifest: {
        modelId: 7,
        meshCount: 0,
        vertexCount: 0,
        indexCount: 0,
        chunkCount: 1,
        modelBounds: [0, 0, 0, 1, 1, 1] as [number, number, number, number, number, number],
        initialChunkIds: [],
        chunks: [
          {
            chunkId: 1,
            modelId: 7,
            storeyId: null,
            entityIds: [101, 102, 103],
            ifcTypes: [],
            meshCount: 0,
            vertexCount: 0,
            indexCount: 0,
            bounds: [0, 0, 0, 1, 1, 1] as [number, number, number, number, number, number],
          },
        ],
      },
      residentChunkIds: [1],
      visibleChunkIds: [1],
      chunksById: {
        1: {
          modelId: 7,
          chunkId: 1,
          storeyId: null,
          entityIds: [101, 102, 103],
          ifcTypes: [],
          meshes: [],
        },
      },
    },
    9: {
      manifest: {
        modelId: 9,
        meshCount: 0,
        vertexCount: 0,
        indexCount: 0,
        chunkCount: 1,
        modelBounds: [0, 0, 0, 1, 1, 1] as [number, number, number, number, number, number],
        initialChunkIds: [],
        chunks: [
          {
            chunkId: 1,
            modelId: 9,
            storeyId: null,
            entityIds: [301, 302],
            ifcTypes: [],
            meshCount: 0,
            vertexCount: 0,
            indexCount: 0,
            bounds: [0, 0, 0, 1, 1, 1] as [number, number, number, number, number, number],
          },
        ],
      },
      residentChunkIds: [1],
      visibleChunkIds: [1],
      chunksById: {
        1: {
          modelId: 9,
          chunkId: 1,
          storeyId: null,
          entityIds: [301, 302],
          ifcTypes: [],
          meshes: [],
        },
      },
    },
  },
  version: 3,
};

vi.mock("@/stores", () => ({
  useViewerStore: (selector: (state: typeof storeState) => unknown) =>
    selector(storeState),
}));

vi.mock("@/hooks/useWebIfc", () => ({
  useWebIfc: () => webIfcState,
}));

vi.mock("@/hooks/useChunkResidency", () => ({
  useChunkResidency: vi.fn(),
}));

vi.mock("@/hooks/useLensEffects", () => ({
  useLensEffects: () => ({
    hiddenKeys: new Set<string>([createModelEntityKey(7, 555)]),
    colorOverrides: new Map(),
  }),
}));

vi.mock("@/hooks/useViewportEntityFilters", () => ({
  useViewportEntityFilters: () => ({
    entitySummaries: new Map([
      [101, { expressId: 101, ifcType: "IFCWALL", name: "Wall", label: "Wall" }],
    ]),
    effectiveHiddenIdSet: new Set<number>(),
    effectiveHiddenKeys: new Set<string>([createModelEntityKey(7, 777)]),
  }),
}));

vi.mock("@/services/viewportGeometryStore", () => ({
  combineManifests: (manifests: Array<{ chunks: unknown[]; modelBounds: [number, number, number, number, number, number] }>) =>
    manifests.length === 0
      ? null
      : {
          modelId: -1,
          meshCount: 0,
          vertexCount: 0,
          indexCount: 0,
          chunkCount: manifests.length,
          modelBounds: manifests[0].modelBounds,
          initialChunkIds: [],
          chunks: manifests.flatMap((manifest) => manifest.chunks),
        },
  useViewportGeometry: () => geometryState,
  viewportGeometryStore: {
    setVisibleChunkIds: vi.fn(),
  },
}));

import { useViewportController } from "./useViewportController";

describe("useViewportController", () => {
  beforeEach(() => {
    storeState.setSelectedEntity.mockReset();
    storeState.setSelectedEntities.mockReset();
    storeState.clearSelection.mockReset();
    storeState.resetHiddenEntities.mockReset();
    storeState.hideEntity.mockReset();
    storeState.isolateEntities.mockReset();
    webIfcState.setActiveModelId.mockReset();
    storeState.selectedModelId = 7;
    storeState.selectedEntityIds = [101, 102];
  });

  it("uses the current selection when opening a context menu", () => {
    const { result } = renderHook(() => useViewportController());

    act(() => {
      result.current.handleContextMenu(9, 301, { x: 10, y: 20 });
    });

    expect(result.current.contextMenu).toEqual({
      modelId: 7,
      entityIds: [101, 102],
      x: 10,
      y: 20,
    });
  });

  it("shows all entities for the context menu model when it differs from the active model", () => {
    storeState.selectedModelId = null;
    storeState.selectedEntityIds = [];
    const { result } = renderHook(() => useViewportController());

    act(() => {
      result.current.handleContextMenu(9, 301, { x: 5, y: 6 });
    });

    act(() => {
      result.current.handleContextMenuShowAll();
    });

    expect(storeState.resetHiddenEntities).toHaveBeenCalledWith(9);
  });
});
