import { describe, expect, it } from "vitest";
import { createModelEntityKey } from "@/utils/modelEntity";
import {
  buildCombinedHiddenKeys,
  buildSelectedEntityKeys,
  collectManifestEntityIds,
  filterVisibleSelectedIds,
  resolveBoxSelectionChange,
  resolveContextMenuShowAllTarget,
  resolveViewportEmptyState,
} from "./viewportControllerUtils";

describe("viewportControllerUtils", () => {
  it("builds selected entity keys only when a model is selected", () => {
    expect(buildSelectedEntityKeys(null, [1, 2]).size).toBe(0);
    expect(buildSelectedEntityKeys(7, [101, 102])).toEqual(
      new Set([
        createModelEntityKey(7, 101),
        createModelEntityKey(7, 102),
      ]),
    );
  });

  it("combines hidden key sets without duplicates", () => {
    const a = createModelEntityKey(7, 101);
    const b = createModelEntityKey(7, 102);
    expect(
      buildCombinedHiddenKeys(new Set([a]), new Set([a, b])),
    ).toEqual(new Set([a, b]));
  });

  it("filters hidden ids out of the current selection", () => {
    expect(filterVisibleSelectedIds([1, 2, 3], new Set([2]))).toEqual([1, 3]);
  });

  it("resolves viewport empty states by priority", () => {
    expect(
      resolveViewportEmptyState({
        error: "boom",
        loading: true,
        progress: "loading",
        engineState: "error",
        engineMessage: "bad",
        currentFileName: null,
        loadedModelCount: 0,
      }).tone,
    ).toBe("error");

    expect(
      resolveViewportEmptyState({
        error: null,
        loading: true,
        progress: "loading",
        engineState: "ready",
        engineMessage: "ready",
        currentFileName: null,
        loadedModelCount: 0,
      }).tone,
    ).toBe("loading");
  });

  it("uses context menu model as the show-all target when present", () => {
    expect(
      resolveContextMenuShowAllTarget(
        { modelId: 9, entityIds: [301], x: 1, y: 2 },
        7,
      ),
    ).toBe(9);
    expect(resolveContextMenuShowAllTarget(null, 7)).toBe(7);
  });

  it("collects unique entity ids from a manifest", () => {
    expect(
      collectManifestEntityIds({
        modelId: 1,
        meshCount: 0,
        vertexCount: 0,
        indexCount: 0,
        chunkCount: 2,
        modelBounds: [0, 0, 0, 1, 1, 1],
        initialChunkIds: [],
        chunks: [
          { chunkId: 1, modelId: 1, storeyId: null, entityIds: [1, 2], ifcTypes: [], meshCount: 0, vertexCount: 0, indexCount: 0, bounds: [0, 0, 0, 1, 1, 1] },
          { chunkId: 2, modelId: 1, storeyId: null, entityIds: [2, 3], ifcTypes: [], meshCount: 0, vertexCount: 0, indexCount: 0, bounds: [0, 0, 0, 1, 1, 1] },
        ],
      }),
    ).toEqual([1, 2, 3]);
  });

  it("resolves box selection changes for clear, replace, and additive flows", () => {
    expect(resolveBoxSelectionChange([], false, 7, [1])).toEqual({
      kind: "clear",
    });
    expect(resolveBoxSelectionChange([], true, 7, [1])).toEqual({
      kind: "ignore",
    });
    expect(
      resolveBoxSelectionChange(
        [
          { modelId: 7, expressId: 10 },
          { modelId: 8, expressId: 99 },
          { modelId: 7, expressId: 11 },
        ],
        false,
        7,
        [1],
      ),
    ).toEqual({
      kind: "select",
      modelId: 7,
      expressIds: [10, 11],
    });
    expect(
      resolveBoxSelectionChange(
        [{ modelId: 7, expressId: 11 }],
        true,
        7,
        [10],
      ),
    ).toEqual({
      kind: "select",
      modelId: 7,
      expressIds: [10, 11],
    });
  });
});
