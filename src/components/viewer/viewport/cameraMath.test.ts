import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  getCameraAspect,
  setCameraAspect,
  updateOrthographicFrustum,
  boundsFromTuple,
  buildBoundsForEntries,
} from "./cameraMath";
import type { RenderEntry } from "./meshManagement";

// ── getCameraAspect / setCameraAspect ───────────────────

describe("getCameraAspect", () => {
  it("returns aspect from PerspectiveCamera", () => {
    const camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 100);
    expect(getCameraAspect(camera)).toBeCloseTo(1.5);
  });

  it("computes aspect from OrthographicCamera frustum", () => {
    const camera = new THREE.OrthographicCamera(-8, 8, 4, -4, 0.1, 100);
    // width=16, height=8 → aspect=2
    expect(getCameraAspect(camera)).toBeCloseTo(2);
  });
});

describe("setCameraAspect", () => {
  it("sets aspect on PerspectiveCamera directly", () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    setCameraAspect(camera, 2.0);
    expect(camera.aspect).toBeCloseTo(2.0);
  });

  it("stores aspect in userData for OrthographicCamera", () => {
    const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    setCameraAspect(camera, 1.5);
    expect(camera.userData.viewportAspect).toBeCloseTo(1.5);
  });
});

// ── updateOrthographicFrustum ──────────────────────────

describe("updateOrthographicFrustum", () => {
  it("updates frustum based on halfHeight and stored aspect", () => {
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.userData.viewportAspect = 2.0;
    updateOrthographicFrustum(camera, 5);
    // halfWidth = 5 * 2 = 10
    expect(camera.left).toBeCloseTo(-10);
    expect(camera.right).toBeCloseTo(10);
    expect(camera.top).toBeCloseTo(5);
    expect(camera.bottom).toBeCloseTo(-5);
  });

  it("clamps halfHeight to minimum 0.5", () => {
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.userData.viewportAspect = 1.0;
    updateOrthographicFrustum(camera, 0.001);
    expect(camera.top).toBeCloseTo(0.5);
    expect(camera.bottom).toBeCloseTo(-0.5);
  });
});

// ── boundsFromTuple ─────────────────────────────────────

describe("boundsFromTuple", () => {
  it("creates Box3 from 6-element tuple", () => {
    const box = boundsFromTuple([1, 2, 3, 4, 5, 6]);
    expect(box.min.x).toBe(1);
    expect(box.min.y).toBe(2);
    expect(box.min.z).toBe(3);
    expect(box.max.x).toBe(4);
    expect(box.max.y).toBe(5);
    expect(box.max.z).toBe(6);
  });
});

// ── buildBoundsForEntries ───────────────────────────────

describe("buildBoundsForEntries", () => {
  function makeEntry(expressId: number, min: number[], max: number[]): RenderEntry {
    const geometry = new THREE.BufferGeometry();
    geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(min[0], min[1], min[2]),
      new THREE.Vector3(max[0], max[1], max[2]),
    );
    const mesh = new THREE.Mesh(geometry);
    return {
      modelId: 1,
      expressId,
      entityKey: `1:${expressId}` as const,
      object: mesh,
      baseColor: new THREE.Color(1, 1, 1),
      baseOpacity: 1,
      instanceIndex: null,
      baseMatrix: new THREE.Matrix4(),
      geometryExpressId: expressId,
      geometryBounds: geometry.boundingBox?.clone() ?? null,
    };
  }

  it("computes union bounds for all non-hidden entries", () => {
    const entries = [
      makeEntry(1, [0, 0, 0], [5, 5, 5]),
      makeEntry(2, [10, 10, 10], [20, 20, 20]),
    ];
    const bounds = buildBoundsForEntries(entries);
    expect(bounds.min.x).toBe(0);
    expect(bounds.max.x).toBe(20);
  });

  it("excludes hidden entries from bounds", () => {
    const entries = [
      makeEntry(1, [0, 0, 0], [5, 5, 5]),
      makeEntry(2, [100, 100, 100], [200, 200, 200]),
    ];
    const bounds = buildBoundsForEntries(entries, [2]);
    expect(bounds.max.x).toBe(5); // entry 2 excluded
  });

  it("falls back to all entries if all are hidden", () => {
    const entries = [
      makeEntry(1, [0, 0, 0], [5, 5, 5]),
    ];
    const bounds = buildBoundsForEntries(entries, [1]);
    expect(bounds.max.x).toBe(5); // fallback includes entry 1
  });
});
