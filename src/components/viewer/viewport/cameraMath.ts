import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { RenderManifest } from "@/types/worker-messages";
import type { RenderEntry } from "./meshManagement";

export type ViewCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

// --- Aspect / Frustum ---

export function getCameraAspect(camera: ViewCamera) {
  if (camera instanceof THREE.PerspectiveCamera) {
    return camera.aspect;
  }

  const height = Math.max(camera.top - camera.bottom, 0.0001);
  return Math.max((camera.right - camera.left) / height, 0.0001);
}

export function setCameraAspect(camera: ViewCamera, aspect: number) {
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = aspect;
    return;
  }

  camera.userData.viewportAspect = aspect;
}

export function updateOrthographicFrustum(
  camera: THREE.OrthographicCamera,
  halfHeight: number,
) {
  const safeHalfHeight = Math.max(halfHeight, 0.5);
  const aspect = Math.max(
    camera.userData.viewportAspect ?? getCameraAspect(camera),
    0.0001,
  );
  const halfWidth = safeHalfHeight * aspect;
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = safeHalfHeight;
  camera.bottom = -safeHalfHeight;
}

// --- Bounds helpers ---

export function boundsFromTuple(
  bounds: [number, number, number, number, number, number],
) {
  return new THREE.Box3(
    new THREE.Vector3(bounds[0], bounds[1], bounds[2]),
    new THREE.Vector3(bounds[3], bounds[4], bounds[5]),
  );
}

export function expandBoundsForEntry(bounds: THREE.Box3, entry: RenderEntry) {
  // For BatchedMesh entries, use stored per-geometry bounds;
  // for individual Mesh, fall back to the object's geometry bounds.
  const geometryBounds =
    entry.geometryBounds ?? entry.object.geometry?.boundingBox;
  if (!geometryBounds) {
    return;
  }

  const transformedBounds = geometryBounds
    .clone()
    .applyMatrix4(entry.baseMatrix);
  bounds.union(transformedBounds);
}

export function buildBoundsForEntries(
  meshEntries: RenderEntry[],
  hiddenEntityIds: number[] = [],
) {
  const hiddenSet = new Set(hiddenEntityIds);
  const bounds = new THREE.Box3();

  meshEntries.forEach((entry) => {
    if (hiddenSet.has(entry.expressId)) {
      return;
    }

    expandBoundsForEntry(bounds, entry);
  });

  if (!bounds.isEmpty()) {
    return bounds;
  }

  meshEntries.forEach((entry) => {
    expandBoundsForEntry(bounds, entry);
  });

  return bounds;
}

// --- Fit camera ---

export function fitCameraToBounds(
  camera: ViewCamera,
  controls: OrbitControls,
  bounds: THREE.Box3,
) {
  fitCameraToBoundsWithDirection(
    camera,
    controls,
    bounds,
    new THREE.Vector3(1, 0.75, 1),
  );
}

export function fitCameraToBoundsWithDirection(
  camera: ViewCamera,
  controls: OrbitControls,
  bounds: THREE.Box3,
  direction: THREE.Vector3,
) {
  if (bounds.isEmpty()) {
    camera.position.set(12, 10, 12);
    controls.target.set(0, 0, 0);
    if (camera instanceof THREE.OrthographicCamera) {
      updateOrthographicFrustum(camera, 12);
      camera.zoom = 1;
    }
    controls.update();
    camera.updateProjectionMatrix();
    return;
  }

  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  const normalizedDirection = direction.clone().normalize();

  if (camera instanceof THREE.PerspectiveCamera) {
    const fitHeightDistance =
      maxDimension / (2 * Math.tan((Math.PI * camera.fov) / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = 1.18 * Math.max(fitHeightDistance, fitWidthDistance);

    camera.near = Math.max(distance / 100, 0.1);
    camera.far = Math.max(distance * 120, 2400);
    camera.position
      .copy(center)
      .addScaledVector(normalizedDirection, distance);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    controls.target.copy(center);
    controls.minDistance = Math.max(distance * 0.08, 0.2);
    controls.maxDistance = distance * 12;
    controls.update();
    return;
  }

  const distance = Math.max(maxDimension * 2.4, 24);
  camera.position.copy(center).addScaledVector(normalizedDirection, distance);
  camera.near = 0.1;
  camera.far = Math.max(distance * 24, 2400);
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();

  camera.updateMatrixWorld(true);
  const inverseMatrix = camera.matrixWorldInverse.clone();
  const corners = [
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
    new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
    new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
    new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
  ];

  let maxX = 0;
  let maxY = 0;
  for (const corner of corners) {
    corner.applyMatrix4(inverseMatrix);
    maxX = Math.max(maxX, Math.abs(corner.x));
    maxY = Math.max(maxY, Math.abs(corner.y));
  }

  const halfHeight = Math.max(
    maxY * 1.18,
    (maxX * 1.18) / getCameraAspect(camera),
    0.5,
  );
  updateOrthographicFrustum(camera, halfHeight);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  controls.minDistance = Math.max(distance * 0.08, 0.2);
  controls.maxDistance = distance * 12;
  controls.update();
}

// --- Zoom / Orbit ---

export function zoomCamera(
  camera: ViewCamera,
  controls: OrbitControls,
  factor: number,
) {
  if (camera instanceof THREE.OrthographicCamera) {
    camera.zoom = THREE.MathUtils.clamp(camera.zoom / factor, 0.2, 24);
    camera.updateProjectionMatrix();
    controls.update();
    return;
  }

  const offset = camera.position.clone().sub(controls.target);
  if (offset.lengthSq() === 0) {
    return;
  }

  const nextOffset = offset.multiplyScalar(factor);
  const nextDistance = nextOffset.length();

  camera.position.copy(controls.target).add(nextOffset);
  camera.near = Math.max(nextDistance / 100, 0.1);
  camera.far = Math.max(nextDistance * 120, 2400);
  camera.updateProjectionMatrix();
  controls.update();
}

export function orbitCamera(
  camera: ViewCamera,
  controls: OrbitControls,
  deltaX: number,
  deltaY: number,
) {
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);

  spherical.theta -= deltaX * 0.008;
  spherical.phi += deltaY * 0.008;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.08, Math.PI - 0.08);

  offset.setFromSpherical(spherical);
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
  controls.update();
}

// --- Frustum visibility ---

export function calculateVisibleChunkIds(
  camera: ViewCamera,
  manifest: RenderManifest,
) {
  const projectionMatrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    projectionMatrix,
  );

  return manifest.chunks
    .filter((chunk) => frustum.intersectsBox(boundsFromTuple(chunk.bounds)))
    .map((chunk) => chunk.chunkId)
    .sort((left, right) => left - right);
}
