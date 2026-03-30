import * as THREE from "three";
import type {
  ViewportClickCommand,
  ViewportHoverCommand,
} from "./viewportInputCommands";
import type { ViewportHoverStateController } from "./viewportHoverState";
import type { RaycastHit } from "./raycasting";

interface PointerDispatchPayload {
  hit: RaycastHit | null;
  pointer: THREE.Vector2;
  ray: THREE.Ray;
  clientX: number;
  clientY: number;
}

export function dispatchViewportClickCommand(params: {
  command: ViewportClickCommand;
  pointer: THREE.Vector2;
  ray: THREE.Ray;
  clientX: number;
  clientY: number;
  onClippingPlace?: (payload: PointerDispatchPayload) => void;
  onSplitPlace?: (payload: PointerDispatchPayload) => void;
  onMeasurePoint?: (hit: RaycastHit) => void;
  onSelectEntity: (
    modelId: number | null,
    expressId: number | null,
    additive?: boolean,
  ) => void;
  onDeselectClippingPlane?: () => void;
}) {
  const {
    command,
    pointer,
    ray,
    clientX,
    clientY,
    onClippingPlace,
    onSplitPlace,
    onMeasurePoint,
    onSelectEntity,
    onDeselectClippingPlane,
  } = params;

  if (command.kind === "split-place") {
    onSplitPlace?.({
      hit: command.hit,
      pointer: pointer.clone(),
      ray: ray.clone(),
      clientX,
      clientY,
    });
    return;
  }

  if (command.kind === "clipping-place") {
    onClippingPlace?.({
      hit: command.hit,
      pointer: pointer.clone(),
      ray: ray.clone(),
      clientX,
      clientY,
    });
    return;
  }

  if (command.kind === "blocked" || command.kind === "none") {
    return;
  }

  if (command.kind === "measure-point") {
    onMeasurePoint?.(command.hit);
    return;
  }

  if (command.kind === "clear-selection") {
    onSelectEntity(null, null);
    onDeselectClippingPlane?.();
    return;
  }

  onSelectEntity(
    command.modelId,
    command.expressId,
    command.additive,
  );
}

export function dispatchViewportHoverCommand(params: {
  command: ViewportHoverCommand;
  hoverState: ViewportHoverStateController;
  pointer: THREE.Vector2;
  ray: THREE.Ray;
  clientX: number;
  clientY: number;
  showMeasure: boolean;
  onClippingPreview?: (payload: PointerDispatchPayload) => void;
  onSplitPreview?: (payload: PointerDispatchPayload) => void;
}) {
  const {
    command,
    hoverState,
    pointer,
    ray,
    clientX,
    clientY,
    showMeasure,
    onClippingPreview,
    onSplitPreview,
  } = params;

  if (command.kind === "split-preview") {
    hoverState.clearHover();
    onSplitPreview?.({
      hit: command.hit,
      pointer: pointer.clone(),
      ray: ray.clone(),
      clientX,
      clientY,
    });
    return;
  }

  if (command.kind === "clipping-preview") {
    hoverState.clearHover();
    onClippingPreview?.({
      hit: command.hit,
      pointer: pointer.clone(),
      ray: ray.clone(),
      clientX,
      clientY,
    });
    return;
  }

  if (command.kind === "blocked") {
    hoverState.clearHover();
    return;
  }

  hoverState.updateHover({
    hit: command.hit,
    position: { x: clientX, y: clientY },
    showMeasure,
  });
}
