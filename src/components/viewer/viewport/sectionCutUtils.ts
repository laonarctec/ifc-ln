import * as THREE from "three";

export const CLIPPING_EPSILON = 1e-5;
export const SECTION_QUANTIZATION = 1e4;

const BOX_CORNERS = Array.from({ length: 8 }, () => new THREE.Vector3());

export function getQuantizedScalar(
  value: number,
  precision: number = SECTION_QUANTIZATION,
) {
  return Math.round(value * precision);
}

export function getQuantizedPointKey(
  point: THREE.Vector3,
  precision: number = SECTION_QUANTIZATION,
) {
  return [
    getQuantizedScalar(point.x, precision),
    getQuantizedScalar(point.y, precision),
    getQuantizedScalar(point.z, precision),
  ].join(":");
}

export function getQuantizedSegmentKey(startKey: string, endKey: string) {
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

export function isPointClipped(
  point: THREE.Vector3,
  clippingPlanes: THREE.Plane[],
) {
  return clippingPlanes.some(
    (plane) => plane.distanceToPoint(point) > CLIPPING_EPSILON,
  );
}

export function isBoxFullyClipped(
  box: THREE.Box3,
  clippingPlanes: THREE.Plane[],
) {
  if (clippingPlanes.length === 0 || box.isEmpty()) {
    return false;
  }

  const { min, max } = box;
  BOX_CORNERS[0].set(min.x, min.y, min.z);
  BOX_CORNERS[1].set(min.x, min.y, max.z);
  BOX_CORNERS[2].set(min.x, max.y, min.z);
  BOX_CORNERS[3].set(min.x, max.y, max.z);
  BOX_CORNERS[4].set(max.x, min.y, min.z);
  BOX_CORNERS[5].set(max.x, min.y, max.z);
  BOX_CORNERS[6].set(max.x, max.y, min.z);
  BOX_CORNERS[7].set(max.x, max.y, max.z);

  return clippingPlanes.some((plane) =>
    BOX_CORNERS.every(
      (corner) => plane.distanceToPoint(corner) > CLIPPING_EPSILON,
    ),
  );
}
