import * as THREE from "three";
import type { GumballHandleType } from "./gumball";

const EPSILON = 1e-6;
const WORLD_UP = new THREE.Vector3(0, 0, 1);
const WORLD_FORWARD = new THREE.Vector3(0, 1, 0);

export interface GumballPlaneState {
  origin: THREE.Vector3;
  uAxis: THREE.Vector3;
  vAxis: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  height: number;
}

export function buildAxisDragPlane(
  origin: THREE.Vector3,
  axis: THREE.Vector3,
  cameraDirection: THREE.Vector3,
) {
  const alignedAxis = axis.clone().normalize();
  const alignedView = cameraDirection.clone().normalize();
  const planeNormal = new THREE.Vector3()
    .crossVectors(alignedAxis, new THREE.Vector3().crossVectors(alignedView, alignedAxis));

  if (planeNormal.lengthSq() <= EPSILON) {
    planeNormal.crossVectors(alignedAxis, WORLD_UP);
  }
  if (planeNormal.lengthSq() <= EPSILON) {
    planeNormal.crossVectors(alignedAxis, WORLD_FORWARD);
  }

  return new THREE.Plane().setFromNormalAndCoplanarPoint(
    planeNormal.normalize(),
    origin,
  );
}

export function buildPlanarDragPlane(
  origin: THREE.Vector3,
  axisA: THREE.Vector3,
  axisB: THREE.Vector3,
) {
  const normal = new THREE.Vector3().crossVectors(axisA, axisB).normalize();
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
}

export function projectAxisTranslationOffset(
  startPoint: THREE.Vector3,
  currentPoint: THREE.Vector3,
  axis: THREE.Vector3,
) {
  return currentPoint.clone().sub(startPoint).dot(axis.clone().normalize());
}

export function projectPlanarTranslationOffset(
  startPoint: THREE.Vector3,
  currentPoint: THREE.Vector3,
  axisA: THREE.Vector3,
  axisB: THREE.Vector3,
) {
  const delta = currentPoint.clone().sub(startPoint);
  const alignedA = axisA.clone().normalize();
  const alignedB = axisB.clone().normalize();
  return {
    offsetA: delta.dot(alignedA),
    offsetB: delta.dot(alignedB),
  };
}

export function computeRotationAngle(
  origin: THREE.Vector3,
  startPoint: THREE.Vector3,
  currentPoint: THREE.Vector3,
  axis: THREE.Vector3,
) {
  const alignedAxis = axis.clone().normalize();
  const startDirection = startPoint.clone().sub(origin).projectOnPlane(alignedAxis);
  const currentDirection = currentPoint.clone().sub(origin).projectOnPlane(alignedAxis);

  if (startDirection.lengthSq() <= EPSILON || currentDirection.lengthSq() <= EPSILON) {
    return 0;
  }

  startDirection.normalize();
  currentDirection.normalize();

  let angle = Math.acos(
    THREE.MathUtils.clamp(startDirection.dot(currentDirection), -1, 1),
  );
  const cross = new THREE.Vector3().crossVectors(startDirection, currentDirection);
  if (cross.dot(alignedAxis) < 0) {
    angle = -angle;
  }
  return angle;
}

export function resizePlaneFromGumballHandle(
  plane: GumballPlaneState,
  handleType: GumballHandleType,
  worldPoint: THREE.Vector3,
  minSize: number,
) {
  const safeMinSize = Math.max(minSize, EPSILON);
  const delta = worldPoint.clone().sub(plane.origin);
  const nextWidth = Math.max(safeMinSize, Math.abs(delta.dot(plane.uAxis)) * 2);
  const nextHeight = Math.max(safeMinSize, Math.abs(delta.dot(plane.vAxis)) * 2);

  switch (handleType) {
    case "resize-x":
      return { width: nextWidth, height: plane.height };
    case "resize-y":
      return { width: plane.width, height: nextHeight };
    case "resize-xy":
      return { width: nextWidth, height: nextHeight };
    default:
      return { width: plane.width, height: plane.height };
  }
}
