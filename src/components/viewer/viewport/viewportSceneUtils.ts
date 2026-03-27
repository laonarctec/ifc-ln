import * as THREE from "three";
import type { MeasurementState } from "@/stores/slices/toolsSlice";
import type { ViewportCommandType } from "@/stores/slices/uiSlice";
import type { RaycastHit } from "./raycasting";
import { boundsFromTuple } from "./cameraMath";

export type PresetViewport =
  | "top"
  | "bottom"
  | "front"
  | "back"
  | "left"
  | "right"
  | "iso";

export function calculateClippingMinSize(
  modelBounds: [number, number, number, number, number, number],
) {
  return Math.max(
    boundsFromTuple(modelBounds).getSize(new THREE.Vector3()).length() * 0.015,
    0.25,
  );
}

export function calculateMeasurementMarkerRadius(
  modelBounds: [number, number, number, number, number, number],
) {
  return Math.max(
    boundsFromTuple(modelBounds).getSize(new THREE.Vector3()).length() * 0.003,
    0.05,
  );
}

export function resolveMeasurementPreviewPoint(
  measurement: MeasurementState,
  measurementPreview: RaycastHit | null,
) {
  if (measurement.end) {
    return new THREE.Vector3(...measurement.end.point);
  }

  return measurementPreview ? measurementPreview.point.clone() : null;
}

export function resolvePresetViewportCommand(
  type: ViewportCommandType,
): PresetViewport | null {
  switch (type) {
    case "view-front":
      return "front";
    case "view-back":
      return "back";
    case "view-right":
      return "right";
    case "view-left":
      return "left";
    case "view-top":
      return "top";
    case "view-bottom":
      return "bottom";
    case "view-iso":
      return "iso";
    default:
      return null;
  }
}

export function createPresetViewDirection(
  view: Exclude<PresetViewport, "iso">,
) {
  const directionMap: Record<Exclude<PresetViewport, "iso">, THREE.Vector3> = {
    front: new THREE.Vector3(0, 0, 1),
    back: new THREE.Vector3(0, 0, -1),
    left: new THREE.Vector3(-1, 0, 0),
    right: new THREE.Vector3(1, 0, 0),
    top: new THREE.Vector3(0.0001, 1, 0.0001),
    bottom: new THREE.Vector3(0.0001, -1, 0.0001),
  };
  return directionMap[view].clone();
}

export function createIsoViewDirection() {
  return new THREE.Vector3(1, 0.75, 1);
}
