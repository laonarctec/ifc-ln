import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
  boundsFromTuple,
  fitCameraToBounds,
  fitCameraToBoundsWithDirection,
  expandBoundsForEntry,
  zoomCamera,
  orbitCamera,
} from "./viewport/cameraMath";
import type { GeometryCacheEntry } from "./viewport/geometryFactory";
import type { RenderEntry, ChunkRenderGroup } from "./viewport/meshManagement";
import { useThreeScene, type SceneRefs } from "@/hooks/useThreeScene";
import { useViewportInput } from "@/hooks/useViewportInput";
import { useRenderLoop } from "@/hooks/useRenderLoop";
import { useChunkSceneGraph } from "@/hooks/useChunkSceneGraph";

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
  // --- Shared refs (individual hooks, then stable object) ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const sceneRootRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<ViewCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const needsRenderRef = useRef(true);
  const chunkGroupsRef = useRef<Map<number, ChunkRenderGroup>>(new Map());
  const meshEntriesRef = useRef<RenderEntry[]>([]);
  const entryIndexRef = useRef<Map<number, RenderEntry[]>>(new Map());
  const geometryCacheRef = useRef<Map<number, GeometryCacheEntry>>(new Map());

  // Stable object — refs never change identity, so this is safe
  const refsObj = useRef<SceneRefs>({
    containerRef, sceneRef, sceneRootRef, cameraRef, controlsRef,
    rendererRef, needsRenderRef, chunkGroupsRef, meshEntriesRef,
    entryIndexRef, geometryCacheRef,
  });
  const refs = refsObj.current;

  const onSelectEntityRef = useRef(onSelectEntity);
  const onHoverEntityRef = useRef(onHoverEntity);
  const onContextMenuRef = useRef(onContextMenu);
  const selectedEntityIdsRef = useRef(selectedEntityIds);
  const hiddenEntityIdsRef = useRef(hiddenEntityIds);
  const lastHandledViewportCommandSeqRef = useRef(0);
  const viewCubeRef = useRef<ViewCubeRef | null>(null);
  const axisHelperRef = useRef<AxisHelperRef | null>(null);

  // Keep callback refs up to date
  useEffect(() => { onSelectEntityRef.current = onSelectEntity; }, [onSelectEntity]);
  useEffect(() => { onHoverEntityRef.current = onHoverEntity; }, [onHoverEntity]);
  useEffect(() => { onContextMenuRef.current = onContextMenu; }, [onContextMenu]);

  // --- Hook 1: Scene setup ---
  const { rendererError, sceneGeneration } = useThreeScene(refs, projectionMode, manifest);

  // --- Hook 2: Input handlers ---
  useViewportInput(
    refs,
    { onSelectEntityRef, onHoverEntityRef, onContextMenuRef },
    sceneGeneration,
  );

  // --- Hook 3: Render loop ---
  const scaleLabel = useRenderLoop(
    refs, manifest, sceneGeneration, onVisibleChunkIdsChange,
    viewCubeRef, axisHelperRef,
  );

  // --- Hook 4: Chunk scene graph ---
  useChunkSceneGraph(
    refs, residentChunks, chunkVersion, sceneGeneration,
    selectedEntityIds, hiddenEntityIds,
    selectedEntityIdsRef, hiddenEntityIdsRef,
  );

  // --- Camera control callbacks ---
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
    fitCameraToBoundsWithDirection(camera, controls, boundsFromTuple(manifest.modelBounds), direction);
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
      fitCameraToBoundsWithDirection(camera, controls, boundsFromTuple(manifest.modelBounds), directionMap[view]);
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

  const orbitFromViewCube = useCallback((deltaX: number, deltaY: number) => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls) return;
    orbitCamera(camera, controls, deltaX, deltaY);
  }, [refs]);

  // --- Viewport commands ---
  useEffect(() => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls || viewportCommand.type === "none") return;
    if (viewportCommand.seq <= lastHandledViewportCommandSeqRef.current) return;
    lastHandledViewportCommandSeqRef.current = viewportCommand.seq;

    if (viewportCommand.type === "home") { homeToFit(); return; }
    if (viewportCommand.type === "fit-all") { fitAllCurrentView(); return; }

    if (
      viewportCommand.type === "view-front" || viewportCommand.type === "view-back" ||
      viewportCommand.type === "view-right" || viewportCommand.type === "view-left" ||
      viewportCommand.type === "view-top" || viewportCommand.type === "view-bottom" ||
      viewportCommand.type === "view-iso"
    ) {
      const viewMap: Record<string, () => void> = {
        "view-front": () => setPresetView("front"),
        "view-back": () => setPresetView("back"),
        "view-right": () => setPresetView("right"),
        "view-left": () => setPresetView("left"),
        "view-top": () => setPresetView("top"),
        "view-bottom": () => setPresetView("bottom"),
        "view-iso": () => fitCameraToBoundsWithDirection(
          camera, controls, boundsFromTuple(manifest.modelBounds), new THREE.Vector3(1, 0.75, 1),
        ),
      };
      viewMap[viewportCommand.type]();
      return;
    }

    if (viewportCommand.type === "fit-selected" && selectedEntityIds.length > 0) {
      const selectedEntries = refs.meshEntriesRef.current.filter(
        (entry) =>
          selectedEntityIdsRef.current.includes(entry.expressId) &&
          !hiddenEntityIdsRef.current.includes(entry.expressId),
      );
      if (selectedEntries.length === 0) return;
      const selectedBounds = new THREE.Box3();
      selectedEntries.forEach((entry) => expandBoundsForEntry(selectedBounds, entry));
      fitCameraToBounds(camera, controls, selectedBounds);
    }
  }, [
    homeToFit, fitAllCurrentView, setPresetView,
    manifest.modelBounds, selectedEntityIds.length, viewportCommand, refs,
  ]);

  // --- JSX ---
  return (
    <div ref={containerRef} className="absolute inset-0 min-h-0 [&_canvas]:block [&_canvas]:w-full [&_canvas]:h-full">
      {rendererError ? (
        <div className="absolute inset-0 grid content-center justify-items-start gap-2 p-14 bg-gradient-to-b from-red-50/72 to-white/16 dark:border-slate-700 dark:bg-slate-800/82 dark:text-slate-400">
          <h1 className="m-0 text-text text-[clamp(1.9rem,3vw,2.6rem)] leading-[1.05] dark:text-slate-100">WebGL Renderer Error</h1>
          <p className="m-0 max-w-[560px] text-text-secondary">{rendererError}</p>
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
