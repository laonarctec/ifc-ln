import { useEffect } from "react";
import * as THREE from "three";
import {
  pickHitAtPointer,
  pickPointerResultAtPointer,
  type RaycastHit,
  type BoxSelectionResult,
  type PointerPickResult,
} from "@/components/viewer/viewport/raycasting";
import { getActiveClippingPlanes } from "@/components/viewer/viewport/materialPool";
import {
  createViewportClickCommand,
  createViewportContextMenuCommand,
  createViewportHoverCommand,
} from "@/components/viewer/viewport/viewportInputCommands";
import { createViewportHoverState } from "@/components/viewer/viewport/viewportHoverState";
import {
  shouldActivateBoxSelection,
  shouldOpenContextMenuOnPointerUp,
} from "@/components/viewer/viewport/viewportPointerState";
import {
  activateBoxSelection,
  beginBoxSelectionCandidate,
  beginPrimaryPointerSession,
  beginSecondaryPointerSession,
  clearBoxSelectionSession,
  consumePrimaryPointerDrag,
  createViewportPointerSession,
  finishPrimaryPointerSession,
  finishSecondaryPointerSession,
  updatePrimaryPointerDrag,
  updateSecondaryPointerDrag,
} from "@/components/viewer/viewport/viewportPointerSession";
import {
  updatePointerFromClientPosition,
} from "@/components/viewer/viewport/viewportPointerUtils";
import {
  completeViewportBoxSelection,
  executeViewportContextMenuCommand,
} from "@/components/viewer/viewport/viewportInputEffects";
import {
  dispatchViewportClickCommand,
  dispatchViewportHoverCommand,
} from "@/components/viewer/viewport/viewportInputDispatch";
import { createViewportLifecycleHandlers } from "@/components/viewer/viewport/viewportInputLifecycle";
import { bindViewportInputEvents } from "@/components/viewer/viewport/viewportInputBindings";
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
  onSplitPlaceRef: React.MutableRefObject<
    ((event: ClippingPointerEvent) => void) | undefined
  >;
  onSplitPreviewRef: React.MutableRefObject<
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
    onSplitPlaceRef,
    onSplitPreviewRef,
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
    const hoverPointer = new THREE.Vector2();
    const pointerSession = createViewportPointerSession();
    const BOX_DRAG_THRESHOLD = 6;
    const hoverState = createViewportHoverState({
      onHoverEntity: (modelId, expressId, position) =>
        onHoverEntityRef.current?.(modelId, expressId, position),
      onMeasureHover: (hit) => onMeasureHoverRef.current?.(hit),
    });
    const lifecycleHandlers = createViewportLifecycleHandlers({
      controls,
      hoverState,
      getMeshCount: () => refs.meshEntriesRef.current.length,
    });

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
        startX: pointerSession.boxStartX ?? 0,
        startY: pointerSession.boxStartY ?? 0,
        endX,
        endY,
      });
    };

    const openContextMenuAt = (clientX: number, clientY: number) => {
      hoverState.clearHover();
      const contextMenuCommand = createViewportContextMenuCommand({
        result: pickFromClientPosition(clientX, clientY),
        hasSelection:
          selectedModelIdRef.current !== null &&
          selectedEntityIdsRef.current.length > 0,
      });
      executeViewportContextMenuCommand({
        command: contextMenuCommand,
        clientX,
        clientY,
        onSelectEntity: onSelectEntityRef.current,
        onContextMenu: onContextMenuRef.current,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 0) {
        beginPrimaryPointerSession(pointerSession, event.clientX, event.clientY);

        // Check if click starts on empty space → candidate for box select
        if (interactionModeRef.current === "select") {
          const result = pickFromClientPosition(event.clientX, event.clientY);
          if (result.kind === "miss") {
            beginBoxSelectionCandidate(pointerSession, event.clientX, event.clientY);
          }
        }
      } else if (event.button === 2) {
        beginSecondaryPointerSession(pointerSession, event.clientX, event.clientY);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerSession.pointerIsDown) {
        updatePrimaryPointerDrag(pointerSession, event.clientX, event.clientY, 4);
        if (
          shouldActivateBoxSelection({
            boxSelectActive: pointerSession.boxSelectActive,
            boxStartX: pointerSession.boxStartX,
            boxStartY: pointerSession.boxStartY,
            clientX: event.clientX,
            clientY: event.clientY,
            threshold: BOX_DRAG_THRESHOLD,
            interactionMode: interactionModeRef.current,
          })
        ) {
          activateBoxSelection(pointerSession);
          controls.enabled = false;
        }
        if (pointerSession.boxSelectActive) {
          emitBoxDrag(true, event.clientX, event.clientY);
        }
      }
      if (pointerSession.rmbIsDown) {
        updateSecondaryPointerDrag(pointerSession, event.clientX, event.clientY, 4);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 0) {
        if (pointerSession.boxSelectActive) {
          if (pointerSession.boxStartX === null || pointerSession.boxStartY === null) {
            clearBoxSelectionSession(pointerSession);
            controls.enabled = true;
            emitBoxDrag(false, 0, 0);
            finishPrimaryPointerSession(pointerSession);
            return;
          }
          completeViewportBoxSelection({
            domElement,
            startX: pointerSession.boxStartX,
            startY: pointerSession.boxStartY,
            endX: event.clientX,
            endY: event.clientY,
            camera,
            sceneRoot,
            hiddenEntityKeys: hiddenEntityKeysRef.current,
            clippingPlanes: getActiveClippingPlanes(),
            additive: event.shiftKey,
            onBoxSelect: onBoxSelectRef.current,
          });

          clearBoxSelectionSession(pointerSession);
          emitBoxDrag(false, 0, 0);
          controls.enabled = true;
        }
        finishPrimaryPointerSession(pointerSession);
      } else if (event.button === 2) {
        const shouldOpenContextMenu = shouldOpenContextMenuOnPointerUp({
          domElement,
          isDown: pointerSession.rmbIsDown,
          didDrag: pointerSession.rmbDidDrag,
          clientX: event.clientX,
          clientY: event.clientY,
        });
        finishSecondaryPointerSession(pointerSession);
        if (shouldOpenContextMenu) {
          openContextMenuAt(event.clientX, event.clientY);
        }
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (consumePrimaryPointerDrag(pointerSession)) { return; }
      const result = pickFromClientPosition(event.clientX, event.clientY);
      const clickCommand = createViewportClickCommand({
        interactionMode: interactionModeRef.current,
        result,
        fallbackHit:
          result.kind === "blocked"
            ? pickModelHitFromClientPosition(event.clientX, event.clientY)
            : null,
        additive: event.shiftKey,
      });
      dispatchViewportClickCommand({
        command: clickCommand,
        pointer,
        ray: raycaster.ray,
        clientX: event.clientX,
        clientY: event.clientY,
        onClippingPlace: onClippingPlaceRef.current,
        onSplitPlace: onSplitPlaceRef.current,
        onMeasurePoint: onMeasurePointRef.current,
        onSelectEntity: onSelectEntityRef.current,
        onDeselectClippingPlane: onDeselectClippingPlaneRef.current,
      });
    };

    const handleHoverMove = (event: MouseEvent) => {
      if (pointerSession.pointerIsDown || pointerSession.rmbIsDown) {
        hoverState.clearHover();
        return;
      }
      if (!hoverState.shouldProcessMove(performance.now())) return;

      const result = pickFromClientPosition(
        event.clientX,
        event.clientY,
        hoverPointer,
      );
      const hoverCommand = createViewportHoverCommand({
        interactionMode: interactionModeRef.current,
        result,
        fallbackHit:
          result.kind === "blocked"
            ? pickModelHitFromClientPosition(
                event.clientX,
                event.clientY,
                hoverPointer,
              )
            : null,
      });
      dispatchViewportHoverCommand({
        command: hoverCommand,
        hoverState,
        pointer: hoverPointer,
        ray: raycaster.ray,
        clientX: event.clientX,
        clientY: event.clientY,
        showMeasure: interactionModeRef.current === "measure-distance",
        onClippingPreview: onClippingPreviewRef.current,
        onSplitPreview: onSplitPreviewRef.current,
      });
    };

    const handleHoverLeave = () => {
      hoverState.clearHover();
    };

    return bindViewportInputEvents({
      domElement,
      controls,
      windowTarget: window,
      documentTarget: document,
      clearHover: () => hoverState.clearHover(),
      handleWheelCapture: lifecycleHandlers.handleWheelCapture,
      handleCtrlRmbDown: lifecycleHandlers.handleCtrlRmbDown,
      handleCtrlRmbUp: lifecycleHandlers.handleCtrlRmbUp,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handleClick,
      handleHoverMove,
      handleHoverLeave,
      handleContextMenu: lifecycleHandlers.handleContextMenu,
      handleControlsChange: lifecycleHandlers.handleControlsChange,
      handleWindowBlur: lifecycleHandlers.handleWindowBlur,
      handleVisibilityChange: lifecycleHandlers.handleVisibilityChange,
    });
  }, [
    refs,
    sceneGeneration,
    interactionModeRef,
    onBoxDragChangeRef,
    onBoxSelectRef,
    onClippingPlaceRef,
    onSplitPlaceRef,
    onSplitPreviewRef,
    onContextMenuRef,
    onHoverEntityRef,
    onMeasureHoverRef,
    onMeasurePointRef,
    onSelectEntityRef,
    selectedEntityIdsRef,
    selectedModelIdRef,
  ]);
}
