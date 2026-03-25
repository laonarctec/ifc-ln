import { useEffect } from "react";
import * as THREE from "three";
import {
  pickHitAtPointer,
  pickEntitiesInBox,
  type RaycastHit,
  type BoxSelectionResult,
} from "@/components/viewer/viewport/raycasting";
import type { ModelEntityKey } from "@/utils/modelEntity";
import type { InteractionMode } from "@/stores/slices/toolsSlice";
import type { SceneRefs } from "./useThreeScene";

export interface BoxDragState {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface InputCallbacks {
  onSelectEntityRef: React.MutableRefObject<
    (modelId: number | null, expressId: number | null, additive?: boolean) => void
  >;
  onBoxSelectRef: React.MutableRefObject<
    ((results: BoxSelectionResult[], additive: boolean) => void) | undefined
  >;
  onBoxDragChangeRef: React.MutableRefObject<
    ((state: BoxDragState) => void) | undefined
  >;
  onMeasurePointRef: React.MutableRefObject<((hit: RaycastHit) => void) | undefined>;
  onMeasureHoverRef: React.MutableRefObject<((hit: RaycastHit | null) => void) | undefined>;
  interactionModeRef: React.MutableRefObject<InteractionMode>;
  onHoverEntityRef: React.MutableRefObject<
    ((
      modelId: number | null,
      expressId: number | null,
      position: { x: number; y: number } | null,
    ) => void) | undefined
  >;
  onContextMenuRef: React.MutableRefObject<
    ((
      modelId: number | null,
      expressId: number | null,
      position: { x: number; y: number },
    ) => void) | undefined
  >;
  hiddenEntityKeysRef: React.MutableRefObject<Set<ModelEntityKey>>;
}

export function useViewportInput(
  refs: SceneRefs,
  callbacks: InputCallbacks,
  sceneGeneration: number,
) {
  const {
    onSelectEntityRef,
    onBoxSelectRef,
    onBoxDragChangeRef,
    onMeasurePointRef,
    onMeasureHoverRef,
    interactionModeRef,
    onHoverEntityRef,
    onContextMenuRef,
    hiddenEntityKeysRef,
  } = callbacks;

  useEffect(() => {
    const renderer = refs.rendererRef.current;
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    const sceneRoot = refs.sceneRootRef.current;
    if (!renderer || !camera || !controls || !sceneRoot) return;

    const domElement = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    (raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const pointer = new THREE.Vector2();

    let pointerIsDown = false;
    let didDrag = false;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let rmbIsDown = false;
    let rmbDidDrag = false;
    let rmbDownX = 0;
    let rmbDownY = 0;

    // Box selection state
    let boxSelectActive = false;
    let boxStartX = 0;
    let boxStartY = 0;
    const BOX_DRAG_THRESHOLD = 6;

    const emitBoxDrag = (active: boolean, endX: number, endY: number) => {
      onBoxDragChangeRef.current?.({
        active,
        startX: boxStartX,
        startY: boxStartY,
        endX,
        endY,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 0) {
        pointerIsDown = true;
        didDrag = false;
        pointerDownX = event.clientX;
        pointerDownY = event.clientY;

        // Check if click starts on empty space → candidate for box select
        if (interactionModeRef.current === "select") {
          const rect = domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          const hit = pickHitAtPointer(pointer, raycaster, camera, sceneRoot, hiddenEntityKeysRef.current);
          if (!hit) {
            boxStartX = event.clientX;
            boxStartY = event.clientY;
            boxSelectActive = false; // will activate after threshold
          }
        }
      } else if (event.button === 2) {
        rmbIsDown = true;
        rmbDidDrag = false;
        rmbDownX = event.clientX;
        rmbDownY = event.clientY;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerIsDown) {
        const dist = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
        if (dist > 4) {
          didDrag = true;
        }
        // Activate box selection if started on empty space and exceeds threshold
        if (
          !boxSelectActive &&
          boxStartX !== 0 &&
          dist > BOX_DRAG_THRESHOLD &&
          interactionModeRef.current === "select"
        ) {
          boxSelectActive = true;
          // Disable OrbitControls so box drag doesn't orbit
          controls.enabled = false;
        }
        if (boxSelectActive) {
          emitBoxDrag(true, event.clientX, event.clientY);
        }
      }
      if (rmbIsDown) {
        if (Math.hypot(event.clientX - rmbDownX, event.clientY - rmbDownY) > 4) {
          rmbDidDrag = true;
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 0) {
        if (boxSelectActive) {
          // Finalize box selection
          const rect = domElement.getBoundingClientRect();
          const toNDCx = (px: number) => ((px - rect.left) / rect.width) * 2 - 1;
          const toNDCy = (py: number) => -((py - rect.top) / rect.height) * 2 + 1;

          const ndcX1 = toNDCx(boxStartX);
          const ndcY1 = toNDCy(boxStartY);
          const ndcX2 = toNDCx(event.clientX);
          const ndcY2 = toNDCy(event.clientY);

          const selMinX = Math.min(ndcX1, ndcX2);
          const selMinY = Math.min(ndcY1, ndcY2);
          const selMaxX = Math.max(ndcX1, ndcX2);
          const selMaxY = Math.max(ndcY1, ndcY2);

          // Left→right = window, right→left = crossing
          const mode: "window" | "crossing" =
            event.clientX >= boxStartX ? "window" : "crossing";

          const results = pickEntitiesInBox(
            selMinX, selMinY, selMaxX, selMaxY,
            mode, camera, sceneRoot, hiddenEntityKeysRef.current,
          );
          onBoxSelectRef.current?.(results, event.shiftKey);

          boxSelectActive = false;
          boxStartX = 0;
          boxStartY = 0;
          emitBoxDrag(false, 0, 0);
          controls.enabled = true;
        }
        pointerIsDown = false;
      } else if (event.button === 2) {
        rmbIsDown = false;
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (didDrag) { didDrag = false; return; }
      const rect = domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const hit = pickHitAtPointer(pointer, raycaster, camera, sceneRoot, hiddenEntityKeysRef.current);
      if (interactionModeRef.current === "measure-distance") {
        if (hit) {
          onMeasurePointRef.current?.(hit);
        }
        return;
      }
      const modelId = hit?.modelId ?? null;
      const expressId = hit?.expressId ?? null;
      if (expressId === null && !event.shiftKey) {
        onSelectEntityRef.current(null, null);
        return;
      }
      if (expressId !== null) {
        onSelectEntityRef.current(modelId, expressId, event.shiftKey);
      }
    };

    let lastHoverTime = 0;
    let lastHoveredId: number | null = null;
    let hoverClearTimer: ReturnType<typeof setTimeout> | null = null;
    const hoverPointer = new THREE.Vector2();

    const cancelHoverClear = () => {
      if (hoverClearTimer !== null) { clearTimeout(hoverClearTimer); hoverClearTimer = null; }
    };

    const clearHover = () => {
      cancelHoverClear();
      if (lastHoveredId !== null) {
        lastHoveredId = null;
      }
      onHoverEntityRef.current?.(null, null, null);
      onMeasureHoverRef.current?.(null);
    };

    const handleHoverMove = (event: MouseEvent) => {
      if (pointerIsDown || rmbIsDown) {
        clearHover();
        return;
      }
      const now = performance.now();
      if (now - lastHoverTime < 50) return;
      lastHoverTime = now;

      const rect = domElement.getBoundingClientRect();
      hoverPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      hoverPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const hoveredHit = pickHitAtPointer(hoverPointer, raycaster, camera, sceneRoot);
      const hoveredId = hoveredHit?.expressId ?? null;
      const hoveredModelId = hoveredHit?.modelId ?? null;
      onMeasureHoverRef.current?.(
        interactionModeRef.current === "measure-distance"
          ? hoveredHit ?? null
          : null,
      );

      if (hoveredId !== null) {
        cancelHoverClear();
        if (hoveredId !== lastHoveredId) {
          lastHoveredId = hoveredId;
          onHoverEntityRef.current?.(hoveredModelId, hoveredId, {
            x: event.clientX,
            y: event.clientY,
          });
        } else {
          onHoverEntityRef.current?.(hoveredModelId, hoveredId, {
            x: event.clientX,
            y: event.clientY,
          });
        }
      } else if (lastHoveredId !== null && hoverClearTimer === null) {
        // Grace period: defer clearing to tolerate intermittent raycast misses at mesh edges
        hoverClearTimer = setTimeout(() => {
          hoverClearTimer = null;
          lastHoveredId = null;
          onHoverEntityRef.current?.(null, null, null);
          onMeasureHoverRef.current?.(null);
        }, 150);
      }
    };

    const handleHoverLeave = () => {
      clearHover();
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (rmbDidDrag) { rmbDidDrag = false; return; }
      clearHover();
      const rect = domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const hit = pickHitAtPointer(pointer, raycaster, camera, sceneRoot, hiddenEntityKeysRef.current);
      const expressId = hit?.expressId ?? null;
      const modelId = hit?.modelId ?? null;
      if (expressId !== null) {
        onSelectEntityRef.current(modelId, expressId);
      }
      onContextMenuRef.current?.(modelId, expressId, {
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

    const handleControlsChange = () => {
      clearHover();
    };

    const handleWindowBlur = () => {
      clearHover();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        clearHover();
      }
    };

    // Adaptive wheel throttle
    const WHEEL_THROTTLE_MS_SMALL = 16;
    const WHEEL_THROTTLE_MS_MEDIUM = 25;
    const WHEEL_THROTTLE_MS_LARGE = 40;
    let lastWheelTime = 0;
    const handleWheelCapture = (event: WheelEvent) => {
      clearHover();
      const meshCount = refs.meshEntriesRef.current.length;
      const throttleMs =
        meshCount > 50000 ? WHEEL_THROTTLE_MS_LARGE
          : meshCount > 10000 ? WHEEL_THROTTLE_MS_MEDIUM
            : WHEEL_THROTTLE_MS_SMALL;
      const now = performance.now();
      if (now - lastWheelTime < throttleMs) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      lastWheelTime = now;
    };

    domElement.addEventListener("wheel", handleWheelCapture, { capture: true });
    domElement.addEventListener("pointerdown", handleCtrlRmbDown, { capture: true });
    window.addEventListener("pointerup", handleCtrlRmbUp);
    domElement.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    domElement.addEventListener("click", handleClick);
    domElement.addEventListener("mousemove", handleHoverMove);
    domElement.addEventListener("mouseleave", handleHoverLeave);
    domElement.addEventListener("pointerleave", handleHoverLeave);
    domElement.addEventListener("contextmenu", handleContextMenu);
    controls.addEventListener("change", handleControlsChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    clearHover();

    return () => {
      clearHover();
      domElement.removeEventListener("wheel", handleWheelCapture, { capture: true } as EventListenerOptions);
      domElement.removeEventListener("pointerdown", handleCtrlRmbDown, { capture: true });
      window.removeEventListener("pointerup", handleCtrlRmbUp);
      domElement.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      domElement.removeEventListener("click", handleClick);
      domElement.removeEventListener("mousemove", handleHoverMove);
      domElement.removeEventListener("mouseleave", handleHoverLeave);
      domElement.removeEventListener("pointerleave", handleHoverLeave);
      domElement.removeEventListener("contextmenu", handleContextMenu);
      controls.removeEventListener("change", handleControlsChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    interactionModeRef,
    onBoxDragChangeRef,
    onBoxSelectRef,
    onContextMenuRef,
    onHoverEntityRef,
    onMeasureHoverRef,
    onMeasurePointRef,
    onSelectEntityRef,
    refs,
    sceneGeneration,
  ]);
}
