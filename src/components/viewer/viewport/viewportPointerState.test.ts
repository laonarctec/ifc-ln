import { describe, expect, it } from "vitest";
import {
  hasExceededPointerDragThreshold,
  shouldActivateBoxSelection,
  shouldOpenContextMenuOnPointerUp,
} from "./viewportPointerState";

function createCanvas() {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "getBoundingClientRect", {
    value: () => ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  return canvas;
}

describe("viewportPointerState", () => {
  it("detects when pointer drag exceeds a threshold", () => {
    expect(hasExceededPointerDragThreshold(0, 0, 3, 3, 4)).toBe(true);
    expect(hasExceededPointerDragThreshold(0, 0, 2, 2, 4)).toBe(false);
  });

  it("activates box selection only for select mode after threshold", () => {
    expect(
      shouldActivateBoxSelection({
        boxSelectActive: false,
        boxStartX: 0,
        boxStartY: 0,
        clientX: 7,
        clientY: 0,
        threshold: 6,
        interactionMode: "select",
      }),
    ).toBe(true);

    expect(
      shouldActivateBoxSelection({
        boxSelectActive: false,
        boxStartX: 0,
        boxStartY: 0,
        clientX: 7,
        clientY: 0,
        threshold: 6,
        interactionMode: "measure-distance",
      }),
    ).toBe(false);
  });

  it("opens context menu only for stationary RMB release inside the viewport", () => {
    const canvas = createCanvas();
    expect(
      shouldOpenContextMenuOnPointerUp({
        domElement: canvas,
        isDown: true,
        didDrag: false,
        clientX: 50,
        clientY: 20,
      }),
    ).toBe(true);

    expect(
      shouldOpenContextMenuOnPointerUp({
        domElement: canvas,
        isDown: true,
        didDrag: true,
        clientX: 50,
        clientY: 20,
      }),
    ).toBe(false);

    expect(
      shouldOpenContextMenuOnPointerUp({
        domElement: canvas,
        isDown: true,
        didDrag: false,
        clientX: 250,
        clientY: 20,
      }),
    ).toBe(false);
  });
});
