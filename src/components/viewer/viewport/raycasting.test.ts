import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { pickEntityAtPointer, pickHitAtPointer } from "./raycasting";

function createCamera() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

describe("raycasting", () => {
  it("returns hit information for a mesh", () => {
    const sceneRoot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.userData.modelId = 1;
    mesh.userData.expressId = 101;
    mesh.updateMatrixWorld(true);
    sceneRoot.add(mesh);
    sceneRoot.updateMatrixWorld(true);

    const hit = pickHitAtPointer(new THREE.Vector2(0, 0), new THREE.Raycaster(), createCamera(), sceneRoot);

    expect(hit?.expressId).toBe(101);
    expect(hit?.point.z).toBeCloseTo(0.5, 1);
  });

  it("normalizes instanced mesh hits to express ids", () => {
    const sceneRoot = new THREE.Group();
    const instancedMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      1,
    );
    instancedMesh.setMatrixAt(0, new THREE.Matrix4());
    instancedMesh.userData.modelId = 2;
    instancedMesh.userData.instanceExpressIds = [303];
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.updateMatrixWorld(true);
    sceneRoot.add(instancedMesh);
    sceneRoot.updateMatrixWorld(true);

    expect(
      pickEntityAtPointer(new THREE.Vector2(0, 0), new THREE.Raycaster(), createCamera(), sceneRoot),
    ).toBe(303);
  });
});
