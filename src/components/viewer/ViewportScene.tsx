import { useEffect, useMemo, useRef } from "react";
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
import { type ViewCamera } from "./viewport/cameraMath";
import type { GeometryCacheEntry } from "./viewport/geometryFactory";
import type { ChunkRenderGroup, RenderEntry } from "./viewport/meshManagement";
import type { BoxSelectionResult } from "./viewport/raycasting";
import {
  calculateClippingMinSize,
} from "./viewport/viewportSceneUtils";
import { useAutoStoreyTracking } from "@/hooks/useAutoStoreyTracking";
import { useChunkSceneGraph } from "@/hooks/useChunkSceneGraph";
import { useClippingPlane } from "@/hooks/useClippingPlane";
import { useMeasurementOverlay } from "@/hooks/useMeasurementOverlay";
import { useRenderLoop } from "@/hooks/useRenderLoop";
import { useThreeScene, type SceneRefs } from "@/hooks/useThreeScene";
import { useViewportCameraControls } from "@/hooks/useViewportCameraControls";
import { useViewportInteractionBridge } from "@/hooks/useViewportInteractionBridge";

interface ViewportSceneProps {
  manifest: RenderManifest;
  manifests: RenderManifest[];
  residentChunks: RenderChunkPayload[];
  chunkVersion: number;
  selectedModelId: number | null;
  selectedEntityIds: number[];
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
  selectedModelId,
  selectedEntityIds,
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

  const interactionMode = useViewerStore((state) => state.interactionMode);
  const measurement = useViewerStore((state) => state.measurement);
  const toggleMeasurementMode = useViewerStore(
    (state) => state.toggleMeasurementMode,
  );
  const clearMeasurement = useViewerStore((state) => state.clearMeasurement);
  const placeMeasurementPoint = useViewerStore(
    (state) => state.placeMeasurementPoint,
  );
  const clipping = useViewerStore((state) => state.clipping);
  const updateClippingDraft = useViewerStore((state) => state.updateClippingDraft);
  const commitClippingDraft = useViewerStore((state) => state.commitClippingDraft);
  const cancelClippingDraft = useViewerStore((state) => state.cancelClippingDraft);
  const selectClippingPlane = useViewerStore((state) => state.selectClippingPlane);
  const setInteractionMode = useViewerStore((state) => state.setInteractionMode);
  const selectedEntityKeysRef = useRef(selectedEntityKeys);
  const hiddenEntityKeysRef = useRef(hiddenEntityKeys);
  const colorOverridesRef = useRef(colorOverrides);
  const viewCubeRef = useRef<ViewCubeRef | null>(null);
  const axisHelperRef = useRef<AxisHelperRef | null>(null);
  const clippingMinSize = useMemo(
    () => calculateClippingMinSize(manifest.modelBounds),
    [manifest.modelBounds],
  );
  // Sync interactionMode when clipping mode changes
  useEffect(() => {
    if (clipping.mode === "creating") {
      setInteractionMode("create-clipping-plane");
    } else if (interactionMode === "create-clipping-plane") {
      setInteractionMode("select");
    }
  }, [clipping.mode, interactionMode, setInteractionMode]);

  const { rendererError, sceneGeneration } = useThreeScene(
    refs,
    projectionMode,
    manifest,
  );

  const { measurementPreview, boxDrag } = useViewportInteractionBridge(
    {
      refs,
      sceneGeneration,
      clipping,
      clippingMinSize,
      interactionMode,
      selectedModelId,
      selectedEntityIds,
      hiddenEntityKeys,
      onSelectEntity,
      onHoverEntity,
      onContextMenu,
      onBoxSelect,
      placeMeasurementPoint,
      updateClippingDraft,
      commitClippingDraft,
      selectClippingPlane,
      setInteractionMode,
    },
  );

  useClippingPlane(
    refs,
    manifest,
    chunkVersion,
    sceneGeneration,
  );

  useMeasurementOverlay(
    refs,
    sceneGeneration,
    manifest.modelBounds,
    measurement,
    measurementPreview,
  );

  useEffect(() => {
    if (interactionMode !== "create-clipping-plane") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelClippingDraft();
      setInteractionMode("select");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelClippingDraft, interactionMode, setInteractionMode]);

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

  // Auto storey tracking: switch active storey based on camera orbit target height
  const modelBoundsY = useMemo<[number, number] | undefined>(() => {
    if (!manifest) return undefined;
    // modelBounds = [minX, minY, minZ, maxX, maxY, maxZ]
    return [manifest.modelBounds[1], manifest.modelBounds[4]];
  }, [manifest.modelBounds]);

  useAutoStoreyTracking(controlsRef, modelBoundsY);

  const {
    homeToFit,
    fitAllCurrentView,
    setPresetView,
    zoomIn,
    zoomOut,
    orbitFromViewCube,
  } = useViewportCameraControls({
    refs,
    modelBounds: manifest.modelBounds,
    viewportCommand,
    selectedEntityKeys,
    hiddenEntityKeys,
  });

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 min-h-0 [&_canvas]:block [&_canvas]:w-full [&_canvas]:h-full"
    >
      {rendererError ? (
        <div className="absolute inset-0 grid content-center justify-items-start gap-2 p-14 bg-linear-to-b from-red-50/72 to-white/16 dark:border-slate-700 dark:bg-slate-800/82 dark:text-slate-400">
          <h1 className="m-0 text-text text-[clamp(1.9rem,3vw,2.6rem)] leading-[1.05] dark:text-slate-100">
            WebGL Renderer Error
          </h1>
          <p className="m-0 max-w-160 text-text-secondary">{rendererError}</p>
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
