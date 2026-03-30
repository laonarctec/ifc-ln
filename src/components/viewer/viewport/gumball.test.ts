import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  clearGumballPreview,
  calculateGumballWorldScale,
  createGumball,
  showAxisTranslationPreview,
  updateGumballTransform,
} from "./gumball";

function createPerspectiveCamera(z: number) {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 0, z);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

describe("gumball", () => {
  it("shrinks world scale as a perspective camera moves closer", () => {
    const farCamera = createPerspectiveCamera(10);
    const nearCamera = createPerspectiveCamera(5);
    const position = new THREE.Vector3(0, 0, 0);

    const farScale = calculateGumballWorldScale(farCamera, position, 800);
    const nearScale = calculateGumballWorldScale(nearCamera, position, 800);

    expect(nearScale).toBeCloseTo(farScale * 0.5, 5);
  });

  it("shrinks world scale as orthographic zoom increases", () => {
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    const zoomOneScale = calculateGumballWorldScale(
      camera,
      new THREE.Vector3(0, 0, 0),
      800,
    );

    camera.zoom = 2;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    const zoomTwoScale = calculateGumballWorldScale(
      camera,
      new THREE.Vector3(0, 0, 0),
      800,
    );

    expect(zoomTwoScale).toBeCloseTo(zoomOneScale * 0.5, 5);
  });

  it("applies the computed world scale through the gumball group transform", () => {
    const gumball = createGumball(10);
    const position = new THREE.Vector3(1, 2, 3);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      Math.PI / 4,
    );

    updateGumballTransform(gumball, position, quaternion, 20);

    expect(gumball.group.position).toEqual(position);
    expect(gumball.group.quaternion.angleTo(quaternion)).toBeCloseTo(0, 6);
    expect(gumball.group.scale.x).toBeCloseTo(2, 6);
    expect(gumball.group.scale.y).toBeCloseTo(2, 6);
    expect(gumball.group.scale.z).toBeCloseTo(2, 6);
  });

  it("creates Rhino-style plane, center, and resize handles", () => {
    const gumball = createGumball(10);
    const handleTypes = gumball.handles.map((handle) => handle.type);

    expect(handleTypes).toEqual(
      expect.arrayContaining([
        "translate-plane-xy",
        "translate-plane-yz",
        "translate-plane-zx",
        "translate-center",
        "resize-x",
        "resize-y",
        "resize-xy",
      ]),
    );
    expect(gumball.hitTargets).toHaveLength(gumball.handles.length);
    expect(gumball.previewGroup.name).toBe("gumball-preview");
    expect(gumball.guideGroup.name).toBe("gumball-reference-guide");
  });

  it("renders and clears drag preview geometry", () => {
    const gumball = createGumball(10);

    showAxisTranslationPreview(
      gumball,
      new THREE.Vector3(1, 0, 0),
      0.5,
      new THREE.Color(0xff3030),
    );

    expect(gumball.previewGroup.children).toHaveLength(2);

    clearGumballPreview(gumball);

    expect(gumball.previewGroup.children).toHaveLength(0);
  });
});
