import * as THREE from "three";
import type { ViewCamera } from "./cameraMath";

export function pickEntityAtPointer(
  pointer: THREE.Vector2,
  raycaster: THREE.Raycaster,
  camera: ViewCamera,
  sceneRoot: THREE.Group,
): number | null {
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
    return instanceExpressIds?.[firstHit.instanceId] ?? null;
  }

  const expressId = firstHit.object.userData.expressId;
  return typeof expressId === "number" ? expressId : null;
}
