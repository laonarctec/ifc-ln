import * as THREE from "three";
import type { ViewCamera } from "./cameraMath";

export interface RaycastHit {
  modelId: number;
  expressId: number;
  point: THREE.Vector3;
  object: THREE.Mesh | THREE.InstancedMesh;
  instanceId: number | null;
}

export function pickHitAtPointer(
  pointer: THREE.Vector2,
  raycaster: THREE.Raycaster,
  camera: ViewCamera,
  sceneRoot: THREE.Group,
): RaycastHit | null {
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(sceneRoot.children, true);
  const firstHit = intersects.find(
    (intersection) =>
      intersection.object instanceof THREE.Mesh ||
      intersection.object instanceof THREE.InstancedMesh,
  );

  if (!firstHit) {
    return null;
  }

  if (
    firstHit.object instanceof THREE.InstancedMesh &&
    firstHit.instanceId !== undefined
  ) {
    const instanceExpressIds = firstHit.object.userData
      .instanceExpressIds as number[] | undefined;
    const modelId = firstHit.object.userData.modelId;
    const expressId = instanceExpressIds?.[firstHit.instanceId] ?? null;
    if (typeof modelId !== "number" || expressId === null) {
      return null;
    }
    return {
      modelId,
      expressId,
      point: firstHit.point.clone(),
      object: firstHit.object,
      instanceId: firstHit.instanceId,
    };
  }

  const expressId = firstHit.object.userData.expressId;
  const modelId = firstHit.object.userData.modelId;
  if (typeof expressId !== "number" || typeof modelId !== "number") {
    return null;
  }

  return {
    modelId,
    expressId,
    point: firstHit.point.clone(),
    object: firstHit.object as THREE.Mesh | THREE.InstancedMesh,
    instanceId: null,
  };
}

export function pickEntityAtPointer(
  pointer: THREE.Vector2,
  raycaster: THREE.Raycaster,
  camera: ViewCamera,
  sceneRoot: THREE.Group,
): number | null {
  return pickHitAtPointer(pointer, raycaster, camera, sceneRoot)?.expressId ?? null;
}
