import * as THREE from "three";
import type {
  ClippingPlaneDraft,
  ClippingPlaneObject,
} from "@/stores/slices/clippingSlice";
import type { RaycastHit } from "./raycasting";

export type ResizeHandleType =
  | "resize-n"
  | "resize-s"
  | "resize-e"
  | "resize-w"
  | "resize-ne"
  | "resize-nw"
  | "resize-se"
  | "resize-sw";

const WORLD_UP = new THREE.Vector3(0, 0, 1);
const WORLD_SIDE = new THREE.Vector3(0, 1, 0);
const AXIS_SELECTION_ORDER = [
  [1, 2],
  [2, 0],
  [0, 1],
] as const;
const EPSILON = 1e-6;

function tupleToVector3(value: [number, number, number]) {
  return new THREE.Vector3(...value);
}

function vector3ToTuple(value: THREE.Vector3): [number, number, number] {
  return [value.x, value.y, value.z];
}

export function getPlaneBasisFromNormal(normal: THREE.Vector3) {
  const n = normal.clone().normalize();
  const ref = Math.abs(n.dot(WORLD_UP)) > 0.94 ? WORLD_SIDE : WORLD_UP;
  const uAxis = new THREE.Vector3().crossVectors(ref, n).normalize();
  const vAxis = new THREE.Vector3().crossVectors(n, uAxis).normalize();
  return { uAxis, vAxis, normal: n };
}

function getHitWorldMatrix(hit: Pick<RaycastHit, "object" | "instanceId">) {
  const matrix = new THREE.Matrix4();

  if (hit.object instanceof THREE.BatchedMesh && hit.instanceId !== null) {
    hit.object.getMatrixAt(hit.instanceId, matrix);
    return matrix;
  }

  if (hit.object instanceof THREE.InstancedMesh && hit.instanceId !== null) {
    hit.object.getMatrixAt(hit.instanceId, matrix);
    matrix.premultiply(hit.object.matrixWorld);
    return matrix;
  }

  return hit.object.matrixWorld.clone();
}

function getHitAxes(hit: Pick<RaycastHit, "object" | "instanceId">) {
  const matrix = getHitWorldMatrix(hit);
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const zAxis = new THREE.Vector3();

  matrix.extractBasis(xAxis, yAxis, zAxis);

  const axes = [xAxis, yAxis, zAxis].map((axis) => {
    if (axis.lengthSq() <= EPSILON) {
      return null;
    }
    return axis.normalize();
  });

  if (axes[0] && axes[1] && axes[2]) {
    return axes as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  }

  return null;
}

function getPlaneBasisFromHit(hit: RaycastHit) {
  const objectAxes = getHitAxes(hit);
  if (!objectAxes) {
    return getPlaneBasisFromNormal(hit.faceNormal ?? WORLD_UP);
  }

  const targetNormal = hit.faceNormal?.clone().normalize() ?? objectAxes[2].clone();
  let bestAxisIndex = 2;
  let bestAxisDot = -1;
  let bestAxisSign = 1;

  objectAxes.forEach((axis, index) => {
    const dot = targetNormal.dot(axis);
    const absoluteDot = Math.abs(dot);
    if (absoluteDot > bestAxisDot) {
      bestAxisDot = absoluteDot;
      bestAxisIndex = index;
      bestAxisSign = dot >= 0 ? 1 : -1;
    }
  });

  const [uAxisIndex, vAxisIndex] = AXIS_SELECTION_ORDER[bestAxisIndex];
  const normal = objectAxes[bestAxisIndex].clone().multiplyScalar(bestAxisSign);
  const uAxis = objectAxes[uAxisIndex].clone();
  const vAxis = objectAxes[vAxisIndex].clone();

  if (bestAxisSign < 0) {
    uAxis.negate();
  }

  return { normal, uAxis, vAxis };
}

export function getPlaneQuaternion(plane: Pick<ClippingPlaneObject, "uAxis" | "vAxis" | "normal">) {
  const basis = new THREE.Matrix4().makeBasis(
    tupleToVector3(plane.uAxis).normalize(),
    tupleToVector3(plane.vAxis).normalize(),
    tupleToVector3(plane.normal).normalize(),
  );
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

export function createDraftFromHit(
  hit: RaycastHit,
): ClippingPlaneDraft {
  const { uAxis, vAxis, normal } = getPlaneBasisFromHit(hit);

  return {
    stage: "first-point",
    anchor: vector3ToTuple(hit.point),
    origin: vector3ToTuple(hit.point),
    normal: vector3ToTuple(normal),
    uAxis: vector3ToTuple(uAxis),
    vAxis: vector3ToTuple(vAxis),
    width: 0,
    height: 0,
  };
}

export function projectRayOntoPlane(
  ray: THREE.Ray,
  origin: THREE.Vector3,
  normal: THREE.Vector3,
) {
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    normal.clone().normalize(),
    origin,
  );
  const target = new THREE.Vector3();
  return ray.intersectPlane(plane, target) ? target : null;
}

export function updateDraftFromPoint(
  draft: ClippingPlaneDraft,
  worldPoint: THREE.Vector3,
  minSize: number,
): ClippingPlaneDraft {
  if (!draft.anchor || !draft.uAxis || !draft.vAxis || !draft.origin || !draft.normal) {
    return draft;
  }

  const anchor = tupleToVector3(draft.anchor);
  const uAxis = tupleToVector3(draft.uAxis);
  const vAxis = tupleToVector3(draft.vAxis);
  const delta = worldPoint.clone().sub(anchor);
  const width = Math.max(minSize, Math.abs(delta.dot(uAxis)));
  const height = Math.max(minSize, Math.abs(delta.dot(vAxis)));

  const offsetU = uAxis.clone().multiplyScalar(delta.dot(uAxis) * 0.5);
  const offsetV = vAxis.clone().multiplyScalar(delta.dot(vAxis) * 0.5);
  const origin = anchor.clone().add(offsetU).add(offsetV);

  return {
    ...draft,
    stage: "second-point",
    origin: vector3ToTuple(origin),
    width,
    height,
  };
}

export function getPlaneHandleWorldPosition(
  plane: Pick<ClippingPlaneObject, "origin" | "uAxis" | "vAxis" | "width" | "height">,
  handleType: ResizeHandleType,
) {
  const origin = tupleToVector3(plane.origin);
  const uAxis = tupleToVector3(plane.uAxis).normalize();
  const vAxis = tupleToVector3(plane.vAxis).normalize();
  const halfWidth = plane.width * 0.5;
  const halfHeight = plane.height * 0.5;

  let horizontal = 0;
  let vertical = 0;

  if (handleType.includes("e")) horizontal = 1;
  if (handleType.includes("w")) horizontal = -1;
  if (handleType.includes("n")) vertical = 1;
  if (handleType.includes("s")) vertical = -1;

  return origin
    .clone()
    .addScaledVector(uAxis, horizontal * halfWidth)
    .addScaledVector(vAxis, vertical * halfHeight);
}

export function resizePlaneFromHandle(
  plane: Pick<ClippingPlaneObject, "origin" | "uAxis" | "vAxis" | "width" | "height">,
  handleType: ResizeHandleType,
  worldPoint: THREE.Vector3,
  minSize: number,
) {
  const origin = tupleToVector3(plane.origin);
  const uAxis = tupleToVector3(plane.uAxis).normalize();
  const vAxis = tupleToVector3(plane.vAxis).normalize();
  const delta = worldPoint.clone().sub(origin);

  let width = plane.width;
  let height = plane.height;
  const nextOrigin = origin.clone();

  if (handleType.includes("e") || handleType.includes("w")) {
    const sign = handleType.includes("e") ? 1 : -1;
    const target = delta.dot(uAxis);
    width = Math.max(minSize, (plane.width * 0.5 + target * sign) * 2);
    nextOrigin.addScaledVector(uAxis, target * 0.5);
  }

  if (handleType.includes("n") || handleType.includes("s")) {
    const sign = handleType.includes("n") ? 1 : -1;
    const target = delta.dot(vAxis);
    height = Math.max(minSize, (plane.height * 0.5 + target * sign) * 2);
    nextOrigin.addScaledVector(vAxis, target * 0.5);
  }

  return {
    origin: vector3ToTuple(nextOrigin),
    width,
    height,
  };
}
