import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ClippingState } from "@/stores/slices/clippingSlice";
import type { InteractionMode, MeasurementPoint } from "@/stores/slices/toolsSlice";
import type { ModelEntityKey } from "@/utils/modelEntity";
import {
  createDraftFromHit,
  projectRayOntoPlane,
  updateDraftFromPoint,
} from "@/components/viewer/viewport/clippingMath";
import type { QuantitySplitState } from "@/stores/slices/quantitySplitSlice";
import type {
  BoxSelectionResult,
  RaycastHit,
} from "@/components/viewer/viewport/raycasting";
import {
  useViewportInput,
  type BoxDragState,
  type ClippingPointerEvent,
} from "./useViewportInput";
import type { SceneRefs } from "./useThreeScene";

interface UseViewportInteractionBridgeOptions {
  refs: SceneRefs;
  sceneGeneration: number;
  clipping: ClippingState;
  clippingMinSize: number;
  interactionMode: InteractionMode;
  selectedModelId: number | null;
  selectedEntityIds: number[];
  hiddenEntityKeys: Set<ModelEntityKey>;
  onSelectEntity: (
    modelId: number | null,
    expressId: number | null,
    additive?: boolean,
  ) => void;
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
  placeMeasurementPoint: (point: MeasurementPoint) => void;
  updateClippingDraft: (draft: ClippingState["draft"]) => void;
  commitClippingDraft: () => void;
  selectClippingPlane: (planeId: string | null) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  quantitySplit: QuantitySplitState;
  addSplitLine: (start: [number, number], end: [number, number]) => void;
  setDrawingLineStart: (start: [number, number] | null) => void;
}

export function useViewportInteractionBridge({
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
  quantitySplit,
  addSplitLine,
  setDrawingLineStart,
}: UseViewportInteractionBridgeOptions) {
  const [measurementPreview, setMeasurementPreview] = useState<RaycastHit | null>(
    null,
  );
  const [boxDrag, setBoxDrag] = useState<BoxDragState | null>(null);

  const onSelectEntityRef = useRef(onSelectEntity);
  const onMeasurePointRef = useRef<((hit: RaycastHit) => void) | undefined>(
    undefined,
  );
  const onMeasureHoverRef = useRef<((hit: RaycastHit | null) => void) | undefined>(
    undefined,
  );
  const onClippingPlaceRef = useRef<((event: ClippingPointerEvent) => void) | undefined>(
    undefined,
  );
  const onClippingPreviewRef = useRef<((event: ClippingPointerEvent) => void) | undefined>(
    undefined,
  );
  const onDeselectClippingPlaneRef = useRef<(() => void) | undefined>(undefined);
  const onSplitPlaceRef = useRef<((event: ClippingPointerEvent) => void) | undefined>(
    undefined,
  );
  const onSplitPreviewRef = useRef<((event: ClippingPointerEvent) => void) | undefined>(
    undefined,
  );
  const onHoverEntityRef = useRef(onHoverEntity);
  const onContextMenuRef = useRef(onContextMenu);
  const onBoxSelectRef = useRef<
    ((results: BoxSelectionResult[], additive: boolean) => void) | undefined
  >(undefined);
  const onBoxDragChangeRef = useRef<((state: BoxDragState) => void) | undefined>(
    undefined,
  );
  const interactionModeRef = useRef(interactionMode);
  const selectedModelIdRef = useRef(selectedModelId);
  const selectedEntityIdsRef = useRef(selectedEntityIds);
  const hiddenEntityKeysRef = useRef(hiddenEntityKeys);

  useEffect(() => {
    onSelectEntityRef.current = onSelectEntity;
  }, [onSelectEntity]);

  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);

  useEffect(() => {
    selectedModelIdRef.current = selectedModelId;
  }, [selectedModelId]);

  useEffect(() => {
    selectedEntityIdsRef.current = selectedEntityIds;
  }, [selectedEntityIds]);

  useEffect(() => {
    hiddenEntityKeysRef.current = hiddenEntityKeys;
  }, [hiddenEntityKeys]);

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
    onClippingPlaceRef.current = (event) => {
      if (!clipping.draft) {
        if (!event.hit) return;
        updateClippingDraft(createDraftFromHit(event.hit));
        return;
      }

      if (!clipping.draft.origin || !clipping.draft.normal) return;
      const worldPoint = projectRayOntoPlane(
        event.ray,
        new THREE.Vector3(...clipping.draft.origin),
        new THREE.Vector3(...clipping.draft.normal),
      );
      if (!worldPoint) return;

      updateClippingDraft(
        updateDraftFromPoint(clipping.draft, worldPoint, clippingMinSize),
      );
      commitClippingDraft();
      setInteractionMode("select");
    };
  }, [
    clipping.draft,
    clippingMinSize,
    commitClippingDraft,
    setInteractionMode,
    updateClippingDraft,
  ]);

  useEffect(() => {
    onClippingPreviewRef.current = (event) => {
      if (!clipping.draft?.origin || !clipping.draft.normal) return;

      const worldPoint = projectRayOntoPlane(
        event.ray,
        new THREE.Vector3(...clipping.draft.origin),
        new THREE.Vector3(...clipping.draft.normal),
      );
      if (!worldPoint) return;

      updateClippingDraft(
        updateDraftFromPoint(clipping.draft, worldPoint, clippingMinSize),
      );
    };
  }, [clipping.draft, clippingMinSize, updateClippingDraft]);

  useEffect(() => {
    onDeselectClippingPlaneRef.current = () => {
      selectClippingPlane(null);
    };
  }, [selectClippingPlane]);

  useEffect(() => {
    onSplitPlaceRef.current = (event) => {
      if (!quantitySplit.active || !quantitySplit.bounds) return;
      const planeZ = quantitySplit.splitPlaneZ;
      const planeNormal = new THREE.Vector3(0, 0, 1);
      const planeOrigin = new THREE.Vector3(0, 0, planeZ);
      const worldPoint = projectRayOntoPlane(event.ray, planeOrigin, planeNormal);
      if (!worldPoint) return;

      const xy: [number, number] = [worldPoint.x, worldPoint.y];

      if (!quantitySplit.drawingLine) {
        setDrawingLineStart(xy);
      } else {
        addSplitLine(quantitySplit.drawingLine.start, xy);
      }
    };
  }, [quantitySplit, addSplitLine, setDrawingLineStart]);

  useEffect(() => {
    onSplitPreviewRef.current = (_event) => {
      // Preview line rendering handled by overlay hook
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

  useViewportInput(
    refs,
    {
      onSelectEntityRef,
      onBoxSelectRef,
      onBoxDragChangeRef,
      onMeasurePointRef,
      onMeasureHoverRef,
      onClippingPlaceRef,
      onClippingPreviewRef,
      onSplitPlaceRef,
      onSplitPreviewRef,
      onDeselectClippingPlaneRef,
      interactionModeRef,
      selectedModelIdRef,
      selectedEntityIdsRef,
      onHoverEntityRef,
      onContextMenuRef,
      hiddenEntityKeysRef,
    },
    sceneGeneration,
  );

  return {
    measurementPreview,
    boxDrag,
  };
}
