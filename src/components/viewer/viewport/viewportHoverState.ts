import type { RaycastHit } from "./raycasting";

export interface HoverPosition {
  x: number;
  y: number;
}

interface CreateViewportHoverStateOptions {
  onHoverEntity: (
    modelId: number | null,
    expressId: number | null,
    position: HoverPosition | null,
  ) => void;
  onMeasureHover: (hit: RaycastHit | null) => void;
  throttleMs?: number;
  clearDelayMs?: number;
}

export interface ViewportHoverStateController {
  shouldProcessMove: (now: number) => boolean;
  clearHover: () => void;
  updateHover: (params: {
    hit: RaycastHit | null;
    position: HoverPosition;
    showMeasure: boolean;
  }) => void;
}

export function createViewportHoverState(
  options: CreateViewportHoverStateOptions,
): ViewportHoverStateController {
  const throttleMs = options.throttleMs ?? 50;
  const clearDelayMs = options.clearDelayMs ?? 150;

  let lastHoverTime = 0;
  let lastHoveredId: number | null = null;
  let hoverClearTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelHoverClear = () => {
    if (hoverClearTimer !== null) {
      clearTimeout(hoverClearTimer);
      hoverClearTimer = null;
    }
  };

  const clearHover = () => {
    cancelHoverClear();
    if (lastHoveredId !== null) {
      lastHoveredId = null;
    }
    options.onHoverEntity(null, null, null);
    options.onMeasureHover(null);
  };

  const shouldProcessMove = (now: number) => {
    if (now - lastHoverTime < throttleMs) {
      return false;
    }
    lastHoverTime = now;
    return true;
  };

  const updateHover = ({
    hit,
    position,
    showMeasure,
  }: {
    hit: RaycastHit | null;
    position: HoverPosition;
    showMeasure: boolean;
  }) => {
    const hoveredId = hit?.expressId ?? null;
    const hoveredModelId = hit?.modelId ?? null;

    options.onMeasureHover(showMeasure ? hit : null);

    if (hoveredId !== null) {
      cancelHoverClear();
      lastHoveredId = hoveredId;
      options.onHoverEntity(hoveredModelId, hoveredId, position);
      return;
    }

    if (lastHoveredId !== null && hoverClearTimer === null) {
      hoverClearTimer = setTimeout(() => {
        hoverClearTimer = null;
        lastHoveredId = null;
        options.onHoverEntity(null, null, null);
        options.onMeasureHover(null);
      }, clearDelayMs);
    }
  };

  return {
    shouldProcessMove,
    clearHover,
    updateHover,
  };
}
