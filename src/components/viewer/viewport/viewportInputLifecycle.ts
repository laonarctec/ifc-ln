import * as THREE from "three";
import type { ViewportHoverStateController } from "./viewportHoverState";
import { getViewportWheelThrottleMs } from "./viewportInputEffects";

interface ViewportControlsButtons {
  mouseButtons: {
    RIGHT?: THREE.MOUSE | null | undefined;
  };
}

interface CreateViewportLifecycleHandlersOptions {
  controls: ViewportControlsButtons;
  hoverState: Pick<ViewportHoverStateController, "clearHover">;
  getMeshCount: () => number;
  now?: () => number;
  getVisibilityState?: () => DocumentVisibilityState;
}

export function createViewportLifecycleHandlers(
  options: CreateViewportLifecycleHandlersOptions,
) {
  const {
    controls,
    hoverState,
    getMeshCount,
    now = () => performance.now(),
    getVisibilityState = () => document.visibilityState,
  } = options;

  let lastWheelTime = 0;

  return {
    handleContextMenu(event: MouseEvent) {
      event.preventDefault();
    },

    handleCtrlRmbDown(event: PointerEvent) {
      if (event.button === 2 && (event.ctrlKey || event.metaKey)) {
        controls.mouseButtons.RIGHT = THREE.MOUSE.DOLLY;
      }
    },

    handleCtrlRmbUp(event: PointerEvent) {
      if (event.button === 2) {
        controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
      }
    },

    handleControlsChange() {
      hoverState.clearHover();
    },

    handleWindowBlur() {
      hoverState.clearHover();
    },

    handleVisibilityChange() {
      if (getVisibilityState() !== "visible") {
        hoverState.clearHover();
      }
    },

    handleWheelCapture(event: WheelEvent) {
      hoverState.clearHover();
      const throttleMs = getViewportWheelThrottleMs(getMeshCount());
      const currentTime = now();
      if (currentTime - lastWheelTime < throttleMs) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
      lastWheelTime = currentTime;
      return false;
    },
  };
}
