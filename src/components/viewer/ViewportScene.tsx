import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useViewerStore } from "@/stores";
import type {
  ViewportCommand,
  ViewportProjectionMode,
} from "@/stores/slices/uiSlice";
import type {
  RenderChunkPayload,
  RenderManifest,
} from "@/types/worker-messages";
import type { AxisHelperRef } from "./AxisHelper";
import { ViewportOverlays } from "./ViewportOverlays";
import type { ViewCubeRef } from "./ViewCube";
import {
  type ViewCamera,
  type GeometryCacheEntry,
  type RenderEntry,
  type ChunkRenderGroup,
  getWebGLBlockReason,
  getCameraAspect,
  setCameraAspect,
  updateOrthographicFrustum,
  boundsFromTuple,
  fitCameraToBounds,
  fitCameraToBoundsWithDirection,
  getOrCreateGeometry,
  indexRenderEntry,
  removeIndexedRenderEntry,
  setEntryVisualState,
  appendMeshesToGroup,
  updateMeshVisualState,
  expandBoundsForEntry,
  formatScaleLabel,
  calculateScaleBarWorldSize,
  getCameraOverlayRotation,
  zoomCamera,
  orbitCamera,
  calculateVisibleChunkIds,
  pickEntityAtPointer,
} from "./viewport/viewportUtils";

interface ViewportSceneProps {
  manifest: RenderManifest;
  residentChunks: RenderChunkPayload[];
  chunkVersion: number;
  selectedEntityIds: number[];
  hiddenEntityIds: number[];
  projectionMode: ViewportProjectionMode;
  viewportCommand: ViewportCommand;
  onSelectEntity: (expressId: number | null, additive?: boolean) => void;
  onVisibleChunkIdsChange: (chunkIds: number[]) => void;
  onHoverEntity?: (
    expressId: number | null,
    position: { x: number; y: number } | null,
  ) => void;
  onContextMenu?: (
    expressId: number | null,
    position: { x: number; y: number },
  ) => void;
}

export function ViewportScene({
  manifest,
  residentChunks,
  chunkVersion,
  selectedEntityIds,
  hiddenEntityIds,
  projectionMode,
  viewportCommand,
  onSelectEntity,
  onVisibleChunkIdsChange,
  onHoverEntity,
  onContextMenu,
}: ViewportSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRootRef = useRef<THREE.Group | null>(null);
  const chunkGroupsRef = useRef<Map<number, ChunkRenderGroup>>(new Map());
  const meshEntriesRef = useRef<RenderEntry[]>([]);
  const entryIndexRef = useRef<Map<number, RenderEntry[]>>(new Map());
  const geometryCacheRef = useRef<Map<number, GeometryCacheEntry>>(new Map());
  const needsRenderRef = useRef(true);
  const cameraRef = useRef<ViewCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const onSelectEntityRef = useRef(onSelectEntity);
  const onHoverEntityRef = useRef(onHoverEntity);
  const onContextMenuRef = useRef(onContextMenu);
  const selectedEntityIdsRef = useRef(selectedEntityIds);
  const hiddenEntityIdsRef = useRef(hiddenEntityIds);
  const lastHandledViewportCommandSeqRef = useRef(0);
  const viewCubeRef = useRef<ViewCubeRef | null>(null);
  const axisHelperRef = useRef<AxisHelperRef | null>(null);
  const lastScaleValueRef = useRef(0);
  const cameraViewSnapshotRef = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
    zoom: number;
    isOrtho: boolean;
    halfHeight: number;
  } | null>(null);
  const previousSelectedSetRef = useRef(new Set<number>(selectedEntityIds));
  const previousHiddenSetRef = useRef(new Set<number>(hiddenEntityIds));
  const lastVisibleChunkKeyRef = useRef("");
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [sceneGeneration, setSceneGeneration] = useState(0);
  const [scaleLabel, setScaleLabel] = useState("10m");

  useEffect(() => {
    return () => {
      useViewerStore.setState({ frameRate: null });
    };
  }, []);

  const homeToFit = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    fitCameraToBounds(
      camera,
      controls,
      boundsFromTuple(manifest.modelBounds),
    );
  }, [manifest.modelBounds]);

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
      boundsFromTuple(manifest.modelBounds),
      direction,
    );
  }, [manifest.modelBounds]);

  const setPresetView = useCallback(
    (view: "top" | "bottom" | "front" | "back" | "left" | "right") => {
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
        boundsFromTuple(manifest.modelBounds),
        directionMap[view],
      );
    },
    [manifest.modelBounds],
  );

  const zoomIn = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    zoomCamera(camera, controls, 0.84);
    needsRenderRef.current = true;
  }, []);

  const zoomOut = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    zoomCamera(camera, controls, 1.2);
    needsRenderRef.current = true;
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
    onHoverEntityRef.current = onHoverEntity;
  }, [onHoverEntity]);

  useEffect(() => {
    onContextMenuRef.current = onContextMenu;
  }, [onContextMenu]);

  useEffect(() => {
    const currentSelectedSet = new Set(selectedEntityIds);
    const currentHiddenSet = new Set(hiddenEntityIds);
    const result = updateMeshVisualState(
      entryIndexRef.current,
      previousSelectedSetRef.current,
      previousHiddenSetRef.current,
      currentSelectedSet,
      currentHiddenSet,
    );

    selectedEntityIdsRef.current = selectedEntityIds;
    hiddenEntityIdsRef.current = hiddenEntityIds;
    previousSelectedSetRef.current = result.currentSelectedSet;
    previousHiddenSetRef.current = result.currentHiddenSet;
    needsRenderRef.current = true;
  }, [hiddenEntityIds, selectedEntityIds]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

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
        ? new THREE.OrthographicCamera(
          -12 * aspect,
          12 * aspect,
          12,
          -12,
          0.1,
          5000,
        )
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
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.78;
    controls.zoomSpeed = 2.0;
    controls.panSpeed = 0.92;
    controls.target.set(0, 0, 0);
    controls.addEventListener("change", () => {
      needsRenderRef.current = true;
    });
    controls.mouseButtons = {
      LEFT: -1 as THREE.MOUSE, // LMB: OrbitControls 무시 (선택 전용)
      MIDDLE: THREE.MOUSE.PAN, // MMB: 팬
      RIGHT: THREE.MOUSE.ROTATE, // RMB: 오빗
    };
    controls.zoomToCursor = projectionMode !== "orthographic"; // ortho: unproject 2회 제거로 줌 성능 개선

    // ifc-lite 스타일 조명: hemisphere + sun/fill/rim
    const hemiLight = new THREE.HemisphereLight();
    hemiLight.color.setRGB(0.3, 0.35, 0.4);
    hemiLight.groundColor.setRGB(0.15, 0.1, 0.08);
    hemiLight.intensity = 0.8;
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight("#ffffff", 1.7);
    sunLight.position.set(0.5, 1.0, 0.3).normalize();
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight("#ffffff", 0.5);
    fillLight.position.set(-0.5, 0.3, -0.3).normalize();
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight("#ffffff", 0.5);
    rimLight.position.set(0.0, 0.2, -1.0).normalize();
    scene.add(rimLight);

    const grid = new THREE.GridHelper(
      140,
      28,
      isDark ? "#334155" : "#cbd5e1",
      isDark ? "#1e293b" : "#e5edf6",
    );
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

    const sceneRoot = new THREE.Group();
    scene.add(sceneRoot);
    sceneRootRef.current = sceneRoot;
    cameraRef.current = camera;
    controlsRef.current = controls;
    chunkGroupsRef.current = new Map();
    meshEntriesRef.current = [];
    entryIndexRef.current = new Map();
    geometryCacheRef.current = new Map();

    const snap = cameraViewSnapshotRef.current;
    if (snap && snap.position.clone().sub(snap.target).lengthSq() > 0) {
      const dir = snap.position.clone().sub(snap.target);
      const prevDistance = dir.length();

      if (camera instanceof THREE.OrthographicCamera) {
        // Perspective → Ortho: convert distance to halfHeight
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
        // Ortho → Perspective: convert halfHeight to distance
        let distance: number;
        if (snap.isOrtho) {
          const fovRad = THREE.MathUtils.degToRad(45);
          const effectiveHalfHeight = snap.halfHeight / snap.zoom;
          distance = effectiveHalfHeight / Math.tan(fovRad / 2);
        } else {
          distance = prevDistance;
        }

        const normalizedDir = dir.normalize();
        camera.position
          .copy(snap.target)
          .addScaledVector(normalizedDir, distance);
        controls.target.copy(snap.target);
        camera.lookAt(snap.target);
        camera.near = Math.max(distance / 100, 0.1);
        camera.far = Math.max(distance * 120, 2400);
        camera.updateProjectionMatrix();
        controls.update();
      }

      // Set orbit distance limits
      const finalDistance = camera.position
        .clone()
        .sub(controls.target)
        .length();
      controls.minDistance = Math.max(finalDistance * 0.02, 0.2);
      controls.maxDistance = finalDistance * 20;
    } else {
      fitCameraToBounds(
        camera,
        controls,
        boundsFromTuple(manifest.modelBounds),
      );
    }

    const raycaster = new THREE.Raycaster();
    (
      raycaster as THREE.Raycaster & { firstHitOnly?: boolean }
    ).firstHitOnly = true;
    const pointer = new THREE.Vector2();
    let pointerIsDown = false;
    let didDrag = false;
    let pointerDownX = 0;
    let pointerDownY = 0;

    let rmbIsDown = false;
    let rmbDidDrag = false;
    let rmbDownX = 0;
    let rmbDownY = 0;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 0) {
        pointerIsDown = true;
        didDrag = false;
        pointerDownX = event.clientX;
        pointerDownY = event.clientY;
      } else if (event.button === 2) {
        rmbIsDown = true;
        rmbDidDrag = false;
        rmbDownX = event.clientX;
        rmbDownY = event.clientY;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerIsDown) {
        const deltaX = event.clientX - pointerDownX;
        const deltaY = event.clientY - pointerDownY;
        if (Math.hypot(deltaX, deltaY) > 4) {
          didDrag = true;
        }
      }
      if (rmbIsDown) {
        const deltaX = event.clientX - rmbDownX;
        const deltaY = event.clientY - rmbDownY;
        if (Math.hypot(deltaX, deltaY) > 4) {
          rmbDidDrag = true;
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 0) {
        pointerIsDown = false;
      } else if (event.button === 2) {
        rmbIsDown = false;
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (didDrag) {
        didDrag = false;
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const expressId = pickEntityAtPointer(pointer, raycaster, camera, sceneRoot);
      if (expressId === null && !event.shiftKey) {
        onSelectEntityRef.current(null);
        return;
      }
      if (expressId !== null) {
        onSelectEntityRef.current(expressId, event.shiftKey);
      }
    };

    let lastHoverTime = 0;
    let lastHoveredId: number | null = null;
    const hoverPointer = new THREE.Vector2();

    const handleHoverMove = (event: MouseEvent) => {
      if (pointerIsDown || rmbIsDown) {
        if (lastHoveredId !== null) {
          lastHoveredId = null;
          onHoverEntityRef.current?.(null, null);
        }
        return;
      }

      const now = performance.now();
      if (now - lastHoverTime < 50) return;
      lastHoverTime = now;

      const rect = renderer.domElement.getBoundingClientRect();
      hoverPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      hoverPointer.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const hoveredId = pickEntityAtPointer(hoverPointer, raycaster, camera, sceneRoot);

      if (hoveredId !== lastHoveredId) {
        lastHoveredId = hoveredId;
        onHoverEntityRef.current?.(
          hoveredId,
          hoveredId !== null
            ? { x: event.clientX, y: event.clientY }
            : null,
        );
      } else if (hoveredId !== null) {
        onHoverEntityRef.current?.(hoveredId, {
          x: event.clientX,
          y: event.clientY,
        });
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (rmbDidDrag) {
        rmbDidDrag = false;
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const expressId = pickEntityAtPointer(pointer, raycaster, camera, sceneRoot);

      if (expressId !== null) {
        onSelectEntityRef.current(expressId);
      }
      onContextMenuRef.current?.(expressId, {
        x: event.clientX,
        y: event.clientY,
      });
    };

    const handleCtrlRmbDown = (event: PointerEvent) => {
      if (event.button === 2 && (event.ctrlKey || event.metaKey)) {
        controls.mouseButtons.RIGHT = THREE.MOUSE.DOLLY;
      }
    };
    const handleCtrlRmbUp = (event: PointerEvent) => {
      if (event.button === 2) {
        controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
      }
    };

    // 트랙패드 관성(momentum) 스크롤 제거: 적응형 쓰로틀 (meshCount 기반)
    const WHEEL_THROTTLE_MS_SMALL = 16; // ~60fps, ≤10K meshes
    const WHEEL_THROTTLE_MS_MEDIUM = 25; // ~40fps, 10K-50K meshes
    const WHEEL_THROTTLE_MS_LARGE = 40; // ~25fps, >50K meshes
    let lastWheelTime = 0;
    const handleWheelCapture = (event: WheelEvent) => {
      const meshCount = meshEntriesRef.current.length;
      const throttleMs =
        meshCount > 50000
          ? WHEEL_THROTTLE_MS_LARGE
          : meshCount > 10000
            ? WHEEL_THROTTLE_MS_MEDIUM
            : WHEEL_THROTTLE_MS_SMALL;
      const now = performance.now();
      if (now - lastWheelTime < throttleMs) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      lastWheelTime = now;
    };
    renderer.domElement.addEventListener("wheel", handleWheelCapture, {
      capture: true,
    });

    renderer.domElement.addEventListener("pointerdown", handleCtrlRmbDown, {
      capture: true,
    });
    window.addEventListener("pointerup", handleCtrlRmbUp);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.addEventListener("mousemove", handleHoverMove);
    renderer.domElement.addEventListener("contextmenu", handleContextMenu);

    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      setCameraAspect(camera, width / height);
      if (camera instanceof THREE.OrthographicCamera) {
        updateOrthographicFrustum(
          camera,
          (camera.top - camera.bottom) / 2,
        );
      }
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      needsRenderRef.current = true;
    });
    resizeObserver.observe(container);

    let animationFrame = 0;
    let fpsSampleStart = performance.now();
    let fpsSampleFrames = 0;
    let lastPublishedFrameRate: number | null =
      useViewerStore.getState().frameRate;
    let lastVisibleSample = 0;
    const renderFrame = () => {
      controls.update();

      if (needsRenderRef.current) {
        const viewportWidth = Math.max(1, container.clientWidth);
        const viewportHeight = Math.max(1, container.clientHeight);

        renderer.setViewport(0, 0, viewportWidth, viewportHeight);
        renderer.setScissorTest(false);
        renderer.clear();
        renderer.render(scene, camera);

        const { distance, rotationX, rotationY } =
          getCameraOverlayRotation(camera, controls);
        viewCubeRef.current?.updateRotation(rotationX, rotationY);
        axisHelperRef.current?.updateRotation(rotationX, rotationY);

        const worldScale = calculateScaleBarWorldSize(
          camera,
          distance,
          viewportHeight,
        );
        const scaleDelta =
          lastScaleValueRef.current === 0
            ? 1
            : Math.abs(worldScale - lastScaleValueRef.current) /
            lastScaleValueRef.current;
        if (scaleDelta > 0.01) {
          lastScaleValueRef.current = worldScale;
          setScaleLabel(formatScaleLabel(worldScale));
        }

        const now = performance.now();
        if (now - lastVisibleSample >= 150) {
          const visibleChunkIds = calculateVisibleChunkIds(
            camera,
            manifest,
          );
          const visibleChunkKey = visibleChunkIds.join(",");
          if (visibleChunkKey !== lastVisibleChunkKeyRef.current) {
            lastVisibleChunkKeyRef.current = visibleChunkKey;
            onVisibleChunkIdsChange(visibleChunkIds);
          }
          lastVisibleSample = now;
        }

        fpsSampleFrames += 1;
        if (now - fpsSampleStart >= 250) {
          const nextFrameRate = Math.round(
            (fpsSampleFrames * 1000) / (now - fpsSampleStart),
          );
          if (nextFrameRate !== lastPublishedFrameRate) {
            useViewerStore.setState({ frameRate: nextFrameRate });
            lastPublishedFrameRate = nextFrameRate;
          }
          fpsSampleStart = now;
          fpsSampleFrames = 0;
        }

        needsRenderRef.current = false;
      }

      animationFrame = window.requestAnimationFrame(renderFrame);
    };
    renderFrame();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener(
        "wheel",
        handleWheelCapture,
        { capture: true } as EventListenerOptions,
      );
      renderer.domElement.removeEventListener(
        "pointerdown",
        handleCtrlRmbDown,
        { capture: true },
      );
      window.removeEventListener("pointerup", handleCtrlRmbUp);
      renderer.domElement.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.domElement.removeEventListener(
        "mousemove",
        handleHoverMove,
      );
      renderer.domElement.removeEventListener(
        "contextmenu",
        handleContextMenu,
      );
      cameraViewSnapshotRef.current = {
        position: camera.position.clone(),
        target: controls.target.clone(),
        zoom:
          camera instanceof THREE.OrthographicCamera
            ? camera.zoom
            : 1,
        isOrtho: camera instanceof THREE.OrthographicCamera,
        halfHeight:
          camera instanceof THREE.OrthographicCamera
            ? (camera.top - camera.bottom) / 2
            : 0,
      };
      controls.dispose();

      chunkGroupsRef.current.forEach((chunkGroup) => {
        chunkGroup.materials.forEach((material) => material.dispose());
      });
      geometryCacheRef.current.forEach(({ geometry }) => {
        (
          geometry as THREE.BufferGeometry & {
            disposeBoundsTree?: () => void;
          }
        ).disposeBoundsTree?.();
        geometry.dispose();
      });
      chunkGroupsRef.current = new Map();
      meshEntriesRef.current = [];
      entryIndexRef.current = new Map();
      geometryCacheRef.current = new Map();
      sceneRootRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      renderer.forceContextLoss();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [manifest, projectionMode, onVisibleChunkIdsChange]);

  useEffect(() => {
    const sceneRoot = sceneRootRef.current;
    if (!sceneRoot) {
      return;
    }

    const nextChunkIds = new Set(
      residentChunks.map((chunk) => chunk.chunkId),
    );

    chunkGroupsRef.current.forEach((chunkGroup, chunkId) => {
      if (nextChunkIds.has(chunkId)) {
        return;
      }

      sceneRoot.remove(chunkGroup.group);
      chunkGroup.entries.forEach((entry) => {
        removeIndexedRenderEntry(entryIndexRef.current, entry);
        const cached = geometryCacheRef.current.get(entry.geometryExpressId);
        if (cached) {
          cached.refCount -= 1;
          if (cached.refCount <= 0) {
            (
              cached.geometry as THREE.BufferGeometry & {
                disposeBoundsTree?: () => void;
              }
            ).disposeBoundsTree?.();
            cached.geometry.dispose();
            geometryCacheRef.current.delete(entry.geometryExpressId);
          }
        }
      });
      meshEntriesRef.current = meshEntriesRef.current.filter(
        (entry) => !chunkGroup.entries.includes(entry),
      );
      chunkGroup.materials.forEach((material) => material.dispose());
      chunkGroupsRef.current.delete(chunkId);
    });

    residentChunks.forEach((chunk) => {
      if (chunkGroupsRef.current.has(chunk.chunkId)) {
        return;
      }

      const chunkGroup = new THREE.Group();
      const builtChunk = appendMeshesToGroup(
        chunk.meshes,
        chunkGroup,
        geometryCacheRef.current,
        entryIndexRef.current,
        selectedEntityIdsRef.current,
        hiddenEntityIdsRef.current,
      );
      meshEntriesRef.current.push(...builtChunk.entries);
      sceneRoot.add(chunkGroup);
      chunkGroupsRef.current.set(chunk.chunkId, {
        group: chunkGroup,
        entries: builtChunk.entries,
        materials: builtChunk.materials,
      });
    });
    needsRenderRef.current = true;
  }, [chunkVersion, residentChunks, sceneGeneration]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!camera || !controls || viewportCommand.type === "none") {
      return;
    }

    if (viewportCommand.seq <= lastHandledViewportCommandSeqRef.current) {
      return;
    }

    lastHandledViewportCommandSeqRef.current = viewportCommand.seq;

    if (viewportCommand.type === "home") {
      homeToFit();
      return;
    }

    if (viewportCommand.type === "fit-all") {
      fitAllCurrentView();
      return;
    }

    if (
      viewportCommand.type === "view-front" ||
      viewportCommand.type === "view-back" ||
      viewportCommand.type === "view-right" ||
      viewportCommand.type === "view-left" ||
      viewportCommand.type === "view-top" ||
      viewportCommand.type === "view-bottom" ||
      viewportCommand.type === "view-iso"
    ) {
      const viewMap: Record<string, () => void> = {
        "view-front": () => setPresetView("front"),
        "view-back": () => setPresetView("back"),
        "view-right": () => setPresetView("right"),
        "view-left": () => setPresetView("left"),
        "view-top": () => setPresetView("top"),
        "view-bottom": () => setPresetView("bottom"),
        "view-iso": () =>
          fitCameraToBoundsWithDirection(
            camera,
            controls,
            boundsFromTuple(manifest.modelBounds),
            new THREE.Vector3(1, 0.75, 1),
          ),
      };
      viewMap[viewportCommand.type]();
      return;
    }

    if (
      viewportCommand.type === "fit-selected" &&
      selectedEntityIds.length > 0
    ) {
      const selectedEntries = meshEntriesRef.current.filter(
        (entry) =>
          selectedEntityIdsRef.current.includes(entry.expressId) &&
          !hiddenEntityIdsRef.current.includes(entry.expressId),
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
  }, [
    homeToFit,
    manifest.modelBounds,
    selectedEntityIds.length,
    setPresetView,
    viewportCommand,
  ]);

  return (
    <div ref={containerRef} className="viewer-viewport__canvas">
      {rendererError ? (
        <div className="viewer-viewport__empty-state viewer-viewport__empty-state--error">
          <h1>WebGL Renderer Error</h1>
          <p>{rendererError}</p>
        </div>
      ) : null}
      <ViewportOverlays
        axisHelperRef={axisHelperRef}
        projectionMode={projectionMode}
        scaleLabel={scaleLabel}
        onFitAll={fitAllCurrentView}
        onHome={homeToFit}
        onViewChange={setPresetView}
        onViewCubeDrag={orbitFromViewCube}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        viewCubeRef={viewCubeRef}
      />
    </div>
  );
}
