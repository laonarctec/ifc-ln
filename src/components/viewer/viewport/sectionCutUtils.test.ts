import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  isBoxFullyClipped,
  isPointClipped,
} from "./sectionCutUtils";

describe("sectionCutUtils", () => {
  it("treats points and bounds on the clipped side as hidden", () => {
    const clippingPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

    expect(
      isPointClipped(new THREE.Vector3(0.5, 0, 0), [clippingPlane]),
    ).toBe(false);
    expect(
      isPointClipped(new THREE.Vector3(-0.5, 0, 0), [clippingPlane]),
    ).toBe(true);
    expect(
      isBoxFullyClipped(
        new THREE.Box3(
          new THREE.Vector3(-1, -1, -1),
          new THREE.Vector3(-0.25, 1, 1),
        ),
        [clippingPlane],
      ),
    ).toBe(true);
  });
});
