import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildRuntimeClippingPlanes,
} from "./clippingMath";
import {
  pickEntityAtPointer,
  pickHitAtPointer,
  pickPointerResultAtPointer,
} from "./pointerPicking";

function createCamera() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

describe("pointerPicking", () => {
  it("returns hit information for a mesh", () => {
    const sceneRoot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.userData.modelId = 1;
    mesh.userData.expressId = 101;
    mesh.updateMatrixWorld(true);
    sceneRoot.add(mesh);
    sceneRoot.updateMatrixWorld(true);

    const hit = pickHitAtPointer(
      new THREE.Vector2(0, 0),
      new THREE.Raycaster(),
      createCamera(),
      sceneRoot,
    );

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
      pickEntityAtPointer(
        new THREE.Vector2(0, 0),
        new THREE.Raycaster(),
        createCamera(),
        sceneRoot,
      ),
    ).toBe(303);
  });

  it("skips raycast hits that fall on the clipped side of an active section plane", () => {
    const sceneRoot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.userData.modelId = 1;
    mesh.userData.expressId = 101;
    mesh.updateMatrixWorld(true);
    sceneRoot.add(mesh);
    sceneRoot.updateMatrixWorld(true);

    const hit = pickHitAtPointer(
      new THREE.Vector2(-0.2, 0),
      new THREE.Raycaster(),
      createCamera(),
      sceneRoot,
      undefined,
      [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)],
    );

    expect(hit).toBeNull();
  });

  it("stops selection at section blockers before returning geometry behind the cut", () => {
    const sceneRoot = new THREE.Group();

    const blockerGroup = new THREE.Group();
    blockerGroup.userData.selectionBlocker = true;
    const blocker = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.MeshBasicMaterial(),
    );
    blocker.position.z = 1;
    blockerGroup.add(blocker);
    blockerGroup.updateMatrixWorld(true);
    sceneRoot.add(blockerGroup);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.userData.modelId = 1;
    mesh.userData.expressId = 101;
    mesh.updateMatrixWorld(true);
    sceneRoot.add(mesh);
    sceneRoot.updateMatrixWorld(true);

    const result = pickPointerResultAtPointer(
      new THREE.Vector2(0, 0),
      new THREE.Raycaster(),
      createCamera(),
      sceneRoot,
      undefined,
      [new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)],
    );

    expect(result).toEqual({ kind: "blocked" });
  });

  it("does not pick the clipped-away half of a batched mesh instance", () => {
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
    batchedMesh.userData.modelId = 3;
    batchedMesh.userData.instanceExpressIds = [404];
    batchedMesh.updateMatrixWorld(true);
    sceneRoot.add(batchedMesh);
    sceneRoot.updateMatrixWorld(true);

    const hit = pickHitAtPointer(
      new THREE.Vector2(-0.2, 0),
      new THREE.Raycaster(),
      createCamera(),
      sceneRoot,
      undefined,
      [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)],
    );

    expect(hit).toBeNull();
  });

  it("still picks the visible half of a batched mesh instance", () => {
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
    batchedMesh.userData.modelId = 3;
    batchedMesh.userData.instanceExpressIds = [404];
    batchedMesh.updateMatrixWorld(true);
    sceneRoot.add(batchedMesh);
    sceneRoot.updateMatrixWorld(true);

    const hit = pickHitAtPointer(
      new THREE.Vector2(0.2, 0),
      new THREE.Raycaster(),
      createCamera(),
      sceneRoot,
      undefined,
      [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)],
    );

    expect(hit?.expressId).toBe(404);
  });

  it("respects flipped clipping planes when filtering pointer hits", () => {
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

    const clippedHit = pickHitAtPointer(
      new THREE.Vector2(0.2, 0),
      new THREE.Raycaster(),
      createCamera(),
      sceneRoot,
      undefined,
      [mainPlane],
    );
    const visibleHit = pickHitAtPointer(
      new THREE.Vector2(-0.2, 0),
      new THREE.Raycaster(),
      createCamera(),
      sceneRoot,
      undefined,
      [mainPlane],
    );

    expect(clippedHit).toBeNull();
    expect(visibleHit?.expressId).toBe(101);
  });

  it("only blocks geometry behind a section cap from the clipped-away side", () => {
    const sceneRoot = new THREE.Group();

    const sectionFill = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    sectionFill.rotateY(Math.PI / 2);
    sectionFill.updateMatrixWorld(true);
    sceneRoot.add(sectionFill);

    const sectionBlockerGroup = new THREE.Group();
    sectionBlockerGroup.userData.selectionBlocker = true;
    const sectionBlocker = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0 }),
    );
    sectionBlocker.rotateY(Math.PI / 2);
    sectionBlocker.position.x = -0.05;
    sectionBlocker.updateMatrixWorld(true);
    sectionBlockerGroup.add(sectionBlocker);
    sectionBlockerGroup.updateMatrixWorld(true);
    sceneRoot.add(sectionBlockerGroup);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial());
    mesh.position.x = 0.25;
    mesh.userData.modelId = 7;
    mesh.userData.expressId = 707;
    mesh.updateMatrixWorld(true);
    sceneRoot.add(mesh);
    sceneRoot.updateMatrixWorld(true);

    const visibleSideCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    visibleSideCamera.position.set(5, 0, 0);
    visibleSideCamera.lookAt(0, 0, 0);
    visibleSideCamera.updateProjectionMatrix();
    visibleSideCamera.updateMatrixWorld(true);

    const clippedSideCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    clippedSideCamera.position.set(-5, 0, 0);
    clippedSideCamera.lookAt(0, 0, 0);
    clippedSideCamera.updateProjectionMatrix();
    clippedSideCamera.updateMatrixWorld(true);

    const visibleSideResult = pickPointerResultAtPointer(
      new THREE.Vector2(0, 0),
      new THREE.Raycaster(),
      visibleSideCamera,
      sceneRoot,
    );
    const clippedSideResult = pickPointerResultAtPointer(
      new THREE.Vector2(0, 0),
      new THREE.Raycaster(),
      clippedSideCamera,
      sceneRoot,
    );

    expect(visibleSideResult).toMatchObject({
      kind: "hit",
      hit: expect.objectContaining({
        expressId: 707,
      }),
    });
    expect(clippedSideResult).toEqual({ kind: "blocked" });
  });
});
