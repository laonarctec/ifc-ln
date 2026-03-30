import * as THREE from "three";
import { createModelEntityKey, type ModelEntityKey } from "@/utils/modelEntity";
import type { ViewCamera } from "./cameraMath";
import { isBoxFullyClipped } from "./sectionCutUtils";
import { projectClippedBoxToNDC } from "./selectionProjection";
export {
  pickEntityAtPointer,
  pickHitAtPointer,
  pickPointerResultAtPointer,
  type PointerPickResult,
  type RaycastHit,
} from "./pointerPicking";

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

const _box3 = new THREE.Box3();
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

        const projected = projectClippedBoxToNDC(tempBox, camera, clippingPlanes);
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

        const projected = projectClippedBoxToNDC(tempBox, camera, clippingPlanes);
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
    const projected = projectClippedBoxToNDC(_box3, camera, clippingPlanes);
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
