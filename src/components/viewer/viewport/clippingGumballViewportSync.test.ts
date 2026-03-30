import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { ClippingPlaneObject } from "@/stores/slices/clippingSlice";
import { getPlaneQuaternion } from "./clippingMath";
import { syncClippingGumballViewportScale } from "./clippingGumballViewportSync";
import { calculateGumballWorldScale, createGumball } from "./gumball";

function createPlane(
  overrides: Partial<ClippingPlaneObject> = {},
): ClippingPlaneObject {
  return {
    id: "plane-a",
    name: "Plane A",
    enabled: true,
    locked: false,
    selected: true,
    origin: [1, 2, 3],
    normal: [0, 0, 1],
    uAxis: [1, 0, 0],
    vAxis: [0, 1, 0],
    width: 4,
    height: 3,
    flipped: false,
    labelVisible: true,
    ...overrides,
  };
}

function createCamera() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 0, 12);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

describe("clippingGumballViewportSync", () => {
  it("updates gumball transform from the selected plane and viewport height", () => {
    const gumball = createGumball(10);
    const camera = createCamera();
    const plane = createPlane();
    const renderer = {
      domElement: { clientHeight: 720 },
    } as Pick<THREE.WebGLRenderer, "domElement">;

    const synced = syncClippingGumballViewportScale({
      gumball,
      camera,
      renderer,
      plane,
    });

    const expectedScale = calculateGumballWorldScale(
      camera,
      new THREE.Vector3(...plane.origin),
      renderer.domElement.clientHeight,
    );

    expect(synced).toBe(true);
    expect(gumball.group.position.toArray()).toEqual(plane.origin);
    expect(gumball.group.quaternion.angleTo(getPlaneQuaternion(plane))).toBeCloseTo(0, 6);
    expect(gumball.group.scale.x).toBeCloseTo(expectedScale / gumball.baseScale, 6);
  });

  it("returns false when the plane cannot drive the gumball", () => {
    const synced = syncClippingGumballViewportScale({
      gumball: createGumball(10),
      camera: createCamera(),
      renderer: { domElement: { clientHeight: 720 } } as Pick<
        THREE.WebGLRenderer,
        "domElement"
      >,
      plane: createPlane({ locked: true }),
    });

    expect(synced).toBe(false);
  });
});
