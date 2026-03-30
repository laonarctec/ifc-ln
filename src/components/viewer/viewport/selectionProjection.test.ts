import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { projectClippedBoxToNDC } from "./selectionProjection";

function createCamera() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

describe("selectionProjection", () => {
  it("projects unclipped world boxes to screen-space bounds", () => {
    const projected = projectClippedBoxToNDC(
      new THREE.Box3(
        new THREE.Vector3(-0.5, -0.5, -0.5),
        new THREE.Vector3(0.5, 0.5, 0.5),
      ),
      createCamera(),
    );

    expect(projected).not.toBeNull();
    expect(projected!.minX).toBeLessThan(0);
    expect(projected!.maxX).toBeGreaterThan(0);
  });

  it("shrinks projected bounds to the visible clipped region", () => {
    const camera = createCamera();
    const box = new THREE.Box3(
      new THREE.Vector3(-0.5, -0.5, -0.5),
      new THREE.Vector3(0.5, 0.5, 0.5),
    );
    const full = projectClippedBoxToNDC(box, camera);
    const clipped = projectClippedBoxToNDC(
      box,
      camera,
      [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)],
    );

    expect(full).not.toBeNull();
    expect(clipped).not.toBeNull();
    expect(clipped!.minX).toBeGreaterThan(full!.minX);
    expect(clipped!.minX).toBeGreaterThanOrEqual(-0.001);
    expect(clipped!.maxX).toBeCloseTo(full!.maxX, 3);
  });

  it("returns null when clipping planes remove the whole box", () => {
    const projected = projectClippedBoxToNDC(
      new THREE.Box3(
        new THREE.Vector3(-0.5, -0.5, -0.5),
        new THREE.Vector3(-0.25, 0.5, 0.5),
      ),
      createCamera(),
      [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)],
    );

    expect(projected).toBeNull();
  });
});
