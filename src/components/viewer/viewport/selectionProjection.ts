import * as THREE from "three";
import type { ViewCamera } from "./cameraMath";
import { CLIPPING_EPSILON } from "./sectionCutUtils";

const PROJECTED_POINT = new THREE.Vector3();
const BOX_CORNERS = Array.from({ length: 8 }, () => new THREE.Vector3());
const BOX_FACE_CORNER_INDICES = [
  [0, 1, 3, 2],
  [4, 6, 7, 5],
  [0, 4, 5, 1],
  [2, 3, 7, 6],
  [0, 2, 6, 4],
  [1, 5, 7, 3],
] as const;

export interface ProjectedBounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function setBoxCorners(box: THREE.Box3) {
  const { min, max } = box;
  BOX_CORNERS[0].set(min.x, min.y, min.z);
  BOX_CORNERS[1].set(min.x, min.y, max.z);
  BOX_CORNERS[2].set(min.x, max.y, min.z);
  BOX_CORNERS[3].set(min.x, max.y, max.z);
  BOX_CORNERS[4].set(max.x, min.y, min.z);
  BOX_CORNERS[5].set(max.x, min.y, max.z);
  BOX_CORNERS[6].set(max.x, max.y, min.z);
  BOX_CORNERS[7].set(max.x, max.y, max.z);
}

function projectPointsToNDC(
  points: readonly THREE.Vector3[],
  camera: ViewCamera,
): ProjectedBounds2D | null {
  let sMinX = Infinity, sMinY = Infinity;
  let sMaxX = -Infinity, sMaxY = -Infinity;
  let allBehind = true;

  for (const point of points) {
    PROJECTED_POINT.copy(point).project(camera);
    if (PROJECTED_POINT.z > 1) continue;
    allBehind = false;
    sMinX = Math.min(sMinX, PROJECTED_POINT.x);
    sMinY = Math.min(sMinY, PROJECTED_POINT.y);
    sMaxX = Math.max(sMaxX, PROJECTED_POINT.x);
    sMaxY = Math.max(sMaxY, PROJECTED_POINT.y);
  }

  if (allBehind) {
    return null;
  }

  return { minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY };
}

function clipPolygonToPlane(
  polygon: readonly THREE.Vector3[],
  plane: THREE.Plane,
) {
  if (polygon.length === 0) {
    return [];
  }

  const result: THREE.Vector3[] = [];
  let previousPoint = polygon[polygon.length - 1]!;
  let previousDistance = plane.distanceToPoint(previousPoint);
  let previousInside = previousDistance >= -CLIPPING_EPSILON;

  for (const point of polygon) {
    const distance = plane.distanceToPoint(point);
    const inside = distance >= -CLIPPING_EPSILON;

    if (inside !== previousInside) {
      const denominator = previousDistance - distance;
      if (Math.abs(denominator) > CLIPPING_EPSILON) {
        const t = previousDistance / denominator;
        result.push(previousPoint.clone().lerp(point, t));
      }
    }

    if (inside) {
      result.push(point.clone());
    }

    previousPoint = point;
    previousDistance = distance;
    previousInside = inside;
  }

  return result;
}

export function projectClippedBoxToNDC(
  box: THREE.Box3,
  camera: ViewCamera,
  clippingPlanes: THREE.Plane[] = [],
): ProjectedBounds2D | null {
  setBoxCorners(box);

  if (clippingPlanes.length === 0) {
    return projectPointsToNDC(BOX_CORNERS, camera);
  }

  const visiblePoints: THREE.Vector3[] = [];

  for (const faceCornerIndices of BOX_FACE_CORNER_INDICES) {
    let polygon = faceCornerIndices.map((index) => BOX_CORNERS[index]!.clone());
    for (const plane of clippingPlanes) {
      polygon = clipPolygonToPlane(polygon, plane);
      if (polygon.length === 0) {
        break;
      }
    }
    visiblePoints.push(...polygon);
  }

  if (visiblePoints.length === 0) {
    return null;
  }

  return projectPointsToNDC(visiblePoints, camera);
}
