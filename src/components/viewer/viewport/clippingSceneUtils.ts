import * as THREE from "three";
import type { ClippingPlaneObject } from "@/stores/slices/clippingSlice";
import { boundsFromTuple } from "./cameraMath";

export interface ClippingPlaneLabel {
  id: string;
  name: string;
  left: number;
  top: number;
  selected: boolean;
}

export interface ClippingSceneMetrics {
  modelSize: number;
  minPlaneSize: number;
  widgetScale: number;
  gumballScale: number;
  sectionEdgeOffset: number;
  labelOffset: number;
}

export function calculateClippingSceneMetrics(
  modelBounds: [number, number, number, number, number, number],
): ClippingSceneMetrics {
  const modelSize = Math.max(
    boundsFromTuple(modelBounds).getSize(new THREE.Vector3()).length(),
    1,
  );

  return {
    modelSize,
    minPlaneSize: Math.max(modelSize * 0.015, 0.25),
    widgetScale: Math.max(modelSize * 0.08, 0.2),
    gumballScale: Math.max(modelSize * 0.1, 0.5),
    sectionEdgeOffset: THREE.MathUtils.clamp(modelSize * 0.00035, 0.0002, 0.003),
    labelOffset: modelSize * 0.01,
  };
}

type LabelPlane = Pick<
  ClippingPlaneObject,
  | "id"
  | "name"
  | "enabled"
  | "labelVisible"
  | "origin"
  | "vAxis"
  | "normal"
  | "height"
  | "selected"
>;

export function projectClippingPlaneLabels(
  planes: LabelPlane[],
  camera: THREE.Camera,
  viewportSize: { width: number; height: number },
  labelOffset: number,
): ClippingPlaneLabel[] {
  if (viewportSize.width <= 0 || viewportSize.height <= 0) {
    return [];
  }

  return planes
    .filter((plane) => plane.enabled && plane.labelVisible)
    .map((plane) => {
      const origin = new THREE.Vector3(...plane.origin);
      const vAxis = new THREE.Vector3(...plane.vAxis).normalize();
      const normal = new THREE.Vector3(...plane.normal).normalize();
      const anchor = origin
        .clone()
        .addScaledVector(vAxis, plane.height * 0.5 + labelOffset)
        .addScaledVector(normal, labelOffset);

      const projected = anchor.project(camera);
      return {
        id: plane.id,
        name: plane.name,
        left: ((projected.x + 1) * 0.5) * viewportSize.width,
        top: ((1 - projected.y) * 0.5) * viewportSize.height,
        selected: plane.selected,
        hidden: projected.z < -1 || projected.z > 1,
      };
    })
    .filter((label) => !label.hidden)
    .map(({ hidden: _hidden, ...label }) => label);
}
