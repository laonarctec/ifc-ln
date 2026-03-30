import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildRuntimeClippingPlanes } from "./clippingMath";
import { pickEntitiesInBox } from "./raycasting";

function createCamera() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

describe("raycasting", () => {
  it("does not crossing-select the clipped-away half of a mesh", () => {
    const sceneRoot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.userData.modelId = 1;
    mesh.userData.expressId = 101;
    mesh.updateMatrixWorld(true);
    sceneRoot.add(mesh);
    sceneRoot.updateMatrixWorld(true);

    const hits = pickEntitiesInBox(
      -0.35,
      -0.35,
      -0.05,
      0.35,
      "crossing",
      createCamera(),
      sceneRoot,
      undefined,
      [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)],
    );

    expect(hits).toEqual([]);
  });

  it("uses clipped bounds for window box selection", () => {
    const sceneRoot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.userData.modelId = 1;
    mesh.userData.expressId = 101;
    mesh.updateMatrixWorld(true);
    sceneRoot.add(mesh);
    sceneRoot.updateMatrixWorld(true);

    const hits = pickEntitiesInBox(
      -0.01,
      -0.35,
      0.35,
      0.35,
      "window",
      createCamera(),
      sceneRoot,
      undefined,
      [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)],
    );

    expect(hits).toEqual([{ modelId: 1, expressId: 101 }]);
  });

  it("does not crossing-select the clipped-away half of a batched mesh instance", () => {
    const sceneRoot = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const batchedMesh = new THREE.BatchedMesh(
      1,
      geometry.getAttribute("position").count,
      geometry.getIndex()!.count,
      new THREE.MeshBasicMaterial(),
    );
    const geometryId = batchedMesh.addGeometry(geometry);
    batchedMesh.addInstance(geometryId);
    batchedMesh.userData.modelId = 2;
    batchedMesh.userData.instanceExpressIds = [303];
    batchedMesh.updateMatrixWorld(true);
    sceneRoot.add(batchedMesh);
    sceneRoot.updateMatrixWorld(true);

    const hits = pickEntitiesInBox(
      -0.35,
      -0.35,
      -0.05,
      0.35,
      "crossing",
      createCamera(),
      sceneRoot,
      undefined,
      [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)],
    );

    expect(hits).toEqual([]);
  });

  it("uses the flipped clipping side for box selection", () => {
    const sceneRoot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.userData.modelId = 1;
    mesh.userData.expressId = 101;
    mesh.updateMatrixWorld(true);
    sceneRoot.add(mesh);
    sceneRoot.updateMatrixWorld(true);

    const { mainPlane } = buildRuntimeClippingPlanes({
      origin: [0, 0, 0],
      normal: [1, 0, 0],
      uAxis: [0, 1, 0],
      vAxis: [0, 0, 1],
      width: 4,
      height: 4,
      flipped: true,
    });

    const hits = pickEntitiesInBox(
      -0.35,
      -0.35,
      -0.05,
      0.35,
      "crossing",
      createCamera(),
      sceneRoot,
      undefined,
      [mainPlane],
    );

    expect(hits).toEqual([{ modelId: 1, expressId: 101 }]);
  });
});
