import * as THREE from "three";
import { createModelEntityKey, type ModelEntityKey } from "@/utils/modelEntity";
import type { ViewCamera } from "./cameraMath";
import { isPointClipped } from "./sectionCutUtils";
import { isSelectionBlocked } from "./selectionBlockers";

export interface RaycastHit {
  modelId: number;
  expressId: number;
  point: THREE.Vector3;
  faceNormal: THREE.Vector3 | null;
  object: THREE.Mesh | THREE.InstancedMesh | THREE.BatchedMesh;
  instanceId: number | null;
}

export type PointerPickResult =
  | { kind: "blocked" }
  | { kind: "miss" }
  | { kind: "hit"; hit: RaycastHit };

const NORMAL_MATRIX = new THREE.Matrix3();
const TEMP_MATRIX4 = new THREE.Matrix4();

function extractFaceNormal(
  intersection: THREE.Intersection,
  object: THREE.Object3D,
): THREE.Vector3 | null {
  if (!intersection.face) {
    return null;
  }

  const normal = intersection.face.normal.clone();

  if (object instanceof THREE.BatchedMesh && intersection.batchId !== undefined) {
    object.getMatrixAt(intersection.batchId, TEMP_MATRIX4);
    NORMAL_MATRIX.getNormalMatrix(TEMP_MATRIX4);
    return normal.applyMatrix3(NORMAL_MATRIX).normalize();
  }

  if (
    object instanceof THREE.InstancedMesh &&
    intersection.instanceId !== undefined
  ) {
    object.getMatrixAt(intersection.instanceId, TEMP_MATRIX4);
    TEMP_MATRIX4.premultiply(object.matrixWorld);
    NORMAL_MATRIX.getNormalMatrix(TEMP_MATRIX4);
    return normal.applyMatrix3(NORMAL_MATRIX).normalize();
  }

  NORMAL_MATRIX.getNormalMatrix(object.matrixWorld);
  return normal.applyMatrix3(NORMAL_MATRIX).normalize();
}

function resolveHit(intersection: THREE.Intersection): RaycastHit | null {
  const object = intersection.object;
  const faceNormal = extractFaceNormal(intersection, object);

  if (object instanceof THREE.BatchedMesh && intersection.batchId !== undefined) {
    const instanceExpressIds = object.userData.instanceExpressIds as
      | number[]
      | undefined;
    const modelId = object.userData.modelId;
    const expressId = instanceExpressIds?.[intersection.batchId] ?? null;
    if (typeof modelId !== "number" || expressId === null) {
      return null;
    }
    return {
      modelId,
      expressId,
      point: intersection.point.clone(),
      faceNormal,
      object,
      instanceId: intersection.batchId,
    };
  }

  if (
    object instanceof THREE.InstancedMesh &&
    intersection.instanceId !== undefined
  ) {
    const instanceExpressIds = object.userData.instanceExpressIds as
      | number[]
      | undefined;
    const modelId = object.userData.modelId;
    const expressId = instanceExpressIds?.[intersection.instanceId] ?? null;
    if (typeof modelId !== "number" || expressId === null) {
      return null;
    }
    return {
      modelId,
      expressId,
      point: intersection.point.clone(),
      faceNormal,
      object,
      instanceId: intersection.instanceId,
    };
  }

  if (object instanceof THREE.Mesh) {
    const expressId = object.userData.expressId;
    const modelId = object.userData.modelId;
    if (typeof expressId !== "number" || typeof modelId !== "number") {
      return null;
    }
    return {
      modelId,
      expressId,
      point: intersection.point.clone(),
      faceNormal,
      object,
      instanceId: null,
    };
  }

  return null;
}

export function pickPointerResultAtPointer(
  pointer: THREE.Vector2,
  raycaster: THREE.Raycaster,
  camera: ViewCamera,
  raycastRoot: THREE.Object3D,
  hiddenKeys?: Set<ModelEntityKey>,
  clippingPlanes: THREE.Plane[] = [],
): PointerPickResult {
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(raycastRoot.children, true);

  for (const intersection of intersections) {
    if (isSelectionBlocked(intersection.object)) {
      return { kind: "blocked" };
    }

    const hit = resolveHit(intersection);
    if (!hit) {
      continue;
    }

    if (hiddenKeys?.has(createModelEntityKey(hit.modelId, hit.expressId))) {
      continue;
    }

    if (isPointClipped(hit.point, clippingPlanes)) {
      continue;
    }

    return { kind: "hit", hit };
  }

  return { kind: "miss" };
}

export function pickHitAtPointer(
  pointer: THREE.Vector2,
  raycaster: THREE.Raycaster,
  camera: ViewCamera,
  raycastRoot: THREE.Object3D,
  hiddenKeys?: Set<ModelEntityKey>,
  clippingPlanes: THREE.Plane[] = [],
): RaycastHit | null {
  const result = pickPointerResultAtPointer(
    pointer,
    raycaster,
    camera,
    raycastRoot,
    hiddenKeys,
    clippingPlanes,
  );

  return result.kind === "hit" ? result.hit : null;
}

export function pickEntityAtPointer(
  pointer: THREE.Vector2,
  raycaster: THREE.Raycaster,
  camera: ViewCamera,
  raycastRoot: THREE.Object3D,
  hiddenKeys?: Set<ModelEntityKey>,
  clippingPlanes: THREE.Plane[] = [],
): number | null {
  return pickHitAtPointer(
    pointer,
    raycaster,
    camera,
    raycastRoot,
    hiddenKeys,
    clippingPlanes,
  )?.expressId ?? null;
}
