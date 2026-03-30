import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createViewportLifecycleHandlers } from "./viewportInputLifecycle";

describe("viewportInputLifecycle", () => {
  it("switches Ctrl+RMB to dolly and restores rotate on pointer up", () => {
    const controls = {
      mouseButtons: {
        RIGHT: THREE.MOUSE.ROTATE,
      },
    };
    const hoverState = {
      clearHover: vi.fn(),
    };
    const handlers = createViewportLifecycleHandlers({
      controls,
      hoverState,
      getMeshCount: () => 0,
    });

    handlers.handleCtrlRmbDown({
      button: 2,
      ctrlKey: true,
      metaKey: false,
    } as PointerEvent);
    expect(controls.mouseButtons.RIGHT).toBe(THREE.MOUSE.DOLLY);

    handlers.handleCtrlRmbUp({
      button: 2,
    } as PointerEvent);
    expect(controls.mouseButtons.RIGHT).toBe(THREE.MOUSE.ROTATE);
  });

  it("throttles wheel capture based on mesh count and clears hover", () => {
    const controls = {
      mouseButtons: {
        RIGHT: THREE.MOUSE.ROTATE,
      },
    };
    const hoverState = {
      clearHover: vi.fn(),
    };
    let now = 100;
    const handlers = createViewportLifecycleHandlers({
      controls,
      hoverState,
      getMeshCount: () => 70000,
      now: () => now,
    });
    const firstEvent = {
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    } as unknown as WheelEvent;
    const secondEvent = {
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    } as unknown as WheelEvent;

    expect(handlers.handleWheelCapture(firstEvent)).toBe(false);
    now = 120;
    expect(handlers.handleWheelCapture(secondEvent)).toBe(true);
    expect(secondEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(secondEvent.stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(hoverState.clearHover).toHaveBeenCalledTimes(2);
  });

  it("clears hover on control, blur, and hidden visibility changes", () => {
    const controls = {
      mouseButtons: {
        RIGHT: THREE.MOUSE.ROTATE,
      },
    };
    const hoverState = {
      clearHover: vi.fn(),
    };
    let visibilityState: DocumentVisibilityState = "visible";
    const handlers = createViewportLifecycleHandlers({
      controls,
      hoverState,
      getMeshCount: () => 0,
      getVisibilityState: () => visibilityState,
    });

    handlers.handleControlsChange();
    handlers.handleWindowBlur();
    handlers.handleVisibilityChange();
    visibilityState = "hidden";
    handlers.handleVisibilityChange();

    expect(hoverState.clearHover).toHaveBeenCalledTimes(3);
  });
});
