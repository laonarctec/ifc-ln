import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ViewportCommand } from '@/stores/slices/uiSlice';
import type { TransferableMeshData } from '@/types/worker-messages';

interface ViewportSceneProps {
  meshes: TransferableMeshData[];
  selectedEntityId: number | null;
  hiddenEntityIds: number[];
  viewportCommand: ViewportCommand;
  onSelectEntity: (expressId: number | null) => void;
}

interface MeshEntry {
  expressId: number;
  object: THREE.Mesh;
  baseColor: THREE.Color;
  baseOpacity: number;
}

function getWebGLBlockReason() {
  const canvas = document.createElement('canvas');
  const webgl2Context = canvas.getContext('webgl2');
  if (webgl2Context) {
    return null;
  }

  const webglContext =
    canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');

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
  const direction = new THREE.Vector3(1, 0.75, 1).normalize();

  camera.near = Math.max(distance / 100, 0.1);
  camera.far = Math.max(distance * 100, 2000);
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.maxDistance = distance * 8;
  controls.update();
}

function updateMeshVisualState(
  meshEntries: MeshEntry[],
  selectedEntityId: number | null,
  hiddenEntityIds: number[]
) {
  const hiddenSet = new Set(hiddenEntityIds);

  for (const entry of meshEntries) {
    const material = entry.object.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) {
      continue;
    }

    const isHidden = hiddenSet.has(entry.expressId);
    const isSelected = selectedEntityId !== null && entry.expressId === selectedEntityId;

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
}

export function ViewportScene({
  meshes,
  selectedEntityId,
  hiddenEntityIds,
  viewportCommand,
  onSelectEntity,
}: ViewportSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const meshEntriesRef = useRef<MeshEntry[]>([]);
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
        error instanceof Error
          ? error.message
          : '현재 환경에서 WebGL 컨텍스트를 만들 수 없습니다.'
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

    const ambientLight = new THREE.AmbientLight('#ffffff', 1.8);
    scene.add(ambientLight);

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

    const meshEntries: MeshEntry[] = [];

    for (const mesh of meshes) {
      if (mesh.vertices.length < 6 || mesh.indices.length === 0) {
        continue;
      }

      const geometry = createRenderableGeometry(mesh);
      const baseColor = new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2]);
      const baseOpacity = mesh.color[3];
      const material = new THREE.MeshStandardMaterial({
        color: baseColor.clone(),
        transparent: baseOpacity < 1,
        opacity: baseOpacity,
        metalness: 0.03,
        roughness: 0.82,
        side: THREE.DoubleSide,
      });
      const object = new THREE.Mesh(geometry, material);

      object.matrixAutoUpdate = false;
      object.matrix.fromArray(mesh.transform);
      object.userData.expressId = mesh.expressId;

      group.add(object);
      meshEntries.push({
        expressId: mesh.expressId,
        object,
        baseColor,
        baseOpacity,
      });
    }

    meshEntriesRef.current = meshEntries;
    updateMeshVisualState(meshEntriesRef.current, selectedEntityId, hiddenEntityIds);
    fitCameraToObject(camera, controls, group);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(group.children, true);
      const firstHit = intersects.find((intersection) => intersection.object instanceof THREE.Mesh);
      const expressId = firstHit?.object.userData.expressId;

      if (typeof expressId === 'number') {
        onSelectEntity(expressId);
        return;
      }

      onSelectEntity(null);
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

      for (const entry of meshEntries) {
        entry.object.geometry.dispose();
        const material = entry.object.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material.dispose();
        }
      }

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

    if (viewportCommand.type === 'fit-selected' && selectedEntityId !== null) {
      const selectedEntries = meshEntriesRef.current.filter(
        (entry) => entry.expressId === selectedEntityId && entry.object.visible
      );
      if (selectedEntries.length === 0) {
        return;
      }

      const selectedBounds = new THREE.Box3();
      selectedEntries.forEach((entry) => {
        selectedBounds.expandByObject(entry.object);
      });
      fitCameraToBounds(camera, controls, selectedBounds);
    }
  }, [selectedEntityId, viewportCommand]);

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
