import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ViewCamera } from "./cameraMath";

export function formatScaleLabel(worldSize: number) {
  if (worldSize >= 1000) {
    return `${(worldSize / 1000).toFixed(1)}km`;
  }

  if (worldSize >= 1) {
    return `${worldSize.toFixed(1)}m`;
  }

  if (worldSize >= 0.1) {
    return `${(worldSize * 100).toFixed(0)}cm`;
  }

  return `${(worldSize * 1000).toFixed(0)}mm`;
}

export function calculateScaleBarWorldSize(
  camera: ViewCamera,
  cameraDistance: number,
  viewportHeight: number,
) {
  const scaleBarPixels = 96;
  if (camera instanceof THREE.OrthographicCamera) {
    return (
      (scaleBarPixels / viewportHeight) *
      ((camera.top - camera.bottom) / camera.zoom)
    );
  }

  const fov = THREE.MathUtils.degToRad(camera.fov);
  return (
    (scaleBarPixels / viewportHeight) *
    (cameraDistance * Math.tan(fov / 2) * 2)
  );
}

export function getCameraOverlayRotation(camera: ViewCamera, controls: OrbitControls) {
  const offset = camera.position.clone().sub(controls.target);
  const radius = Math.max(offset.length(), 0.0001);
  const azimuth = THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z));
  const elevation = THREE.MathUtils.radToDeg(Math.asin(offset.y / radius));

  return {
    rotationX: -elevation,
    rotationY: -azimuth,
    distance: radius,
  };
}
