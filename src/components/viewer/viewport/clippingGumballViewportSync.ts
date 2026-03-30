import * as THREE from "three";
import type { ClippingPlaneObject } from "@/stores/slices/clippingSlice";
import type { ViewCamera } from "./cameraMath";
import {
  calculateGumballWorldScale,
  type GumballComponents,
  updateGumballTransform,
} from "./gumball";
import { getPlaneQuaternion } from "./clippingMath";

interface SyncClippingGumballViewportScaleParams {
  gumball: GumballComponents | null;
  camera: ViewCamera | null;
  renderer: Pick<THREE.WebGLRenderer, "domElement"> | null;
  plane: ClippingPlaneObject | null;
}

export function syncClippingGumballViewportScale({
  gumball,
  camera,
  renderer,
  plane,
}: SyncClippingGumballViewportScaleParams) {
  if (!gumball || !camera || !renderer || !plane || !plane.enabled || plane.locked) {
    return false;
  }

  const viewportHeight = Math.max(renderer.domElement.clientHeight, 1);
  const position = new THREE.Vector3(...plane.origin);
  const scale = calculateGumballWorldScale(camera, position, viewportHeight);

  updateGumballTransform(
    gumball,
    position,
    getPlaneQuaternion(plane),
    scale,
  );

  return true;
}
