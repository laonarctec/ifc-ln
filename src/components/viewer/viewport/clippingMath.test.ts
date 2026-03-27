import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildRuntimeClippingPlanes, createDraftFromHit } from "./clippingMath";
import type { RaycastHit } from "./raycasting";

function expectTupleCloseTo(
  actual: [number, number, number] | null,
  expected: [number, number, number],
) {
  expect(actual).not.toBeNull();
  actual?.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index] ?? 0, 5);
  });
}

function createRotatedMeshHit(faceNormal: THREE.Vector3): RaycastHit {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
  );
  mesh.rotation.set(0, 0, Math.PI * 0.5);
  mesh.updateMatrixWorld(true);

  return {
    modelId: 1,
    expressId: 101,
    point: new THREE.Vector3(1, 2, 3),
    faceNormal,
    object: mesh,
    instanceId: null,
  };
}

describe("clippingMath", () => {
  it("creates a clipping draft aligned to the clicked object's local axes", () => {
    const draft = createDraftFromHit(
      createRotatedMeshHit(new THREE.Vector3(0, 1, 0)),
    );

    expectTupleCloseTo(draft.origin, [1, 2, 3]);
    expectTupleCloseTo(draft.normal, [0, 1, 0]);
    expectTupleCloseTo(draft.uAxis, [-1, 0, 0]);
    expectTupleCloseTo(draft.vAxis, [0, 0, 1]);
  });

  it("preserves handedness when the chosen object axis points opposite the face normal", () => {
    const draft = createDraftFromHit(
      createRotatedMeshHit(new THREE.Vector3(0, -1, 0)),
    );

    expectTupleCloseTo(draft.normal, [0, -1, 0]);
    expectTupleCloseTo(draft.uAxis, [1, 0, 0]);
    expectTupleCloseTo(draft.vAxis, [0, 0, 1]);
  });

  it("builds bounded runtime clipping planes from the plane rectangle", () => {
    const runtime = buildRuntimeClippingPlanes({
      origin: [0, 0, 0],
      normal: [0, 0, 1],
      uAxis: [1, 0, 0],
      vAxis: [0, 1, 0],
      width: 4,
      height: 2,
      flipped: false,
    });

    expect(runtime.allPlanes).toHaveLength(5);
    expect(runtime.mainPlane.distanceToPoint(new THREE.Vector3(0, 0, 1))).toBeGreaterThan(0);
    expect(runtime.sidePlanes.some((plane) => plane.distanceToPoint(new THREE.Vector3(3, 0, 0)) > 0)).toBe(true);
    expect(runtime.sidePlanes.every((plane) => plane.distanceToPoint(new THREE.Vector3(0.5, 0.25, 0)) <= 0)).toBe(true);
  });
});
