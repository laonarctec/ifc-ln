import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from 'three-mesh-bvh';
import { useViewerStore } from '@/stores';
import type { ViewportCommand } from '@/stores/slices/uiSlice';
import type { TransferableMeshData } from '@/types/worker-messages';
import type { AxisHelperRef } from './AxisHelper';
import { ViewportOverlays } from './ViewportOverlays';
import type { ViewCubeRef } from './ViewCube';

interface ViewportSceneProps {
  meshes: TransferableMeshData[];
  selectedEntityIds: number[];
  hiddenEntityIds: number[];
  viewportCommand: ViewportCommand;
  onSelectEntity: (expressId: number | null, additive?: boolean) => void;
}

interface GeometryCacheEntry {
  geometry: THREE.BufferGeometry;
  refCount: number;
}

interface RenderEntry {
  expressId: number;
  object: THREE.Mesh | THREE.InstancedMesh;
  baseColor: THREE.Color;
  baseOpacity: number;
  instanceIndex: number | null;
  baseMatrix: THREE.Matrix4;
}

interface InstanceGroup {
  key: string;
  items: TransferableMeshData[];
}

const HIDDEN_SCALE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

const bvhExtensions = THREE.BufferGeometry.prototype as THREE.BufferGeometry & {
  computeBoundsTree?: typeof computeBoundsTree;
  disposeBoundsTree?: typeof disposeBoundsTree;
};

if (bvhExtensions.computeBoundsTree !== computeBoundsTree) {
  bvhExtensions.computeBoundsTree = computeBoundsTree;
  bvhExtensions.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

function getWebGLBlockReason() {
  const canvas = document.createElement('canvas');
  const webgl2Context = canvas.getContext('webgl2');
  if (webgl2Context) {
    return null;
  }

  const webglContext = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');

  if (webglContext) {
    return null;
  }

  return '현재 브라우저 또는 실행 환경에서 WebGL이 비활성화되어 있습니다.';
}

function createRenderableGeometry(mesh: TransferableMeshData) {
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
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  (geometry as THREE.BufferGeometry & { computeBoundsTree?: (options?: object) => unknown }).computeBoundsTree?.({
    maxLeafSize: 24,
  });
  return geometry;
}

function getOrCreateGeometry(
  mesh: TransferableMeshData,
  geometryCache: Map<number, GeometryCacheEntry>
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

function fitCameraToBounds(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  bounds: THREE.Box3
) {
  fitCameraToBoundsWithDirection(camera, controls, bounds, new THREE.Vector3(1, 0.75, 1));
}

function fitCameraToBoundsWithDirection(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  bounds: THREE.Box3,
  direction: THREE.Vector3
) {
  if (bounds.isEmpty()) {
    camera.position.set(12, 10, 12);
    controls.target.set(0, 0, 0);
    controls.update();
    return;
  }

  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  const fitHeightDistance = maxDimension / (2 * Math.tan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = 1.18 * Math.max(fitHeightDistance, fitWidthDistance);
  const normalizedDirection = direction.clone().normalize();

  camera.near = Math.max(distance / 100, 0.1);
  camera.far = Math.max(distance * 120, 2400);
  camera.position.copy(center).addScaledVector(normalizedDirection, distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.minDistance = Math.max(distance * 0.08, 0.2);
  controls.maxDistance = distance * 12;
  controls.update();
}

function colorKey(mesh: TransferableMeshData) {
  return mesh.color.map((value) => value.toFixed(4)).join(':');
}

function groupMeshes(meshes: TransferableMeshData[]) {
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

function setEntryVisualState(entry: RenderEntry, isHidden: boolean, isSelected: boolean) {
  if (entry.object instanceof THREE.InstancedMesh) {
    const targetMatrix = isHidden ? HIDDEN_SCALE_MATRIX : entry.baseMatrix;
    entry.object.setMatrixAt(entry.instanceIndex ?? 0, targetMatrix);

    const color = entry.baseColor.clone();
    if (isSelected) {
      color.lerp(new THREE.Color('#ffffff'), 0.18);
    }
    entry.object.setColorAt(entry.instanceIndex ?? 0, color);
    entry.object.instanceMatrix.needsUpdate = true;
    if (entry.object.instanceColor) {
      entry.object.instanceColor.needsUpdate = true;
    }
    return;
  }

  const material = entry.object.material;
  if (!(material instanceof THREE.MeshStandardMaterial)) {
    return;
  }

  entry.object.visible = !isHidden;
  material.color.copy(entry.baseColor);
  material.opacity = entry.baseOpacity;
  material.transparent = entry.baseOpacity < 1;
  material.emissive.set(isSelected ? '#2563eb' : '#000000');
  material.emissiveIntensity = isSelected ? 0.28 : 0;

  if (isSelected) {
    material.color.lerp(new THREE.Color('#ffffff'), 0.14);
    material.opacity = 1;
    material.transparent = false;
  }
}

function updateMeshVisualState(
  meshEntries: RenderEntry[],
  selectedEntityIds: number[],
  hiddenEntityIds: number[]
) {
  const hiddenSet = new Set(hiddenEntityIds);
  const selectedSet = new Set(selectedEntityIds);

  for (const entry of meshEntries) {
    const isHidden = hiddenSet.has(entry.expressId);
    const isSelected = selectedSet.has(entry.expressId);
    setEntryVisualState(entry, isHidden, isSelected);
  }
}

function expandBoundsForEntry(bounds: THREE.Box3, entry: RenderEntry) {
  const geometryBounds = entry.object.geometry.boundingBox;
  if (!geometryBounds) {
    return;
  }

  const transformedBounds = geometryBounds.clone().applyMatrix4(entry.baseMatrix);
  bounds.union(transformedBounds);
}

function buildBoundsForEntries(meshEntries: RenderEntry[], hiddenEntityIds: number[] = []) {
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

function formatScaleLabel(worldSize: number) {
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

function calculateScaleBarWorldSize(camera: THREE.PerspectiveCamera, cameraDistance: number, viewportHeight: number) {
  const scaleBarPixels = 96;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  return (scaleBarPixels / viewportHeight) * (cameraDistance * Math.tan(fov / 2) * 2);
}

function getCameraOverlayRotation(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
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

function zoomCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls, factor: number) {
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

function orbitCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls, deltaX: number, deltaY: number) {
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

export function ViewportScene({
  meshes,
  selectedEntityIds,
  hiddenEntityIds,
  viewportCommand,
  onSelectEntity,
}: ViewportSceneProps) {
  const setFrameRate = useViewerStore((state) => state.setFrameRate);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const meshEntriesRef = useRef<RenderEntry[]>([]);
  const groupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const onSelectEntityRef = useRef(onSelectEntity);
  const selectedEntityIdsRef = useRef(selectedEntityIds);
  const hiddenEntityIdsRef = useRef(hiddenEntityIds);
  const lastHandledViewportCommandSeqRef = useRef(0);
  const viewCubeRef = useRef<ViewCubeRef | null>(null);
  const axisHelperRef = useRef<AxisHelperRef | null>(null);
  const lastScaleValueRef = useRef(0);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [scaleLabel, setScaleLabel] = useState('10m');

  const homeToFit = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    fitCameraToBounds(camera, controls, buildBoundsForEntries(meshEntriesRef.current, hiddenEntityIdsRef.current));
  }, []);

  const fitAllCurrentView = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    const direction = camera.position.clone().sub(controls.target);
    if (direction.lengthSq() === 0) {
      direction.set(1, 0.75, 1);
    }

    fitCameraToBoundsWithDirection(
      camera,
      controls,
      buildBoundsForEntries(meshEntriesRef.current, hiddenEntityIdsRef.current),
      direction
    );
  }, []);

  const setPresetView = useCallback((view: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    const directionMap: Record<typeof view, THREE.Vector3> = {
      front: new THREE.Vector3(0, 0, 1),
      back: new THREE.Vector3(0, 0, -1),
      left: new THREE.Vector3(-1, 0, 0),
      right: new THREE.Vector3(1, 0, 0),
      top: new THREE.Vector3(0.0001, 1, 0.0001),
      bottom: new THREE.Vector3(0.0001, -1, 0.0001),
    };

    fitCameraToBoundsWithDirection(
      camera,
      controls,
      buildBoundsForEntries(meshEntriesRef.current, hiddenEntityIdsRef.current),
      directionMap[view]
    );
  }, []);

  const zoomIn = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    zoomCamera(camera, controls, 0.84);
  }, []);

  const zoomOut = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    zoomCamera(camera, controls, 1.2);
  }, []);

  const orbitFromViewCube = useCallback((deltaX: number, deltaY: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    orbitCamera(camera, controls, deltaX, deltaY);
  }, []);

  useEffect(() => {
    onSelectEntityRef.current = onSelectEntity;
  }, [onSelectEntity]);

  useEffect(() => {
    selectedEntityIdsRef.current = selectedEntityIds;
  }, [selectedEntityIds]);

  useEffect(() => {
    hiddenEntityIdsRef.current = hiddenEntityIds;
  }, [hiddenEntityIds]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (meshes.length === 0) {
      setFrameRate(null);
      return;
    }

    setRendererError(null);
    const webglBlockReason = getWebGLBlockReason();
    if (webglBlockReason) {
      setRendererError(webglBlockReason);
      setFrameRate(null);
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#edf4fb');

    const camera = new THREE.PerspectiveCamera(
      48,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      5000
    );
    camera.position.set(12, 10, 12);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      setRendererError(
        error instanceof Error ? error.message : '현재 환경에서 WebGL 컨텍스트를 만들 수 없습니다.'
      );
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.autoClear = false;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.78;
    controls.zoomSpeed = 1.08;
    controls.panSpeed = 0.92;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.HemisphereLight('#f8fbff', '#cbd5e1', 1.55));

    const keyLight = new THREE.DirectionalLight('#ffffff', 1.45);
    keyLight.position.set(16, 28, 18);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#dbeafe', 0.92);
    fillLight.position.set(-18, 16, -12);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#bfdbfe', 0.72);
    rimLight.position.set(10, 8, -24);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(140, 28, '#cbd5e1', '#e5edf6');
    const gridMaterial = grid.material;
    if (Array.isArray(gridMaterial)) {
      gridMaterial.forEach((material) => {
        material.transparent = true;
        material.opacity = 0.36;
      });
    } else {
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.36;
    }
    scene.add(grid);

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;
    cameraRef.current = camera;
    controlsRef.current = controls;

    const meshEntries: RenderEntry[] = [];
    const geometryCache = new Map<number, GeometryCacheEntry>();
    const materials = new Set<THREE.Material>();

    for (const instanceGroup of groupMeshes(meshes)) {
      const [first] = instanceGroup.items;
      const geometry = getOrCreateGeometry(first, geometryCache);
      const baseColor = new THREE.Color(first.color[0], first.color[1], first.color[2]);
      const baseOpacity = first.color[3];

      if (instanceGroup.items.length === 1) {
        const material = new THREE.MeshStandardMaterial({
          color: baseColor.clone(),
          transparent: baseOpacity < 1,
          opacity: baseOpacity,
          metalness: 0.06,
          roughness: 0.64,
          side: THREE.DoubleSide,
        });
        materials.add(material);

        const object = new THREE.Mesh(geometry, material);
        object.matrixAutoUpdate = false;
        object.matrix.fromArray(first.transform);
        object.userData.expressId = first.expressId;
        group.add(object);

        meshEntries.push({
          expressId: first.expressId,
          object,
          baseColor,
          baseOpacity,
          instanceIndex: null,
          baseMatrix: object.matrix.clone(),
        });
        continue;
      }

      const material = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        transparent: baseOpacity < 1,
        opacity: baseOpacity,
        metalness: 0.06,
        roughness: 0.64,
        side: THREE.DoubleSide,
      });
      materials.add(material);

      const instancedMesh = new THREE.InstancedMesh(geometry, material, instanceGroup.items.length);
      instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instancedMesh.userData.instanceExpressIds = instanceGroup.items.map((item) => item.expressId);

      instanceGroup.items.forEach((item, index) => {
        const matrix = new THREE.Matrix4().fromArray(item.transform);
        const itemColor = new THREE.Color(item.color[0], item.color[1], item.color[2]);
        instancedMesh.setMatrixAt(index, matrix);
        instancedMesh.setColorAt(index, itemColor);

        meshEntries.push({
          expressId: item.expressId,
          object: instancedMesh,
          baseColor: itemColor,
          baseOpacity,
          instanceIndex: index,
          baseMatrix: matrix,
        });
      });

      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.needsUpdate = true;
      }
      group.add(instancedMesh);
    }

    meshEntriesRef.current = meshEntries;
    updateMeshVisualState(meshEntriesRef.current, selectedEntityIds, hiddenEntityIds);
    fitCameraToBounds(camera, controls, buildBoundsForEntries(meshEntriesRef.current, hiddenEntityIds));

    const raycaster = new THREE.Raycaster();
    (raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const pointer = new THREE.Vector2();
    let pointerIsDown = false;
    let didDrag = false;
    let pointerDownX = 0;
    let pointerDownY = 0;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      pointerIsDown = true;
      didDrag = false;
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerIsDown) {
        return;
      }

      const deltaX = event.clientX - pointerDownX;
      const deltaY = event.clientY - pointerDownY;
      if (Math.hypot(deltaX, deltaY) > 4) {
        didDrag = true;
      }
    };

    const handlePointerUp = () => {
      pointerIsDown = false;
    };

    const handleClick = (event: MouseEvent) => {
      if (didDrag) {
        didDrag = false;
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(group.children, true);
      const firstHit = intersects.find(
        (intersection) =>
          intersection.object instanceof THREE.Mesh || intersection.object instanceof THREE.InstancedMesh
      );

      if (!firstHit) {
        if (!event.shiftKey) {
          onSelectEntityRef.current(null);
        }
        return;
      }

      if (firstHit.object instanceof THREE.InstancedMesh && firstHit.instanceId !== undefined) {
        const instanceExpressIds = firstHit.object.userData.instanceExpressIds as number[] | undefined;
        const expressId = instanceExpressIds?.[firstHit.instanceId];
        onSelectEntityRef.current(typeof expressId === 'number' ? expressId : null, event.shiftKey);
        return;
      }

      const expressId = firstHit.object.userData.expressId;
      onSelectEntityRef.current(typeof expressId === 'number' ? expressId : null, event.shiftKey);
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('click', handleClick);

    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    let animationFrame = 0;
    let fpsSampleStart = performance.now();
    let fpsSampleFrames = 0;
    const renderFrame = () => {
      controls.update();
      const viewportWidth = Math.max(1, container.clientWidth);
      const viewportHeight = Math.max(1, container.clientHeight);

      renderer.setViewport(0, 0, viewportWidth, viewportHeight);
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.render(scene, camera);

      const { distance, rotationX, rotationY } = getCameraOverlayRotation(camera, controls);
      viewCubeRef.current?.updateRotation(rotationX, rotationY);
      axisHelperRef.current?.updateRotation(rotationX, rotationY);

      const worldScale = calculateScaleBarWorldSize(camera, distance, viewportHeight);
      const scaleDelta = lastScaleValueRef.current === 0
        ? 1
        : Math.abs(worldScale - lastScaleValueRef.current) / lastScaleValueRef.current;
      if (scaleDelta > 0.01) {
        lastScaleValueRef.current = worldScale;
        setScaleLabel(formatScaleLabel(worldScale));
      }

      fpsSampleFrames += 1;
      const now = performance.now();
      if (now - fpsSampleStart >= 250) {
        setFrameRate(Math.round((fpsSampleFrames * 1000) / (now - fpsSampleStart)));
        fpsSampleStart = now;
        fpsSampleFrames = 0;
      }

      animationFrame = window.requestAnimationFrame(renderFrame);
    };
    renderFrame();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();

      materials.forEach((material) => material.dispose());
      geometryCache.forEach(({ geometry }) => {
        (geometry as THREE.BufferGeometry & { disposeBoundsTree?: () => void }).disposeBoundsTree?.();
        geometry.dispose();
      });
      meshEntriesRef.current = [];
      groupRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      setFrameRate(null);
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [meshes, setFrameRate]);

  useEffect(() => {
    updateMeshVisualState(meshEntriesRef.current, selectedEntityIds, hiddenEntityIds);
  }, [hiddenEntityIds, selectedEntityIds]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const group = groupRef.current;

    if (!camera || !controls || !group || viewportCommand.type === 'none') {
      return;
    }

    if (viewportCommand.seq <= lastHandledViewportCommandSeqRef.current) {
      return;
    }

    lastHandledViewportCommandSeqRef.current = viewportCommand.seq;

    if (viewportCommand.type === 'home') {
      homeToFit();
      return;
    }

    if (
      viewportCommand.type === 'view-front' ||
      viewportCommand.type === 'view-right' ||
      viewportCommand.type === 'view-top' ||
      viewportCommand.type === 'view-iso'
    ) {
      if (viewportCommand.type === 'view-front') {
        setPresetView('front');
      } else if (viewportCommand.type === 'view-right') {
        setPresetView('right');
      } else if (viewportCommand.type === 'view-top') {
        setPresetView('top');
      } else {
        fitCameraToBoundsWithDirection(
          camera,
          controls,
          buildBoundsForEntries(meshEntriesRef.current, hiddenEntityIdsRef.current),
          new THREE.Vector3(1, 0.75, 1)
        );
      }
      return;
    }

    if (viewportCommand.type === 'fit-selected' && selectedEntityIds.length > 0) {
      const selectedEntries = meshEntriesRef.current.filter(
        (entry) =>
          selectedEntityIdsRef.current.includes(entry.expressId) &&
          !hiddenEntityIdsRef.current.includes(entry.expressId)
      );
      if (selectedEntries.length === 0) {
        return;
      }

      const selectedBounds = new THREE.Box3();
      selectedEntries.forEach((entry) => {
        expandBoundsForEntry(selectedBounds, entry);
      });
      fitCameraToBounds(camera, controls, selectedBounds);
    }
  }, [homeToFit, setPresetView, viewportCommand, selectedEntityIds.length]);

  return (
    <div ref={containerRef} className="viewer-viewport__canvas">
      <ViewportOverlays
        axisHelperRef={axisHelperRef}
        scaleLabel={scaleLabel}
        onFitAll={fitAllCurrentView}
        onHome={homeToFit}
        onViewChange={setPresetView}
        onViewCubeDrag={orbitFromViewCube}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        viewCubeRef={viewCubeRef}
      />
      {rendererError && (
        <div className="viewer-viewport__webgl-fallback">
          <h2>WebGL을 사용할 수 없습니다</h2>
          <p>현재 브라우저 환경에서 3D 렌더러를 초기화하지 못했습니다.</p>
          <p>{rendererError}</p>
          <p>브라우저 하드웨어 가속 또는 WebGL 설정을 확인한 뒤 다시 시도해 주세요.</p>
        </div>
      )}
    </div>
  );
}
