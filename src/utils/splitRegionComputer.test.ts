import { describe, it, expect } from "vitest";
import {
  segmentIntersection,
  clipLineToBounds,
  extendLineToBounds,
  computeRegionsFromLines,
  pointInPolygon,
  computeEntityCentroids,
  REGION_COLORS,
} from "./splitRegionComputer";
import type { SplitBounds } from "@/stores/slices/quantitySplitSlice";
import type { TransferableMeshData } from "@/types/worker-messages";

// ---------------------------------------------------------------------------
// segmentIntersection
// ---------------------------------------------------------------------------

describe("segmentIntersection", () => {
  it("finds intersection of crossing segments", () => {
    const hit = segmentIntersection([0, 0], [2, 2], [0, 2], [2, 0]);
    expect(hit).not.toBeNull();
    expect(hit![0]).toBeCloseTo(1);
    expect(hit![1]).toBeCloseTo(1);
  });

  it("returns null for parallel segments", () => {
    expect(segmentIntersection([0, 0], [2, 0], [0, 1], [2, 1])).toBeNull();
  });

  it("returns null for non-intersecting segments", () => {
    expect(segmentIntersection([0, 0], [1, 0], [2, 1], [2, 3])).toBeNull();
  });

  it("finds intersection at segment endpoints", () => {
    const hit = segmentIntersection([0, 0], [1, 1], [1, 1], [2, 0]);
    expect(hit).not.toBeNull();
    expect(hit![0]).toBeCloseTo(1);
    expect(hit![1]).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// clipLineToBounds
// ---------------------------------------------------------------------------

describe("clipLineToBounds", () => {
  const bounds: SplitBounds = { min: [0, 0], max: [10, 10] };

  it("clips a segment fully inside bounds (unchanged)", () => {
    const result = clipLineToBounds([2, 2], [8, 8], bounds);
    expect(result).not.toBeNull();
    expect(result![0][0]).toBeCloseTo(2);
    expect(result![1][0]).toBeCloseTo(8);
  });

  it("clips a segment crossing bounds", () => {
    const result = clipLineToBounds([-5, 5], [15, 5], bounds);
    expect(result).not.toBeNull();
    expect(result![0][0]).toBeCloseTo(0);
    expect(result![1][0]).toBeCloseTo(10);
  });

  it("returns null for segment entirely outside", () => {
    expect(clipLineToBounds([11, 11], [15, 15], bounds)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extendLineToBounds
// ---------------------------------------------------------------------------

describe("extendLineToBounds", () => {
  const bounds: SplitBounds = { min: [0, 0], max: [10, 10] };

  it("extends a horizontal line to full bounds width", () => {
    const result = extendLineToBounds([3, 5], [7, 5], bounds);
    expect(result).not.toBeNull();
    expect(result![0][0]).toBeCloseTo(0);
    expect(result![0][1]).toBeCloseTo(5);
    expect(result![1][0]).toBeCloseTo(10);
    expect(result![1][1]).toBeCloseTo(5);
  });

  it("extends a vertical line to full bounds height", () => {
    const result = extendLineToBounds([5, 3], [5, 7], bounds);
    expect(result).not.toBeNull();
    expect(result![0][0]).toBeCloseTo(5);
    expect(result![0][1]).toBeCloseTo(0);
    expect(result![1][0]).toBeCloseTo(5);
    expect(result![1][1]).toBeCloseTo(10);
  });

  it("returns null for zero-length segment", () => {
    expect(extendLineToBounds([5, 5], [5, 5], bounds)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// pointInPolygon
// ---------------------------------------------------------------------------

describe("pointInPolygon", () => {
  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];

  it("detects point inside", () => {
    expect(pointInPolygon([5, 5], square)).toBe(true);
  });

  it("detects point outside", () => {
    expect(pointInPolygon([15, 5], square)).toBe(false);
  });

  it("handles point near edge", () => {
    expect(pointInPolygon([5, 0.001], square)).toBe(true);
  });

  it("works with triangle", () => {
    const tri: [number, number][] = [[0, 0], [10, 0], [5, 10]];
    expect(pointInPolygon([5, 3], tri)).toBe(true);
    expect(pointInPolygon([0, 10], tri)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeRegionsFromLines
// ---------------------------------------------------------------------------

describe("computeRegionsFromLines", () => {
  const bounds: SplitBounds = { min: [0, 0], max: [10, 10] };

  it("returns single region when no lines are provided", () => {
    const regions = computeRegionsFromLines(bounds, []);
    expect(regions).toHaveLength(1);
    // Should be the bounding rectangle
    expect(regions[0]).toHaveLength(4);
  });

  it("splits into 2 regions with a horizontal line", () => {
    const lines = [
      { id: "l1", start: [3, 5] as [number, number], end: [7, 5] as [number, number] },
    ];
    const regions = computeRegionsFromLines(bounds, lines);
    expect(regions.length).toBe(2);

    // Both regions should be valid polygons
    for (const region of regions) {
      expect(region.length).toBeGreaterThanOrEqual(3);
    }

    // Total area should equal bounds area
    const totalArea = regions.reduce((sum, r) => {
      let a = 0;
      for (let i = 0; i < r.length; i++) {
        const j = (i + 1) % r.length;
        a += r[i][0] * r[j][1] - r[j][0] * r[i][1];
      }
      return sum + Math.abs(a / 2);
    }, 0);
    expect(totalArea).toBeCloseTo(100, 0); // 10x10 = 100
  });

  it("splits into 4 regions with a cross", () => {
    const lines = [
      { id: "l1", start: [3, 5] as [number, number], end: [7, 5] as [number, number] },
      { id: "l2", start: [5, 3] as [number, number], end: [5, 7] as [number, number] },
    ];
    const regions = computeRegionsFromLines(bounds, lines);
    expect(regions.length).toBe(4);
  });

  it("splits into 2 regions with a vertical line", () => {
    const lines = [
      { id: "l1", start: [5, 2] as [number, number], end: [5, 8] as [number, number] },
    ];
    const regions = computeRegionsFromLines(bounds, lines);
    expect(regions.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeEntityCentroids
// ---------------------------------------------------------------------------

describe("computeEntityCentroids", () => {
  it("computes centroids from mesh data", () => {
    // A simple mesh: 2 triangles forming a unit square at origin
    // 6-stride: x, y, z, nx, ny, nz
    const vertices = new Float32Array([
      0, 0, 0, 0, 0, 1,
      1, 0, 0, 0, 0, 1,
      1, 1, 0, 0, 0, 1,
      0, 1, 0, 0, 0, 1,
    ]);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const meshes: TransferableMeshData[] = [
      {
        modelId: 1,
        expressId: 100,
        geometryExpressId: 100,
        ifcType: "IFCWALL",
        vertices,
        indices,
        color: [0.5, 0.5, 0.5, 1],
        transform: identity,
      },
    ];

    const centroids = computeEntityCentroids(meshes);
    expect(centroids.has(100)).toBe(true);
    const c = centroids.get(100)!;
    expect(c[0]).toBeCloseTo(0.5);
    expect(c[1]).toBeCloseTo(0.5);
  });

  it("applies transform to vertices", () => {
    const vertices = new Float32Array([
      0, 0, 0, 0, 0, 1,
      2, 0, 0, 0, 0, 1,
    ]);
    const indices = new Uint32Array([0, 1, 0]);
    // Translation matrix: +10 in X, +20 in Y
    const transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1];

    const meshes: TransferableMeshData[] = [
      {
        modelId: 1,
        expressId: 200,
        geometryExpressId: 200,
        ifcType: "IFCSLAB",
        vertices,
        indices,
        color: [0.5, 0.5, 0.5, 1],
        transform,
      },
    ];

    const centroids = computeEntityCentroids(meshes);
    const c = centroids.get(200)!;
    expect(c[0]).toBeCloseTo(11); // (10+12)/2
    expect(c[1]).toBeCloseTo(20);
  });
});
