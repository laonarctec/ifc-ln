import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createBoxSelectionQuery,
  isPointInsideViewport,
  updatePointerFromClientPosition,
} from "./viewportPointerUtils";

function createCanvas() {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "getBoundingClientRect", {
    value: () => ({
      left: 10,
      top: 20,
      right: 210,
      bottom: 120,
      width: 200,
      height: 100,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    }),
  });
  return canvas;
}

describe("viewportPointerUtils", () => {
  it("converts client coordinates into viewport NDC", () => {
    const pointer = new THREE.Vector2();
    updatePointerFromClientPosition(createCanvas(), pointer, 110, 70);
    expect(pointer.x).toBeCloseTo(0, 6);
    expect(pointer.y).toBeCloseTo(0, 6);
  });

  it("checks whether a point lies inside the viewport bounds", () => {
    const canvas = createCanvas();
    expect(isPointInsideViewport(canvas, 10, 20)).toBe(true);
    expect(isPointInsideViewport(canvas, 210, 120)).toBe(true);
    expect(isPointInsideViewport(canvas, 5, 20)).toBe(false);
    expect(isPointInsideViewport(canvas, 10, 121)).toBe(false);
  });

  it("builds an NDC box query and crossing/window mode from drag direction", () => {
    const canvas = createCanvas();

    const windowQuery = createBoxSelectionQuery(canvas, 10, 20, 110, 70);
    expect(windowQuery.mode).toBe("window");
    expect(windowQuery.selMinX).toBeCloseTo(-1, 6);
    expect(windowQuery.selMaxX).toBeCloseTo(0, 6);
    expect(windowQuery.selMinY).toBeCloseTo(0, 6);
    expect(windowQuery.selMaxY).toBeCloseTo(1, 6);

    const crossingQuery = createBoxSelectionQuery(canvas, 110, 70, 10, 20);
    expect(crossingQuery.mode).toBe("crossing");
    expect(crossingQuery.selMinX).toBeCloseTo(-1, 6);
    expect(crossingQuery.selMaxX).toBeCloseTo(0, 6);
    expect(crossingQuery.selMinY).toBeCloseTo(0, 6);
    expect(crossingQuery.selMaxY).toBeCloseTo(1, 6);
  });
});
