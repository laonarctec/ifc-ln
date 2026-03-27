import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  calculateClippingMinSize,
  calculateMeasurementMarkerRadius,
  createIsoViewDirection,
  createPresetViewDirection,
  resolveMeasurementPreviewPoint,
  resolvePresetViewportCommand,
} from "./viewportSceneUtils";

describe("viewportSceneUtils", () => {
  it("calculates bounded clipping min size from model bounds", () => {
    expect(calculateClippingMinSize([0, 0, 0, 20, 20, 20])).toBeGreaterThan(0.25);
    expect(calculateClippingMinSize([0, 0, 0, 0.1, 0.1, 0.1])).toBe(0.25);
  });

  it("calculates bounded measurement marker radius", () => {
    expect(calculateMeasurementMarkerRadius([0, 0, 0, 20, 20, 20])).toBeGreaterThan(0.05);
    expect(calculateMeasurementMarkerRadius([0, 0, 0, 0.1, 0.1, 0.1])).toBe(0.05);
  });

  it("resolves measurement preview point from completed or preview measurements", () => {
    expect(
      resolveMeasurementPreviewPoint(
        {
          mode: "complete",
          start: { expressId: 1, point: [0, 0, 0] },
          end: { expressId: 2, point: [1, 2, 3] },
          distance: 1,
        },
        null,
      )?.toArray(),
    ).toEqual([1, 2, 3]);

    expect(
      resolveMeasurementPreviewPoint(
        {
          mode: "placing-second",
          start: { expressId: 1, point: [0, 0, 0] },
          end: null,
          distance: null,
        },
        {
          modelId: 7,
          expressId: 2,
          point: new THREE.Vector3(4, 5, 6),
          faceNormal: null,
          object: new THREE.Mesh(),
          instanceId: null,
        },
      )?.toArray(),
    ).toEqual([4, 5, 6]);
  });

  it("resolves preset viewport command mappings and directions", () => {
    expect(resolvePresetViewportCommand("view-front")).toBe("front");
    expect(resolvePresetViewportCommand("fit-all")).toBeNull();
    expect(createPresetViewDirection("top").toArray()).toEqual([0.0001, 1, 0.0001]);
    expect(createIsoViewDirection().toArray()).toEqual([1, 0.75, 1]);
  });
});
