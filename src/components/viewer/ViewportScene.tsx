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
import type { ModelEntityKey } from "@/utils/modelEntity";
import type { AxisHelperRef } from "./AxisHelper";
import { SelectionBox } from "./SelectionBox";
import { ViewportOverlays } from "./ViewportOverlays";
import type { ViewCubeRef } from "./ViewCube";
import {
  type ViewCamera,
  boundsFromTuple,
  expandBoundsForEntry,
  fitCameraToBounds,
  fitCameraToBoundsWithDirection,
  orbitCamera,
  zoomCamera,
} from "./viewport/cameraMath";
import type { GeometryCacheEntry } from "./viewport/geometryFactory";
import type { ChunkRenderGroup, RenderEntry } from "./viewport/meshManagement";
import type { RaycastHit, BoxSelectionResult } from "./viewport/raycasting";
import { useChunkSceneGraph } from "@/hooks/useChunkSceneGraph";
import { useRenderLoop } from "@/hooks/useRenderLoop";
import { useThreeScene, type SceneRefs } from "@/hooks/useThreeScene";
import { useViewportInput, type BoxDragState } from "@/hooks/useViewportInput";

interface ViewportSceneProps {
  manifest: RenderManifest;
  manifests: RenderManifest[];
  residentChunks: RenderChunkPayload[];
  chunkVersion: number;
  selectedEntityKeys: Set<ModelEntityKey>;
  hiddenEntityKeys: Set<ModelEntityKey>;
  colorOverrides: Map<ModelEntityKey, string>;
  projectionMode: ViewportProjectionMode;
  viewportCommand: ViewportCommand;
  onSelectEntity: (
    modelId: number | null,
    expressId: number | null,
    additive?: boolean,
  ) => void;
  onVisibleChunkIdsChange: (modelId: number, chunkIds: number[]) => void;
  onHoverEntity?: (
    modelId: number | null,
    expressId: number | null,
    position: { x: number; y: number } | null,
  ) => void;
  onContextMenu?: (
    modelId: number | null,
    expressId: number | null,
    position: { x: number; y: number },
  ) => void;
  onBoxSelect?: (results: BoxSelectionResult[], additive: boolean) => void;
}

export function ViewportScene({
  manifest,
  manifests,
  residentChunks,
  chunkVersion,
  selectedEntityKeys,
  hiddenEntityKeys,
  colorOverrides,
  projectionMode,
  viewportCommand,
  onSelectEntity,
  onVisibleChunkIdsChange,
  onHoverEntity,
  onContextMenu,
  onBoxSelect,
}: ViewportSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const sceneRootRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<ViewCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const needsRenderRef = useRef(true);
  const chunkGroupsRef = useRef<Map<string, ChunkRenderGroup>>(new Map());
  const meshEntriesRef = useRef<RenderEntry[]>([]);
  const entryIndexRef = useRef<Map<ModelEntityKey, RenderEntry[]>>(new Map());
  const geometryCacheRef = useRef<Map<number, GeometryCacheEntry>>(new Map());

  const refsObj = useRef<SceneRefs>({
    containerRef,
    sceneRef,
    sceneRootRef,
    cameraRef,
    controlsRef,
    rendererRef,
    needsRenderRef,
    chunkGroupsRef,
    meshEntriesRef,
    entryIndexRef,
    geometryCacheRef,
  });
  const refs = refsObj.current;

  const onSelectEntityRef = useRef(onSelectEntity);
  const onMeasurePointRef = useRef<((hit: RaycastHit) => void) | undefined>(
    undefined,
  );
  const onMeasureHoverRef = useRef<((hit: RaycastHit | null) => void) | undefined>(
    undefined,
  );
  const onHoverEntityRef = useRef(onHoverEntity);
  const onContextMenuRef = useRef(onContextMenu);
  const interactionMode = useViewerStore((state) => state.interactionMode);
  const measurement = useViewerStore((state) => state.measurement);
  const toggleMeasurementMode = useViewerStore(
    (state) => state.toggleMeasurementMode,
  );
  const clearMeasurement = useViewerStore((state) => state.clearMeasurement);
  const placeMeasurementPoint = useViewerStore(
    (state) => state.placeMeasurementPoint,
  );
  const interactionModeRef = useRef(interactionMode);
  const selectedEntityKeysRef = useRef(selectedEntityKeys);
  const hiddenEntityKeysRef = useRef(hiddenEntityKeys);
  const colorOverridesRef = useRef(colorOverrides);
  const lastHandledViewportCommandSeqRef = useRef(0);
  const viewCubeRef = useRef<ViewCubeRef | null>(null);
  const axisHelperRef = useRef<AxisHelperRef | null>(null);
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const [measurementPreview, setMeasurementPreview] = useState<RaycastHit | null>(null);
  const [boxDrag, setBoxDrag] = useState<BoxDragState | null>(null);
  const onBoxSelectRef = useRef<((results: BoxSelectionResult[], additive: boolean) => void) | undefined>(undefined);
  const onBoxDragChangeRef = useRef<((state: BoxDragState) => void) | undefined>(undefined);

  useEffect(() => {
    onSelectEntityRef.current = onSelectEntity;
  }, [onSelectEntity]);
  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);
  useEffect(() => {
    onMeasurePointRef.current = (hit) => {
      placeMeasurementPoint({
        expressId: hit.expressId,
        point: [hit.point.x, hit.point.y, hit.point.z],
      });
      setMeasurementPreview(null);
    };
  }, [placeMeasurementPoint]);
  useEffect(() => {
    onMeasureHoverRef.current = (hit) => {
      setMeasurementPreview(hit);
    };
  }, []);
  useEffect(() => {
    onHoverEntityRef.current = onHoverEntity;
  }, [onHoverEntity]);
  useEffect(() => {
    onContextMenuRef.current = onContextMenu;
  }, [onContextMenu]);
  useEffect(() => {
    onBoxSelectRef.current = onBoxSelect;
  }, [onBoxSelect]);
  useEffect(() => {
    onBoxDragChangeRef.current = (state) => {
      setBoxDrag(state.active ? state : null);
    };
  }, []);

  const { rendererError, sceneGeneration } = useThreeScene(
    refs,
    projectionMode,
    manifest,
  );

  useViewportInput(
    refs,
    {
      onSelectEntityRef,
      onBoxSelectRef,
      onBoxDragChangeRef,
      onMeasurePointRef,
      onMeasureHoverRef,
      interactionModeRef,
      onHoverEntityRef,
      onContextMenuRef,
      hiddenEntityKeysRef,
    },
    sceneGeneration,
  );

  const scaleLabel = useRenderLoop(
    refs,
    manifests,
    sceneGeneration,
    onVisibleChunkIdsChange,
    viewCubeRef,
    axisHelperRef,
  );

  useChunkSceneGraph(
    refs,
    residentChunks,
    chunkVersion,
    sceneGeneration,
    selectedEntityKeys,
    hiddenEntityKeys,
    colorOverrides,
    selectedEntityKeysRef,
    hiddenEntityKeysRef,
    colorOverridesRef,
  );

  const disposeGroupChildren = useCallback((group: THREE.Group) => {
    group.children.slice().forEach((child) => {
      group.remove(child);
      child.traverse((object) => {
        const disposable = object as THREE.Object3D & {
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };
        disposable.geometry?.dispose();
        if (Array.isArray(disposable.material)) {
          disposable.material.forEach((material) => material.dispose());
        } else {
          disposable.material?.dispose();
        }
      });
    });
  }, []);

  useEffect(() => {
    const scene = refs.sceneRef.current;
    if (!scene) return;

    const measurementGroup = new THREE.Group();
    measurementGroup.name = "measurement-overlay";
    scene.add(measurementGroup);
    measurementGroupRef.current = measurementGroup;

    return () => {
      disposeGroupChildren(measurementGroup);
      scene.remove(measurementGroup);
      if (measurementGroupRef.current === measurementGroup) {
        measurementGroupRef.current = null;
      }
    };
  }, [disposeGroupChildren, refs, sceneGeneration]);

  useEffect(() => {
    const measurementGroup = measurementGroupRef.current;
    if (!measurementGroup) return;

    disposeGroupChildren(measurementGroup);

    if (!measurement.start) {
      refs.needsRenderRef.current = true;
      return;
    }

    const startPoint = new THREE.Vector3(...measurement.start.point);
    const boxSize = boundsFromTuple(manifest.modelBounds).getSize(
      new THREE.Vector3(),
    );
    const markerRadius = Math.max(boxSize.length() * 0.003, 0.05);

    const addMarker = (point: THREE.Vector3, color: string) => {
      const geometry = new THREE.SphereGeometry(markerRadius, 18, 14);
      const material = new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
      });
      const marker = new THREE.Mesh(geometry, material);
      marker.position.copy(point);
      marker.renderOrder = 1000;
      measurementGroup.add(marker);
    };

    addMarker(startPoint, "#f97316");

    const previewPoint = measurement.end
      ? new THREE.Vector3(...measurement.end.point)
      : measurementPreview
        ? measurementPreview.point.clone()
        : null;

    if (previewPoint) {
      const endPoint = previewPoint;
      addMarker(endPoint, "#38bdf8");

      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        startPoint,
        endPoint,
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: "#2563eb",
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.renderOrder = 999;
      measurementGroup.add(line);
    }

    refs.needsRenderRef.current = true;
  }, [disposeGroupChildren, manifest.modelBounds, measurement, measurementPreview, refs]);

  const homeToFit = useCallback(() => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls) return;
    fitCameraToBounds(camera, controls, boundsFromTuple(manifest.modelBounds));
  }, [manifest.modelBounds, refs]);

  const fitAllCurrentView = useCallback(() => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls) return;
    const direction = camera.position.clone().sub(controls.target);
    if (direction.lengthSq() === 0) direction.set(1, 0.75, 1);
    fitCameraToBoundsWithDirection(
      camera,
      controls,
      boundsFromTuple(manifest.modelBounds),
      direction,
    );
  }, [manifest.modelBounds, refs]);

  const setPresetView = useCallback(
    (view: "top" | "bottom" | "front" | "back" | "left" | "right") => {
      const camera = refs.cameraRef.current;
      const controls = refs.controlsRef.current;
      if (!camera || !controls) return;
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
    [manifest.modelBounds, refs],
  );

  const zoomIn = useCallback(() => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls) return;
    zoomCamera(camera, controls, 0.84);
    refs.needsRenderRef.current = true;
  }, [refs]);

  const zoomOut = useCallback(() => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls) return;
    zoomCamera(camera, controls, 1.2);
    refs.needsRenderRef.current = true;
  }, [refs]);

  const orbitFromViewCube = useCallback(
    (deltaX: number, deltaY: number) => {
      const camera = refs.cameraRef.current;
      const controls = refs.controlsRef.current;
      if (!camera || !controls) return;
      orbitCamera(camera, controls, deltaX, deltaY);
    },
    [refs],
  );

  useEffect(() => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls || viewportCommand.type === "none") return;
    if (viewportCommand.seq <= lastHandledViewportCommandSeqRef.current) return;
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

    if (viewportCommand.type === "fit-selected" && selectedEntityKeys.size > 0) {
      const selectedEntries = refs.meshEntriesRef.current.filter(
        (entry) => selectedEntityKeysRef.current.has(entry.entityKey) &&
          !hiddenEntityKeysRef.current.has(entry.entityKey),
      );
      if (selectedEntries.length === 0) return;
      const selectedBounds = new THREE.Box3();
      selectedEntries.forEach((entry) => expandBoundsForEntry(selectedBounds, entry));
      fitCameraToBounds(camera, controls, selectedBounds);
    }
  }, [
    fitAllCurrentView,
    homeToFit,
    manifest.modelBounds,
    refs,
    selectedEntityKeys,
    setPresetView,
    viewportCommand,
  ]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 min-h-0 [&_canvas]:block [&_canvas]:w-full [&_canvas]:h-full"
    >
      {rendererError ? (
        <div className="absolute inset-0 grid content-center justify-items-start gap-2 p-14 bg-gradient-to-b from-red-50/72 to-white/16 dark:border-slate-700 dark:bg-slate-800/82 dark:text-slate-400">
          <h1 className="m-0 text-text text-[clamp(1.9rem,3vw,2.6rem)] leading-[1.05] dark:text-slate-100">
            WebGL Renderer Error
          </h1>
          <p className="m-0 max-w-[560px] text-text-secondary">{rendererError}</p>
        </div>
      ) : null}
      {boxDrag && (
        <SelectionBox
          startX={boxDrag.startX}
          startY={boxDrag.startY}
          endX={boxDrag.endX}
          endY={boxDrag.endY}
        />
      )}
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
        interactionMode={interactionMode}
        measurement={measurement}
        onToggleMeasurementMode={toggleMeasurementMode}
        onClearMeasurement={clearMeasurement}
      />
    </div>
  );
}
