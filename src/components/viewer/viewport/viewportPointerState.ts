import { isPointInsideViewport } from "./viewportPointerUtils";

export function hasExceededPointerDragThreshold(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  threshold: number,
) {
  return Math.hypot(endX - startX, endY - startY) > threshold;
}

export function shouldActivateBoxSelection(params: {
  boxSelectActive: boolean;
  boxStartX: number | null;
  boxStartY: number | null;
  clientX: number;
  clientY: number;
  threshold: number;
  interactionMode: "select" | string;
}) {
  const {
    boxSelectActive,
    boxStartX,
    boxStartY,
    clientX,
    clientY,
    threshold,
    interactionMode,
  } = params;

  if (
    boxSelectActive ||
    boxStartX === null ||
    boxStartY === null ||
    interactionMode !== "select"
  ) {
    return false;
  }

  return hasExceededPointerDragThreshold(
    boxStartX,
    boxStartY,
    clientX,
    clientY,
    threshold,
  );
}

export function shouldOpenContextMenuOnPointerUp(params: {
  domElement: HTMLElement;
  isDown: boolean;
  didDrag: boolean;
  clientX: number;
  clientY: number;
}) {
  const { domElement, isDown, didDrag, clientX, clientY } = params;
  return (
    isDown &&
    !didDrag &&
    isPointInsideViewport(domElement, clientX, clientY)
  );
}
