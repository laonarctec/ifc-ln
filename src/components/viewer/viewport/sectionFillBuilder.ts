import * as THREE from "three";
import { Earcut } from "three/src/extras/Earcut.js";
import type { SectionClosedLoop } from "./sectionEdgeBuilder";

function getPlaneBasis(normal: THREE.Vector3) {
  const n = normal.clone().normalize();
  const ref =
    Math.abs(n.dot(new THREE.Vector3(0, 0, 1))) > 0.94
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
  const uAxis = new THREE.Vector3().crossVectors(ref, n).normalize();
  const vAxis = new THREE.Vector3().crossVectors(n, uAxis).normalize();
  return { uAxis, vAxis };
}

export function buildSectionFillGeometry(
  loops: SectionClosedLoop[],
  planeNormal: THREE.Vector3,
): number[] {
  if (loops.length === 0) {
    return [];
  }

  const { uAxis, vAxis } = getPlaneBasis(planeNormal);
  const positions: number[] = [];

  for (const loop of loops) {
    if (loop.points.length < 3) {
      continue;
    }

    const flatCoords: number[] = [];
    for (const point of loop.points) {
      flatCoords.push(point.dot(uAxis), point.dot(vAxis));
    }

    const indices = Earcut.triangulate(flatCoords, [], 2);

    for (const index of indices) {
      const point = loop.points[index];
      if (point) {
        positions.push(point.x, point.y, point.z);
      }
    }
  }

  return positions;
}

export function offsetSectionFillPositions(
  positions: number[],
  planeNormal: THREE.Vector3,
  offsetDistance: number,
): number[] {
  if (positions.length === 0) {
    return [];
  }

  if (Math.abs(offsetDistance) <= Number.EPSILON) {
    return [...positions];
  }

  const normal = planeNormal.clone().normalize();
  const shifted = [...positions];

  for (let index = 0; index < shifted.length; index += 3) {
    shifted[index] += normal.x * offsetDistance;
    shifted[index + 1] += normal.y * offsetDistance;
    shifted[index + 2] += normal.z * offsetDistance;
  }

  return shifted;
}
