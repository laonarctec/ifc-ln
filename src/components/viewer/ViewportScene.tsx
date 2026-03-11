import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from 'three-mesh-bvh';
import type { ViewportCommand } from '@/stores/slices/uiSlice';
import type { TransferableMeshData } from '@/types/worker-messages';

interface ViewportSceneProps {
  meshes: TransferableMeshData[];
  selectedEntityId: number | null;
  hiddenEntityIds: number[];
  viewportCommand: ViewportCommand;
  onSelectEntity: (expressId: number | null) => void;
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

function fitCameraToObject(camera: THREE.PerspectiveCamera, controls: OrbitControls, object: THREE.Object3D) {
  const bounds = new THREE.Box3().setFromObject(object);
  fitCameraToBounds(camera, controls, bounds);
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
  const distance = 1.4 * Math.max(fitHeightDistance, fitWidthDistance);
  const normalizedDirection = direction.clone().normalize();

  camera.near = Math.max(distance / 100, 0.1);
  camera.far = Math.max(distance * 100, 2000);
  camera.position.copy(center).addScaledVector(normalizedDirection, distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.maxDistance = distance * 8;
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
  selectedEntityId: number | null,
  hiddenEntityIds: number[]
) {
  const hiddenSet = new Set(hiddenEntityIds);

  for (const entry of meshEntries) {
    const isHidden = hiddenSet.has(entry.expressId);
    const isSelected = selectedEntityId !== null && entry.expressId === selectedEntityId;
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

export function ViewportScene({
  meshes,
  selectedEntityId,
  hiddenEntityIds,
  viewportCommand,
  onSelectEntity,
}: ViewportSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const meshEntriesRef = useRef<RenderEntry[]>([]);
  const groupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    setRendererError(null);
    const webglBlockReason = getWebGLBlockReason();
    if (webglBlockReason) {
      setRendererError(webglBlockReason);
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f7f9fc');

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
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight('#ffffff', 1.8));

    const keyLight = new THREE.DirectionalLight('#ffffff', 1.15);
    keyLight.position.set(16, 28, 18);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#dbeafe', 0.5);
    fillLight.position.set(-12, 10, -10);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(120, 24, '#e2e8f0', '#edf2f7');
    const gridMaterial = grid.material;
    if (Array.isArray(gridMaterial)) {
      gridMaterial.forEach((material) => {
        material.transparent = true;
        material.opacity = 0.28;
      });
    } else {
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.28;
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
          metalness: 0.03,
          roughness: 0.82,
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
        metalness: 0.03,
        roughness: 0.82,
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
    updateMeshVisualState(meshEntriesRef.current, selectedEntityId, hiddenEntityIds);
    fitCameraToObject(camera, controls, group);

    const raycaster = new THREE.Raycaster();
    (raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const pointer = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
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
        onSelectEntity(null);
        return;
      }

      if (firstHit.object instanceof THREE.InstancedMesh && firstHit.instanceId !== undefined) {
        const instanceExpressIds = firstHit.object.userData.instanceExpressIds as number[] | undefined;
        const expressId = instanceExpressIds?.[firstHit.instanceId];
        onSelectEntity(typeof expressId === 'number' ? expressId : null);
        return;
      }

      const expressId = firstHit.object.userData.expressId;
      onSelectEntity(typeof expressId === 'number' ? expressId : null);
    };

    renderer.domElement.addEventListener('click', handleClick);

    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.render(scene, camera);
    });
    resizeObserver.observe(container);

    let animationFrame = 0;
    const renderFrame = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(renderFrame);
    };
    renderFrame();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
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
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [meshes, onSelectEntity]);

  useEffect(() => {
    updateMeshVisualState(meshEntriesRef.current, selectedEntityId, hiddenEntityIds);
  }, [hiddenEntityIds, selectedEntityId]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const group = groupRef.current;

    if (!camera || !controls || !group || viewportCommand.type === 'none') {
      return;
    }

    if (viewportCommand.type === 'home') {
      fitCameraToObject(camera, controls, group);
      return;
    }

    if (
      viewportCommand.type === 'view-front' ||
      viewportCommand.type === 'view-right' ||
      viewportCommand.type === 'view-top' ||
      viewportCommand.type === 'view-iso'
    ) {
      const bounds = new THREE.Box3().setFromObject(group);
      const directionMap: Record<
        'view-front' | 'view-right' | 'view-top' | 'view-iso',
        THREE.Vector3
      > = {
        'view-front': new THREE.Vector3(0, 0, 1),
        'view-right': new THREE.Vector3(1, 0, 0),
        'view-top': new THREE.Vector3(0.0001, 1, 0.0001),
        'view-iso': new THREE.Vector3(1, 0.75, 1),
      };

      fitCameraToBoundsWithDirection(
        camera,
        controls,
        bounds,
        directionMap[viewportCommand.type]
      );
      return;
    }

    if (viewportCommand.type === 'fit-selected' && selectedEntityId !== null) {
      const selectedEntries = meshEntriesRef.current.filter(
        (entry) =>
          entry.expressId === selectedEntityId &&
          !hiddenEntityIds.includes(entry.expressId)
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
  }, [hiddenEntityIds, selectedEntityId, viewportCommand]);

  return (
    <div ref={containerRef} className="viewer-viewport__canvas">
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
