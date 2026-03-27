import * as THREE from "three";
import { createModelEntityKey, type ModelEntityKey } from "@/utils/modelEntity";
import type { ViewCamera } from "./cameraMath";
import { isBoxFullyClipped, isPointClipped } from "./sectionCutUtils";

export interface RaycastHit {
  modelId: number;
  expressId: number;
  point: THREE.Vector3;
  faceNormal: THREE.Vector3 | null;
  object: THREE.Mesh | THREE.InstancedMesh | THREE.BatchedMesh;
  instanceId: number | null;
}

const _normalMatrix = new THREE.Matrix3();
const _tempMatrix4 = new THREE.Matrix4();

function extractFaceNormal(
  intersection: THREE.Intersection,
  obj: THREE.Object3D,
): THREE.Vector3 | null {
  if (!intersection.face) return null;
  const normal = intersection.face.normal.clone();

  if (obj instanceof THREE.BatchedMesh && intersection.batchId !== undefined) {
    obj.getMatrixAt(intersection.batchId, _tempMatrix4);
    _normalMatrix.getNormalMatrix(_tempMatrix4);
    return normal.applyMatrix3(_normalMatrix).normalize();
  }

  if (obj instanceof THREE.InstancedMesh && intersection.instanceId !== undefined) {
    obj.getMatrixAt(intersection.instanceId, _tempMatrix4);
    _tempMatrix4.premultiply(obj.matrixWorld);
    _normalMatrix.getNormalMatrix(_tempMatrix4);
    return normal.applyMatrix3(_normalMatrix).normalize();
  }

  _normalMatrix.getNormalMatrix(obj.matrixWorld);
  return normal.applyMatrix3(_normalMatrix).normalize();
}

function resolveHit(
  intersection: THREE.Intersection,
): RaycastHit | null {
  const obj = intersection.object;
  const faceNormal = extractFaceNormal(intersection, obj);

  // --- BatchedMesh: batchId maps to instance index in userData arrays ---
  if (
    obj instanceof THREE.BatchedMesh &&
    intersection.batchId !== undefined
  ) {
    const instanceExpressIds = obj.userData.instanceExpressIds as
      | number[]
      | undefined;
    const modelId = obj.userData.modelId;
    const expressId = instanceExpressIds?.[intersection.batchId] ?? null;
    if (typeof modelId !== "number" || expressId === null) return null;
    return {
      modelId,
      expressId,
      point: intersection.point.clone(),
      faceNormal,
      object: obj,
      instanceId: intersection.batchId,
    };
  }

  if (
    obj instanceof THREE.InstancedMesh &&
    intersection.instanceId !== undefined
  ) {
    const instanceExpressIds = obj.userData.instanceExpressIds as
      | number[]
      | undefined;
    const modelId = obj.userData.modelId;
    const expressId = instanceExpressIds?.[intersection.instanceId] ?? null;
    if (typeof modelId !== "number" || expressId === null) return null;
    return {
      modelId,
      expressId,
      point: intersection.point.clone(),
      faceNormal,
      object: obj,
      instanceId: intersection.instanceId,
    };
  }

  if (obj instanceof THREE.Mesh) {
    const expressId = obj.userData.expressId;
    const modelId = obj.userData.modelId;
    if (typeof expressId !== "number" || typeof modelId !== "number")
      return null;
    return {
      modelId,
      expressId,
      point: intersection.point.clone(),
      faceNormal,
      object: obj,
      instanceId: null,
    };
  }

  return null;
}

export function pickHitAtPointer(
  pointer: THREE.Vector2,
  raycaster: THREE.Raycaster,
  camera: ViewCamera,
  sceneRoot: THREE.Group,
  hiddenKeys?: Set<ModelEntityKey>,
  clippingPlanes: THREE.Plane[] = [],
): RaycastHit | null {
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(sceneRoot.children, true);

  for (const intersection of intersects) {
    const hit = resolveHit(intersection);
    if (!hit) continue;
    // Skip hidden entities so ray passes through to the object behind
    if (hiddenKeys?.has(createModelEntityKey(hit.modelId, hit.expressId))) {
      continue;
    }
    if (isPointClipped(hit.point, clippingPlanes)) {
      continue;
    }
    return hit;
  }

  return null;
}

export function pickEntityAtPointer(
  pointer: THREE.Vector2,
  raycaster: THREE.Raycaster,
  camera: ViewCamera,
  sceneRoot: THREE.Group,
  hiddenKeys?: Set<ModelEntityKey>,
  clippingPlanes: THREE.Plane[] = [],
): number | null {
  return pickHitAtPointer(
    pointer,
    raycaster,
    camera,
    sceneRoot,
    hiddenKeys,
    clippingPlanes,
  )?.expressId ?? null;
}

/* ------------------------------------------------------------------ */
/*  Box selection: project mesh bounding boxes to screen and test     */
/*  against a 2D selection rectangle (NDC coordinates).               */
/*  mode "window"   → object must be fully inside the box             */
/*  mode "crossing" → object only needs to intersect the box          */
/* ------------------------------------------------------------------ */

export interface BoxSelectionResult {
  modelId: number;
  expressId: number;
}

const _projected = new THREE.Vector3();
const _box3 = new THREE.Box3();
const _corners = Array.from({ length: 8 }, () => new THREE.Vector3());

/** Project a world-space Box3 to a 2D AABB in NDC ([-1,1]) space. */
function projectBox3ToNDC(
  box: THREE.Box3,
  camera: ViewCamera,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const { min, max } = box;
  _corners[0].set(min.x, min.y, min.z);
  _corners[1].set(min.x, min.y, max.z);
  _corners[2].set(min.x, max.y, min.z);
  _corners[3].set(min.x, max.y, max.z);
  _corners[4].set(max.x, min.y, min.z);
  _corners[5].set(max.x, min.y, max.z);
  _corners[6].set(max.x, max.y, min.z);
  _corners[7].set(max.x, max.y, max.z);

  let sMinX = Infinity, sMinY = Infinity;
  let sMaxX = -Infinity, sMaxY = -Infinity;
  let allBehind = true;

  for (const corner of _corners) {
    _projected.copy(corner).project(camera);
    // Skip points behind camera
    if (_projected.z > 1) continue;
    allBehind = false;
    sMinX = Math.min(sMinX, _projected.x);
    sMinY = Math.min(sMinY, _projected.y);
    sMaxX = Math.max(sMaxX, _projected.x);
    sMaxY = Math.max(sMaxY, _projected.y);
  }

  if (allBehind) return null;
  return { minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY };
}

/**
 * Pick all entities whose screen-space bounding boxes overlap a selection box.
 * selBox coords are in NDC [-1,1].
 */
export function pickEntitiesInBox(
  selMinX: number,
  selMinY: number,
  selMaxX: number,
  selMaxY: number,
  mode: "window" | "crossing",
  camera: ViewCamera,
  sceneRoot: THREE.Group,
  hiddenKeys?: Set<ModelEntityKey>,
  clippingPlanes: THREE.Plane[] = [],
): BoxSelectionResult[] {
  const hits = new Map<string, BoxSelectionResult>();

  const tempMatrix = new THREE.Matrix4();
  const tempBox = new THREE.Box3();

  sceneRoot.traverse((object) => {
    if (!object.visible) return;

    const modelId = object.userData.modelId;
    if (typeof modelId !== "number") return;

    // --- BatchedMesh: iterate instances via getBoundingBoxAt + getMatrixAt ---
    if (object instanceof THREE.BatchedMesh) {
      const instanceExpressIds = object.userData.instanceExpressIds as
        | number[]
        | undefined;
      if (!instanceExpressIds) return;

      for (let i = 0; i < instanceExpressIds.length; i++) {
        if (!object.getVisibleAt(i)) continue;
        const expressId = instanceExpressIds[i];
        if (expressId === undefined) continue;
        if (hiddenKeys?.has(createModelEntityKey(modelId, expressId))) continue;

        object.getMatrixAt(i, tempMatrix);
        const box = object.getBoundingBoxAt(i, tempBox);
        if (!box) continue;
        box.applyMatrix4(tempMatrix);
        if (isBoxFullyClipped(tempBox, clippingPlanes)) continue;

        const projected = projectBox3ToNDC(tempBox, camera);
        if (!projected) continue;

        const inside = testBoxOverlap(selMinX, selMinY, selMaxX, selMaxY, projected, mode);
        if (inside) {
          const key = `${modelId}:${expressId}`;
          if (!hits.has(key)) hits.set(key, { modelId, expressId });
        }
      }
      return;
    }

    // --- InstancedMesh (legacy fallback) ---
    if (object instanceof THREE.InstancedMesh) {
      const instanceExpressIds = object.userData.instanceExpressIds as
        | number[]
        | undefined;
      if (!instanceExpressIds) return;

      const baseGeomBox = new THREE.Box3();
      object.geometry.computeBoundingBox();
      if (!object.geometry.boundingBox) return;
      baseGeomBox.copy(object.geometry.boundingBox);

      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, tempMatrix);
        const det = tempMatrix.determinant();
        if (Math.abs(det) < 1e-10) continue;

        tempBox.copy(baseGeomBox).applyMatrix4(tempMatrix);
        tempBox.applyMatrix4(object.matrixWorld);
        if (isBoxFullyClipped(tempBox, clippingPlanes)) continue;

        const projected = projectBox3ToNDC(tempBox, camera);
        if (!projected) continue;

        const expressId = instanceExpressIds[i];
        if (expressId === undefined) continue;
        if (hiddenKeys?.has(createModelEntityKey(modelId, expressId))) continue;

        const inside = testBoxOverlap(selMinX, selMinY, selMaxX, selMaxY, projected, mode);
        if (inside) {
          const key = `${modelId}:${expressId}`;
          if (!hits.has(key)) hits.set(key, { modelId, expressId });
        }
      }
      return;
    }

    // --- Regular Mesh (transparent objects) ---
    if (!(object instanceof THREE.Mesh)) return;
    const expressId = object.userData.expressId;
    if (typeof expressId !== "number") return;
    if (hiddenKeys?.has(createModelEntityKey(modelId, expressId))) return;

    _box3.setFromObject(object);
    if (isBoxFullyClipped(_box3, clippingPlanes)) return;
    const projected = projectBox3ToNDC(_box3, camera);
    if (!projected) return;

    const inside = testBoxOverlap(selMinX, selMinY, selMaxX, selMaxY, projected, mode);
    if (inside) {
      const key = `${modelId}:${expressId}`;
      if (!hits.has(key)) hits.set(key, { modelId, expressId });
    }
  });

  return [...hits.values()];
}

function testBoxOverlap(
  selMinX: number, selMinY: number, selMaxX: number, selMaxY: number,
  obj: { minX: number; minY: number; maxX: number; maxY: number },
  mode: "window" | "crossing",
): boolean {
  if (mode === "window") {
    // Object must be fully contained
    return (
      obj.minX >= selMinX && obj.maxX <= selMaxX &&
      obj.minY >= selMinY && obj.maxY <= selMaxY
    );
  }
  // Crossing: any overlap
  return !(
    obj.maxX < selMinX || obj.minX > selMaxX ||
    obj.maxY < selMinY || obj.minY > selMaxY
  );
}
