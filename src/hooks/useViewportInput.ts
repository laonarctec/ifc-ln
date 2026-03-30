import { useEffect } from "react";
import * as THREE from "three";
import {
  pickHitAtPointer,
  pickPointerResultAtPointer,
  pickEntitiesInBox,
  type RaycastHit,
  type BoxSelectionResult,
  type PointerPickResult,
} from "@/components/viewer/viewport/raycasting";
import { getActiveClippingPlanes } from "@/components/viewer/viewport/materialPool";
import {
  createBoxSelectionQuery,
  isPointInsideViewport,
  updatePointerFromClientPosition,
} from "@/components/viewer/viewport/viewportPointerUtils";
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

export interface ClippingPointerEvent {
  hit: RaycastHit | null;
  pointer: THREE.Vector2;
  ray: THREE.Ray;
  clientX: number;
  clientY: number;
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
  onClippingPlaceRef: React.MutableRefObject<
    ((event: ClippingPointerEvent) => void) | undefined
  >;
  onClippingPreviewRef: React.MutableRefObject<
    ((event: ClippingPointerEvent) => void) | undefined
  >;
  onDeselectClippingPlaneRef: React.MutableRefObject<(() => void) | undefined>;
  interactionModeRef: React.MutableRefObject<InteractionMode>;
  selectedModelIdRef: React.MutableRefObject<number | null>;
  selectedEntityIdsRef: React.MutableRefObject<number[]>;
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
    onClippingPlaceRef,
    onClippingPreviewRef,
    onDeselectClippingPlaneRef,
    interactionModeRef,
    selectedModelIdRef,
    selectedEntityIdsRef,
    onHoverEntityRef,
    onContextMenuRef,
    hiddenEntityKeysRef,
  } = callbacks;

  useEffect(() => {
    const renderer = refs.rendererRef.current;
    const scene = refs.sceneRef.current;
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    const sceneRoot = refs.sceneRootRef.current;
    if (!renderer || !camera || !controls || !sceneRoot) return;
    const selectionRoot = scene ?? sceneRoot;

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
    let boxStartX: number | null = null;
    let boxStartY: number | null = null;
    const BOX_DRAG_THRESHOLD = 6;

    const pickFromClientPosition = (
      clientX: number,
      clientY: number,
      target: THREE.Vector2 = pointer,
    ): PointerPickResult => {
      updatePointerFromClientPosition(domElement, target, clientX, clientY);
      return pickPointerResultAtPointer(
        target,
        raycaster,
        camera,
        selectionRoot,
        hiddenEntityKeysRef.current,
        getActiveClippingPlanes(),
      );
    };

    const pickModelHitFromClientPosition = (
      clientX: number,
      clientY: number,
      target: THREE.Vector2 = pointer,
    ) => {
      updatePointerFromClientPosition(domElement, target, clientX, clientY);
      return pickHitAtPointer(
        target,
        raycaster,
        camera,
        sceneRoot,
        hiddenEntityKeysRef.current,
        getActiveClippingPlanes(),
      );
    };

    const emitBoxDrag = (active: boolean, endX: number, endY: number) => {
      onBoxDragChangeRef.current?.({
        active,
        startX: boxStartX ?? 0,
        startY: boxStartY ?? 0,
        endX,
        endY,
      });
    };

    const openContextMenuAt = (clientX: number, clientY: number) => {
      clearHover();
      const result = pickFromClientPosition(clientX, clientY);
      if (result.kind === "blocked") {
        return;
      }
      const hit = result.kind === "hit" ? result.hit : null;
      const expressId = hit?.expressId ?? null;
      const modelId = hit?.modelId ?? null;
      const hasSelection =
        selectedModelIdRef.current !== null &&
        selectedEntityIdsRef.current.length > 0;

      if (!hasSelection && expressId !== null) {
        onSelectEntityRef.current(modelId, expressId);
      }

      onContextMenuRef.current?.(modelId, expressId, {
        x: clientX,
        y: clientY,
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
          const result = pickFromClientPosition(event.clientX, event.clientY);
          if (result.kind === "miss") {
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
          boxStartX !== null &&
          boxStartY !== null &&
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
          if (boxStartX === null || boxStartY === null) {
            boxSelectActive = false;
            controls.enabled = true;
            emitBoxDrag(false, 0, 0);
            pointerIsDown = false;
            return;
          }
          const selectionQuery = createBoxSelectionQuery(
            domElement,
            boxStartX,
            boxStartY,
            event.clientX,
            event.clientY,
          );

          const results = pickEntitiesInBox(
            selectionQuery.selMinX,
            selectionQuery.selMinY,
            selectionQuery.selMaxX,
            selectionQuery.selMaxY,
            selectionQuery.mode,
            camera,
            sceneRoot,
            hiddenEntityKeysRef.current,
            getActiveClippingPlanes(),
          );
          onBoxSelectRef.current?.(results, event.shiftKey);

          boxSelectActive = false;
          boxStartX = null;
          boxStartY = null;
          emitBoxDrag(false, 0, 0);
          controls.enabled = true;
        }
        pointerIsDown = false;
      } else if (event.button === 2) {
        const shouldOpenContextMenu =
          rmbIsDown &&
          !rmbDidDrag &&
          isPointInsideViewport(domElement, event.clientX, event.clientY);
        rmbIsDown = false;
        rmbDidDrag = false;
        if (shouldOpenContextMenu) {
          openContextMenuAt(event.clientX, event.clientY);
        }
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (didDrag) { didDrag = false; return; }
      const result = pickFromClientPosition(event.clientX, event.clientY);
      if (interactionModeRef.current === "create-clipping-plane") {
        const hit =
          result.kind === "hit"
            ? result.hit
            : result.kind === "blocked"
              ? pickModelHitFromClientPosition(event.clientX, event.clientY)
              : null;
        onClippingPlaceRef.current?.({
          hit,
          pointer: pointer.clone(),
          ray: raycaster.ray.clone(),
          clientX: event.clientX,
          clientY: event.clientY,
        });
        return;
      }
      if (result.kind === "blocked") {
        return;
      }
      const hit = result.kind === "hit" ? result.hit : null;
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
        onDeselectClippingPlaneRef.current?.();
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

      const result = pickFromClientPosition(
        event.clientX,
        event.clientY,
        hoverPointer,
      );
      if (interactionModeRef.current === "create-clipping-plane") {
        const hoveredHit =
          result.kind === "hit"
            ? result.hit
            : result.kind === "blocked"
              ? pickModelHitFromClientPosition(
                  event.clientX,
                  event.clientY,
                  hoverPointer,
                )
              : null;
        clearHover();
        onClippingPreviewRef.current?.({
          hit: hoveredHit ?? null,
          pointer: hoverPointer.clone(),
          ray: raycaster.ray.clone(),
          clientX: event.clientX,
          clientY: event.clientY,
        });
        return;
      }
      if (result.kind === "blocked") {
        clearHover();
        return;
      }
      const hoveredHit = result.kind === "hit" ? result.hit : null;
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
    onClippingPlaceRef,
    onContextMenuRef,
    onHoverEntityRef,
    onMeasureHoverRef,
    onMeasurePointRef,
    onSelectEntityRef,
    selectedEntityIdsRef,
    selectedModelIdRef,
    refs,
    sceneGeneration,
  ]);
}
