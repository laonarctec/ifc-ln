/**
 * BCF viewpoint <-> Three.js camera conversion.
 * BCF uses Z-up coordinate system, Three.js uses Y-up.
 */
import type { BcfViewpointCamera } from "./bcfService";

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Y-up (Three.js) -> Z-up (BCF)
function toZUp(v: Vec3): Vec3 {
  return { x: v.x, y: -v.z, z: v.y };
}

// Z-up (BCF) -> Y-up (Three.js)
function toYUp(v: Vec3): Vec3 {
  return { x: v.x, y: v.z, z: -v.y };
}

export interface ThreeCameraState {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  fov: number;
  isPerspective: boolean;
}

export function threeCameraToBcfViewpoint(camera: ThreeCameraState): BcfViewpointCamera {
  const pos = toZUp(camera.position);
  const tgt = toZUp(camera.target);

  const dx = tgt.x - pos.x;
  const dy = tgt.y - pos.y;
  const dz = tgt.z - pos.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

  return {
    viewPoint: pos,
    direction: { x: dx / len, y: dy / len, z: dz / len },
    upVector: toZUp(camera.up),
    fieldOfView: camera.isPerspective ? camera.fov : undefined,
    type: camera.isPerspective ? "perspective" : "orthographic",
  };
}

export function bcfViewpointToThreeCamera(vp: BcfViewpointCamera): ThreeCameraState {
  const position = toYUp(vp.viewPoint);
  const dir = toYUp(vp.direction);
  const up = toYUp(vp.upVector);

  // Compute target at unit distance from position
  const target = {
    x: position.x + dir.x,
    y: position.y + dir.y,
    z: position.z + dir.z,
  };

  return {
    position,
    target,
    up,
    fov: vp.fieldOfView ?? 60,
    isPerspective: vp.type === "perspective",
  };
}
