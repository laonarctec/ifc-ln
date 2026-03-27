import { describe, expect, it } from "vitest";
import { combineManifests } from "./viewportGeometryStore";
import type { RenderManifest } from "@/types/worker-messages";

function makeManifest(overrides: Partial<RenderManifest> = {}): RenderManifest {
  return {
    modelId: 1,
    meshCount: 10,
    vertexCount: 100,
    indexCount: 300,
    chunkCount: 1,
    modelBounds: [0, 0, 0, 1, 1, 1],
    initialChunkIds: [0],
    chunks: [{ modelId: 1, chunkId: 0, storeyId: null, entityIds: [1, 2], ifcTypes: [], meshCount: 5, vertexCount: 50, indexCount: 150, bounds: [0, 0, 0, 1, 1, 1] }],
    ...overrides,
  };
}

describe("combineManifests", () => {
  it("returns null for empty array", () => {
    expect(combineManifests([])).toBeNull();
  });

  it("returns single manifest as-is (wrapped)", () => {
    const manifest = makeManifest();
    const result = combineManifests([manifest]);
    expect(result).not.toBeNull();
    expect(result!.meshCount).toBe(10);
    expect(result!.chunks).toHaveLength(1);
  });

  it("combines multiple manifests", () => {
    const m1 = makeManifest({
      modelId: 1,
      meshCount: 10,
      vertexCount: 100,
      indexCount: 300,
      modelBounds: [0, 0, 0, 5, 5, 5],
      chunks: [{ modelId: 1, chunkId: 0, storeyId: null, entityIds: [1], ifcTypes: [], meshCount: 5, vertexCount: 50, indexCount: 150, bounds: [0, 0, 0, 5, 5, 5] }],
    });
    const m2 = makeManifest({
      modelId: 2,
      meshCount: 20,
      vertexCount: 200,
      indexCount: 600,
      modelBounds: [-1, -1, -1, 3, 3, 3],
      chunks: [{ modelId: 2, chunkId: 1, storeyId: null, entityIds: [2], ifcTypes: [], meshCount: 10, vertexCount: 100, indexCount: 300, bounds: [-1, -1, -1, 3, 3, 3] }],
    });

    const result = combineManifests([m1, m2]);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe(-1);
    expect(result!.meshCount).toBe(30);
    expect(result!.vertexCount).toBe(300);
    expect(result!.indexCount).toBe(900);
    expect(result!.chunks).toHaveLength(2);
    expect(result!.modelBounds).toEqual([-1, -1, -1, 5, 5, 5]);
  });
});
