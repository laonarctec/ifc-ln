import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import type {
  TransferableMeshData,
  RenderChunkPayload,
  RenderManifest,
} from "@/types/worker-messages";

// --- Types ---

export interface GeometryCacheEntry {
  geometry: THREE.BufferGeometry;
  refCount: number;
}

export interface RenderEntry {
  expressId: number;
  object: THREE.Mesh | THREE.InstancedMesh;
  baseColor: THREE.Color;
  baseOpacity: number;
  instanceIndex: number | null;
  baseMatrix: THREE.Matrix4;
  geometryExpressId: number;
}

export interface ChunkRenderGroup {
  group: THREE.Group;
  entries: RenderEntry[];
  materials: THREE.Material[];
}

export interface InstanceGroup {
  key: string;
  items: TransferableMeshData[];
}

export type ViewCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

// --- Constants & BVH Setup ---

export const HIDDEN_SCALE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
export const SELECTION_HIGHLIGHT_COLOR = new THREE.Color("#88ccff");
export const SELECTION_WHITE_COLOR = new THREE.Color("#ffffff");

const bvhExtensions = THREE.BufferGeometry.prototype as THREE.BufferGeometry & {
  computeBoundsTree?: typeof computeBoundsTree;
  disposeBoundsTree?: typeof disposeBoundsTree;
};

if (bvhExtensions.computeBoundsTree !== computeBoundsTree) {
  bvhExtensions.computeBoundsTree = computeBoundsTree;
  bvhExtensions.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

// --- Camera ---

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

// --- Geometry & Bounds ---

export function getWebGLBlockReason() {
  const canvas = document.createElement("canvas");
  const webgl2Context = canvas.getContext("webgl2");
  const releaseContext = (
    context: WebGLRenderingContext | WebGL2RenderingContext | null,
  ) => {
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  };
  if (webgl2Context) {
    releaseContext(webgl2Context);
    return null;
  }

  const webglContext =
    canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");

  if (webglContext) {
    releaseContext(webglContext as WebGLRenderingContext);
    return null;
  }

  return "\uD604\uC7AC \uBE0C\uB77C\uC6B0\uC800 \uB610\uB294 \uC2E4\uD589 \uD658\uACBD\uC5D0\uC11C WebGL\uC774 \uBE44\uD65C\uC131\uD654\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.";
}

export function createRenderableGeometry(mesh: TransferableMeshData) {
  const stride = 6;
  const vertexCount = Math.floor(mesh.vertices.length / stride);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);

  for (let i = 0; i < vertexCount; i += 1) {
    const sourceIndex = i * stride;
    const targetIndex = i * 3;

    positions[targetIndex] = mesh.vertices[sourceIndex];
    positions[targetIndex + 1] = mesh.vertices[sourceIndex + 1];
    positions[targetIndex + 2] = mesh.vertices[sourceIndex + 2];

    normals[targetIndex] = mesh.vertices[sourceIndex + 3] ?? 0;
    normals[targetIndex + 1] = mesh.vertices[sourceIndex + 4] ?? 1;
    normals[targetIndex + 2] = mesh.vertices[sourceIndex + 5] ?? 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  (
    geometry as THREE.BufferGeometry & {
      computeBoundsTree?: (options?: object) => unknown;
    }
  ).computeBoundsTree?.({
    maxLeafSize: 24,
  });
  return geometry;
}

export function getOrCreateGeometry(
  mesh: TransferableMeshData,
  geometryCache: Map<number, GeometryCacheEntry>,
) {
  const cached = geometryCache.get(mesh.geometryExpressId);
  if (cached) {
    cached.refCount += 1;
    return cached.geometry;
  }

  const geometry = createRenderableGeometry(mesh);
  geometryCache.set(mesh.geometryExpressId, {
    geometry,
    refCount: 1,
  });
  return geometry;
}

export function boundsFromTuple(
  bounds: [number, number, number, number, number, number],
) {
  return new THREE.Box3(
    new THREE.Vector3(bounds[0], bounds[1], bounds[2]),
    new THREE.Vector3(bounds[3], bounds[4], bounds[5]),
  );
}

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

export function expandBoundsForEntry(bounds: THREE.Box3, entry: RenderEntry) {
  const geometryBounds = entry.object.geometry.boundingBox;
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

// --- Mesh Management ---

export function colorKey(mesh: TransferableMeshData) {
  return mesh.color.map((value) => value.toFixed(4)).join(":");
}

export function groupMeshes(meshes: TransferableMeshData[]) {
  const grouped = new Map<string, InstanceGroup>();

  for (const mesh of meshes) {
    if (mesh.vertices.length < 6 || mesh.indices.length === 0) {
      continue;
    }

    const key = `${mesh.geometryExpressId}:${colorKey(mesh)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.items.push(mesh);
      continue;
    }

    grouped.set(key, {
      key,
      items: [mesh],
    });
  }

  return [...grouped.values()];
}

export function indexRenderEntry(
  entryIndex: Map<number, RenderEntry[]>,
  entry: RenderEntry,
) {
  const existing = entryIndex.get(entry.expressId);
  if (existing) {
    existing.push(entry);
    return;
  }

  entryIndex.set(entry.expressId, [entry]);
}

export function removeIndexedRenderEntry(
  entryIndex: Map<number, RenderEntry[]>,
  entry: RenderEntry,
) {
  const existing = entryIndex.get(entry.expressId);
  if (!existing) {
    return;
  }

  const filtered = existing.filter((candidate) => candidate !== entry);
  if (filtered.length === 0) {
    entryIndex.delete(entry.expressId);
    return;
  }

  entryIndex.set(entry.expressId, filtered);
}

// --- Visual State ---

export function setEntryVisualState(
  entry: RenderEntry,
  isHidden: boolean,
  isSelected: boolean,
  dirtyInstancedMeshes?: Set<THREE.InstancedMesh>,
) {
  if (entry.object instanceof THREE.InstancedMesh) {
    const targetMatrix = isHidden ? HIDDEN_SCALE_MATRIX : entry.baseMatrix;
    entry.object.setMatrixAt(entry.instanceIndex ?? 0, targetMatrix);

    const color = entry.baseColor.clone();
    if (isSelected) {
      color.lerp(SELECTION_HIGHLIGHT_COLOR, 0.45);
    }
    entry.object.setColorAt(entry.instanceIndex ?? 0, color);
    dirtyInstancedMeshes?.add(entry.object);
    return;
  }

  const material = entry.object.material;
  if (!(material instanceof THREE.MeshPhongMaterial)) {
    return;
  }

  entry.object.visible = !isHidden;
  material.color.copy(entry.baseColor);
  material.opacity = entry.baseOpacity;
  material.transparent = entry.baseOpacity < 1;
  material.emissive.setRGB(
    isSelected ? 0.3 : 0,
    isSelected ? 0.6 : 0,
    isSelected ? 1.0 : 0,
  );
  material.emissiveIntensity = isSelected ? 0.6 : 0;

  if (isSelected) {
    material.color.lerp(SELECTION_WHITE_COLOR, 0.4);
    material.opacity = 1;
    material.transparent = false;
  }
}

export function appendMeshesToGroup(
  meshes: TransferableMeshData[],
  group: THREE.Group,
  geometryCache: Map<number, GeometryCacheEntry>,
  entryIndex: Map<number, RenderEntry[]>,
  selectedEntityIds: number[],
  hiddenEntityIds: number[],
) {
  const hiddenSet = new Set(hiddenEntityIds);
  const selectedSet = new Set(selectedEntityIds);
  const entries: RenderEntry[] = [];
  const materials: THREE.Material[] = [];
  const dirtyInstancedMeshes = new Set<THREE.InstancedMesh>();

  for (const instanceGroup of groupMeshes(meshes)) {
    const [first] = instanceGroup.items;
    const geometry = getOrCreateGeometry(first, geometryCache);
    const baseColor = new THREE.Color(
      first.color[0],
      first.color[1],
      first.color[2],
    );
    const baseOpacity = first.color[3];

    if (instanceGroup.items.length === 1) {
      const material = new THREE.MeshPhongMaterial({
        color: baseColor.clone(),
        transparent: baseOpacity < 1,
        opacity: baseOpacity,
        shininess: 30,
        side: THREE.FrontSide,
      });
      materials.push(material);

      const object = new THREE.Mesh(geometry, material);
      object.matrixAutoUpdate = false;
      object.matrix.fromArray(first.transform);
      object.updateMatrixWorld(true);
      object.userData.expressId = first.expressId;
      group.add(object);

      const entry: RenderEntry = {
        expressId: first.expressId,
        object,
        baseColor,
        baseOpacity,
        instanceIndex: null,
        baseMatrix: object.matrix.clone(),
        geometryExpressId: first.geometryExpressId,
      };
      setEntryVisualState(
        entry,
        hiddenSet.has(first.expressId),
        selectedSet.has(first.expressId),
      );
      entries.push(entry);
      indexRenderEntry(entryIndex, entry);
      continue;
    }

    const material = new THREE.MeshPhongMaterial({
      color: "#ffffff",
      transparent: baseOpacity < 1,
      opacity: baseOpacity,
      shininess: 30,
      side: THREE.FrontSide,
    });
    materials.push(material);

    const instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      instanceGroup.items.length,
    );
    instancedMesh.frustumCulled = false;
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.userData.instanceExpressIds = instanceGroup.items.map(
      (item) => item.expressId,
    );

    instanceGroup.items.forEach((item, index) => {
      const matrix = new THREE.Matrix4().fromArray(item.transform);
      const itemColor = new THREE.Color(
        item.color[0],
        item.color[1],
        item.color[2],
      );
      instancedMesh.setMatrixAt(index, matrix);
      instancedMesh.setColorAt(index, itemColor);

      const entry: RenderEntry = {
        expressId: item.expressId,
        object: instancedMesh,
        baseColor: itemColor,
        baseOpacity,
        instanceIndex: index,
        baseMatrix: matrix,
        geometryExpressId: item.geometryExpressId,
      };
      setEntryVisualState(
        entry,
        hiddenSet.has(item.expressId),
        selectedSet.has(item.expressId),
        dirtyInstancedMeshes,
      );
      entries.push(entry);
      indexRenderEntry(entryIndex, entry);
    });

    dirtyInstancedMeshes.add(instancedMesh);
    group.add(instancedMesh);
  }

  dirtyInstancedMeshes.forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return { entries, materials };
}

export function updateMeshVisualState(
  entryIndex: Map<number, RenderEntry[]>,
  previousSelectedSet: Set<number>,
  previousHiddenSet: Set<number>,
  currentSelectedSet: Set<number>,
  currentHiddenSet: Set<number>,
) {
  const changedEntityIds = new Set<number>();

  previousSelectedSet.forEach((entityId) => {
    if (!currentSelectedSet.has(entityId)) {
      changedEntityIds.add(entityId);
    }
  });
  currentSelectedSet.forEach((entityId) => {
    if (!previousSelectedSet.has(entityId)) {
      changedEntityIds.add(entityId);
    }
  });

  previousHiddenSet.forEach((entityId) => {
    if (!currentHiddenSet.has(entityId)) {
      changedEntityIds.add(entityId);
    }
  });
  currentHiddenSet.forEach((entityId) => {
    if (!previousHiddenSet.has(entityId)) {
      changedEntityIds.add(entityId);
    }
  });

  const dirtyInstancedMeshes = new Set<THREE.InstancedMesh>();
  changedEntityIds.forEach((entityId) => {
    entryIndex.get(entityId)?.forEach((entry) => {
      setEntryVisualState(
        entry,
        currentHiddenSet.has(entityId),
        currentSelectedSet.has(entityId),
        dirtyInstancedMeshes,
      );
    });
  });

  dirtyInstancedMeshes.forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return {
    currentSelectedSet,
    currentHiddenSet,
  };
}

// --- Overlay ---

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

// --- Interaction ---

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

// --- Raycasting ---

export function pickEntityAtPointer(
  pointer: THREE.Vector2,
  raycaster: THREE.Raycaster,
  camera: ViewCamera,
  sceneRoot: THREE.Group,
): number | null {
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(sceneRoot.children, true);
  const firstHit = intersects.find(
    (intersection) =>
      intersection.object instanceof THREE.Mesh ||
      intersection.object instanceof THREE.InstancedMesh,
  );

  if (!firstHit) {
    return null;
  }

  if (
    firstHit.object instanceof THREE.InstancedMesh &&
    firstHit.instanceId !== undefined
  ) {
    const instanceExpressIds = firstHit.object.userData
      .instanceExpressIds as number[] | undefined;
    return instanceExpressIds?.[firstHit.instanceId] ?? null;
  }

  const expressId = firstHit.object.userData.expressId;
  return typeof expressId === "number" ? expressId : null;
}
