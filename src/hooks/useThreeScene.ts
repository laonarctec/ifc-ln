import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useViewerStore } from "@/stores";
import type { ViewportProjectionMode } from "@/stores/slices/uiSlice";
import type { RenderManifest } from "@/types/worker-messages";
import {
  type ViewCamera,
  setCameraAspect,
  updateOrthographicFrustum,
  boundsFromTuple,
  fitCameraToBounds,
} from "@/components/viewer/viewport/cameraMath";
import { type GeometryCacheEntry, getWebGLBlockReason } from "@/components/viewer/viewport/geometryFactory";
import { NAV_PIXEL_RATIO_FACTOR, NAV_RESTORE_DELAY_MS } from "@/config/performance";
import { cancelAllBVH } from "@/services/bvhScheduler";
import { disposeMaterialPool } from "@/components/viewer/viewport/materialPool";
import type { BufferGeometryWithBVH } from "@/utils/three-bvh";
import type { RenderEntry, ChunkRenderGroup } from "@/components/viewer/viewport/meshManagement";
import type { ModelEntityKey } from "@/utils/modelEntity";

export interface SceneRefs {
  containerRef: React.RefObject<HTMLDivElement | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  sceneRootRef: React.MutableRefObject<THREE.Group | null>;
  cameraRef: React.MutableRefObject<ViewCamera | null>;
  controlsRef: React.MutableRefObject<OrbitControls | null>;
  rendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
  needsRenderRef: React.MutableRefObject<boolean>;
  chunkGroupsRef: React.MutableRefObject<Map<string, ChunkRenderGroup>>;
  meshEntriesRef: React.MutableRefObject<RenderEntry[]>;
  entryIndexRef: React.MutableRefObject<Map<ModelEntityKey, RenderEntry[]>>;
  geometryCacheRef: React.MutableRefObject<Map<number, GeometryCacheEntry>>;
}

export function useThreeScene(
  refs: SceneRefs,
  projectionMode: ViewportProjectionMode,
  manifest: RenderManifest,
) {
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [sceneGeneration, setSceneGeneration] = useState(0);
  const manifestBoundsRef = useRef(manifest.modelBounds);
  const cameraViewSnapshotRef = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
    zoom: number;
    isOrtho: boolean;
    halfHeight: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      useViewerStore.setState({ frameRate: null });
    };
  }, []);

  useEffect(() => {
    manifestBoundsRef.current = manifest.modelBounds;
  }, [manifest.modelBounds]);

  // Subscribe to edgesVisible toggle
  useEffect(() => {
    let prevEdgesVisible = useViewerStore.getState().edgesVisible;
    const unsub = useViewerStore.subscribe((state) => {
      if (state.edgesVisible !== prevEdgesVisible) {
        prevEdgesVisible = state.edgesVisible;
        refs.chunkGroupsRef.current.forEach((chunkGroup) => {
          chunkGroup.edgeGroup.visible = state.edgesVisible;
        });
        refs.needsRenderRef.current = true;
      }
    });
    return unsub;
  }, [refs]);

  // Subscribe to theme changes
  useEffect(() => {
    let prevTheme = useViewerStore.getState().theme;
    const unsub = useViewerStore.subscribe((state) => {
      if (state.theme !== prevTheme) {
        prevTheme = state.theme;
        const scene = refs.sceneRef.current;
        if (!scene) return;
        const dark = state.theme === "dark";
        scene.background = new THREE.Color(dark ? "#1e293b" : "#edf4fb");
        const grid = scene.children.find(
          (c): c is THREE.GridHelper => c instanceof THREE.GridHelper,
        );
        if (grid) {
          const mats = Array.isArray(grid.material)
            ? grid.material
            : [grid.material];
          mats[0]?.color.set(dark ? "#334155" : "#cbd5e1");
          if (mats[1]) mats[1].color.set(dark ? "#1e293b" : "#e5edf6");
        }
        refs.needsRenderRef.current = true;
      }
    });
    return unsub;
  }, [refs]);

  // Main scene setup / teardown
  useEffect(() => {
    const container = refs.containerRef.current;
    if (!container) return;

    setRendererError(null);
    setSceneGeneration((g) => g + 1);

    const webglBlockReason = getWebGLBlockReason();
    if (webglBlockReason) {
      setRendererError(webglBlockReason);
      useViewerStore.setState({ frameRate: null });
      return;
    }

    const scene = new THREE.Scene();
    const isDark = useViewerStore.getState().theme === "dark";
    scene.background = new THREE.Color(isDark ? "#1e293b" : "#edf4fb");

    const aspect =
      Math.max(container.clientWidth, 1) /
      Math.max(container.clientHeight, 1);
    const camera =
      projectionMode === "orthographic"
        ? new THREE.OrthographicCamera(-12 * aspect, 12 * aspect, 12, -12, 0.1, 5000)
        : new THREE.PerspectiveCamera(45, aspect, 0.1, 5000);
    setCameraAspect(camera, aspect);
    camera.position.set(12, 10, 12);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      });
    } catch (error) {
      setRendererError(
        error instanceof Error
          ? error.message
          : "현재 환경에서 WebGL 컨텍스트를 만들 수 없습니다.",
      );
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.autoClear = false;
    renderer.domElement.className = "viewer-viewport__canvas";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.78;
    controls.zoomSpeed = 2.0;
    controls.panSpeed = 0.92;
    controls.target.set(0, 0, 0);
    // --- FastNav: reduce quality during camera movement ---
    const fullPixelRatio = Math.min(window.devicePixelRatio, 2);
    const navPixelRatio = Math.max(1, Math.round(fullPixelRatio * NAV_PIXEL_RATIO_FACTOR));
    let isNavigating = false;
    let restoreTimerId: ReturnType<typeof setTimeout> | null = null;

    const restoreFullQuality = () => {
      isNavigating = false;
      renderer.setPixelRatio(fullPixelRatio);
      renderer.setSize(container.clientWidth, container.clientHeight);
      const edgesVisible = useViewerStore.getState().edgesVisible;
      refs.chunkGroupsRef.current.forEach((cg) => {
        cg.edgeGroup.visible = edgesVisible;
      });
      refs.needsRenderRef.current = true;
    };

    controls.addEventListener("change", () => {
      refs.needsRenderRef.current = true;
      if (!isNavigating) {
        isNavigating = true;
        renderer.setPixelRatio(navPixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight);
        refs.chunkGroupsRef.current.forEach((cg) => {
          cg.edgeGroup.visible = false;
        });
      }
      if (restoreTimerId !== null) clearTimeout(restoreTimerId);
      restoreTimerId = setTimeout(restoreFullQuality, NAV_RESTORE_DELAY_MS);
    });
    controls.mouseButtons = {
      LEFT: -1 as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.zoomToCursor = projectionMode !== "orthographic";

    // Lighting — hemisphere + 2 directional (sun + fill)
    const hemiLight = new THREE.HemisphereLight();
    hemiLight.color.setRGB(0.3, 0.35, 0.4);
    hemiLight.groundColor.setRGB(0.15, 0.1, 0.08);
    hemiLight.intensity = 0.8;
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight("#ffffff", 1.7);
    sunLight.position.set(0.5, 1.0, 0.3).normalize();
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight("#ffffff", 0.6);
    fillLight.position.set(-0.3, 0.25, -0.7).normalize();
    scene.add(fillLight);

    const grid = new THREE.GridHelper(
      140, 28,
      isDark ? "#334155" : "#cbd5e1",
      isDark ? "#1e293b" : "#e5edf6",
    );
    const gridMaterial = grid.material;
    if (Array.isArray(gridMaterial)) {
      gridMaterial.forEach((m) => { m.transparent = true; m.opacity = 0.36; });
    } else {
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.36;
    }
    scene.add(grid);

    const sceneRoot = new THREE.Group();
    scene.add(sceneRoot);

    // Publish to refs
    refs.sceneRef.current = scene;
    refs.sceneRootRef.current = sceneRoot;
    refs.cameraRef.current = camera;
    refs.controlsRef.current = controls;
    refs.rendererRef.current = renderer;
    refs.chunkGroupsRef.current = new Map();
    refs.meshEntriesRef.current = [];
    refs.entryIndexRef.current = new Map();
    refs.geometryCacheRef.current = new Map();

    // Restore camera snapshot on projection mode switch
    const snap = cameraViewSnapshotRef.current;
    if (snap && snap.position.clone().sub(snap.target).lengthSq() > 0) {
      const dir = snap.position.clone().sub(snap.target);
      const prevDistance = dir.length();

      if (camera instanceof THREE.OrthographicCamera) {
        let halfHeight: number;
        if (!snap.isOrtho) {
          const fovRad = THREE.MathUtils.degToRad(45);
          halfHeight = prevDistance * Math.tan(fovRad / 2);
        } else {
          halfHeight = snap.halfHeight;
        }
        halfHeight = Math.max(halfHeight, 0.5);
        camera.position.copy(snap.position);
        controls.target.copy(snap.target);
        camera.lookAt(snap.target);
        updateOrthographicFrustum(camera, halfHeight);
        camera.zoom = snap.isOrtho ? snap.zoom : 1;
        camera.near = 0.1;
        camera.far = Math.max(prevDistance * 24, 2400);
        camera.updateProjectionMatrix();
        controls.update();
      } else {
        let distance: number;
        if (snap.isOrtho) {
          const fovRad = THREE.MathUtils.degToRad(45);
          const effectiveHalfHeight = snap.halfHeight / snap.zoom;
          distance = effectiveHalfHeight / Math.tan(fovRad / 2);
        } else {
          distance = prevDistance;
        }
        const normalizedDir = dir.normalize();
        camera.position.copy(snap.target).addScaledVector(normalizedDir, distance);
        controls.target.copy(snap.target);
        camera.lookAt(snap.target);
        camera.near = Math.max(distance / 100, 0.1);
        camera.far = Math.max(distance * 120, 2400);
        camera.updateProjectionMatrix();
        controls.update();
      }

      const finalDistance = camera.position.clone().sub(controls.target).length();
      controls.minDistance = Math.max(finalDistance * 0.02, 0.2);
      controls.maxDistance = finalDistance * 20;
    } else {
      fitCameraToBounds(camera, controls, boundsFromTuple(manifestBoundsRef.current));
    }

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      setCameraAspect(camera, width / height);
      if (camera instanceof THREE.OrthographicCamera) {
        updateOrthographicFrustum(camera, (camera.top - camera.bottom) / 2);
      }
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      refs.needsRenderRef.current = true;
    });
    resizeObserver.observe(container);

    return () => {
      if (restoreTimerId !== null) clearTimeout(restoreTimerId);
      cancelAllBVH();
      disposeMaterialPool();
      resizeObserver.disconnect();
      cameraViewSnapshotRef.current = {
        position: camera.position.clone(),
        target: controls.target.clone(),
        zoom: camera instanceof THREE.OrthographicCamera ? camera.zoom : 1,
        isOrtho: camera instanceof THREE.OrthographicCamera,
        halfHeight: camera instanceof THREE.OrthographicCamera
          ? (camera.top - camera.bottom) / 2
          : 0,
      };
      controls.dispose();

      refs.chunkGroupsRef.current.forEach((chunkGroup) => {
        chunkGroup.materials.forEach((material) => material.dispose());
        chunkGroup.batchedMeshes.forEach((bm) => bm.dispose());
      });
      refs.geometryCacheRef.current.forEach(({ geometry }) => {
        (geometry as BufferGeometryWithBVH).disposeBoundsTree?.();
        geometry.dispose();
      });
      refs.chunkGroupsRef.current = new Map();
      refs.meshEntriesRef.current = [];
      refs.entryIndexRef.current = new Map();
      refs.geometryCacheRef.current = new Map();
      refs.sceneRootRef.current = null;
      refs.cameraRef.current = null;
      refs.controlsRef.current = null;
      refs.rendererRef.current = null;
      renderer.forceContextLoss();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [projectionMode, refs]);

  return { rendererError, sceneGeneration };
}
