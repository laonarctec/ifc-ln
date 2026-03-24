import { describe, it, expect, vi } from "vitest";

// Mock web-ifc imports before importing the module under test
vi.mock("web-ifc", () => ({
  IFCPROJECT: 103090709,
  IFCUNITASSIGNMENT: 180925521,
  IFCSIUNIT: 448429030,
}));

vi.mock("./edgeExtractor", () => ({
  extractEdges: vi.fn(() => new Float32Array()),
}));

vi.mock("./ifcPropertyUtils", () => ({
  readIfcText: vi.fn(),
  readIfcNumber: vi.fn(),
}));

import {
  createManifestFromChunks,
  unionBounds,
  createMeshBounds,
} from "./ifcGeometryUtils";
import type { WorkerChunk } from "./ifcGeometryUtils";

// ── unionBounds ─────────────────────────────────────────

describe("unionBounds", () => {
  it("returns a copy of next when target is null", () => {
    const next: [number, number, number, number, number, number] = [
      1, 2, 3, 4, 5, 6,
    ];
    const result = unionBounds(null, next);
    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    // must be a new array, not the same reference
    expect(result).not.toBe(next);
  });

  it("computes min/max across two bounds", () => {
    const a: [number, number, number, number, number, number] = [
      0, 0, 0, 10, 10, 10,
    ];
    const b: [number, number, number, number, number, number] = [
      -5, 2, -3, 8, 15, 7,
    ];
    expect(unionBounds(a, b)).toEqual([-5, 0, -3, 10, 15, 10]);
  });
});

// ── createMeshBounds ────────────────────────────────────

describe("createMeshBounds", () => {
  it("computes world-space AABB with identity transform", () => {
    // 2 vertices: (0,0,0) and (1,2,3), stride-6 with normals
    const vertices = new Float32Array([
      0, 0, 0, 0, 0, 1, // vertex 0 + normal
      1, 2, 3, 0, 0, 1, // vertex 1 + normal
    ]);
    const indices = new Uint32Array([0, 1, 0]);
    // prettier-ignore
    const identity = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
    const bounds = createMeshBounds({
      modelId: 1,
      expressId: 1,
      geometryExpressId: 1,
      ifcType: "IFCWALL",
      vertices,
      indices,
      color: [1, 1, 1, 1],
      transform: identity,
    });
    expect(bounds[0]).toBeCloseTo(0); // minX
    expect(bounds[1]).toBeCloseTo(0); // minY
    expect(bounds[2]).toBeCloseTo(0); // minZ
    expect(bounds[3]).toBeCloseTo(1); // maxX
    expect(bounds[4]).toBeCloseTo(2); // maxY
    expect(bounds[5]).toBeCloseTo(3); // maxZ
  });
});

// ── createManifestFromChunks ────────────────────────────

function makeChunk(
  chunkId: number,
  overrides: Partial<WorkerChunk["meta"]> = {},
): WorkerChunk {
  return {
    meta: {
      modelId: 1,
      chunkId,
      storeyId: null,
      entityIds: [chunkId * 100],
      ifcTypes: ["IFCWALL"],
      meshCount: 1,
      vertexCount: 10,
      indexCount: 36,
      bounds: [0, 0, 0, 1, 1, 1] as [
        number,
        number,
        number,
        number,
        number,
        number,
      ],
      ...overrides,
    },
    meshes: [],
  };
}

describe("createManifestFromChunks", () => {
  it("aggregates meshCount, vertexCount, indexCount across chunks", () => {
    const chunks = [
      makeChunk(1, { meshCount: 3, vertexCount: 100, indexCount: 300 }),
      makeChunk(2, { meshCount: 5, vertexCount: 200, indexCount: 600 }),
    ];
    const manifest = createManifestFromChunks(42, chunks);

    expect(manifest.modelId).toBe(42);
    expect(manifest.meshCount).toBe(8);
    expect(manifest.vertexCount).toBe(300);
    expect(manifest.indexCount).toBe(900);
    expect(manifest.chunkCount).toBe(2);
  });

  it("computes union bounds across all chunks", () => {
    const chunks = [
      makeChunk(1, { bounds: [0, 0, 0, 5, 5, 5] }),
      makeChunk(2, { bounds: [-3, -1, -2, 2, 8, 3] }),
    ];
    const manifest = createManifestFromChunks(1, chunks);

    expect(manifest.modelBounds).toEqual([-3, -1, -2, 5, 8, 5]);
  });

  it("returns safe zero bounds for empty chunks", () => {
    const manifest = createManifestFromChunks(1, []);

    expect(manifest.modelBounds).toEqual([0, 0, 0, 0, 0, 0]);
    expect(manifest.chunkCount).toBe(0);
    expect(manifest.initialChunkIds).toEqual([]);
  });

  it("limits initialChunkIds to 16 closest to center", () => {
    const chunks = Array.from({ length: 20 }, (_, i) =>
      makeChunk(i + 1, {
        bounds: [i * 10, 0, 0, i * 10 + 1, 1, 1],
      }),
    );
    const manifest = createManifestFromChunks(1, chunks);

    expect(manifest.initialChunkIds.length).toBe(16);
  });
});
