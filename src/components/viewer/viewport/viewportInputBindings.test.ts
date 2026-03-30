import { describe, expect, it, vi } from "vitest";
import { bindViewportInputEvents } from "./viewportInputBindings";

function createEventTarget() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

describe("viewportInputBindings", () => {
  it("registers and unregisters DOM, window, document, and controls listeners", () => {
    const domElement = createEventTarget();
    const windowTarget = createEventTarget();
    const documentTarget = createEventTarget();
    const controls = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const clearHover = vi.fn();
    const handlers = {
      handleWheelCapture: vi.fn(),
      handleCtrlRmbDown: vi.fn(),
      handleCtrlRmbUp: vi.fn(),
      handlePointerDown: vi.fn(),
      handlePointerMove: vi.fn(),
      handlePointerUp: vi.fn(),
      handleClick: vi.fn(),
      handleHoverMove: vi.fn(),
      handleHoverLeave: vi.fn(),
      handleContextMenu: vi.fn(),
      handleControlsChange: vi.fn(),
      handleWindowBlur: vi.fn(),
      handleVisibilityChange: vi.fn(),
    };

    const cleanup = bindViewportInputEvents({
      domElement,
      controls,
      windowTarget,
      documentTarget,
      clearHover,
      ...handlers,
    });

    expect(domElement.addEventListener).toHaveBeenCalledWith(
      "wheel",
      handlers.handleWheelCapture,
      { capture: true },
    );
    expect(controls.addEventListener).toHaveBeenCalledWith(
      "change",
      handlers.handleControlsChange,
    );
    expect(windowTarget.addEventListener).toHaveBeenCalledWith(
      "blur",
      handlers.handleWindowBlur,
    );
    expect(documentTarget.addEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      handlers.handleVisibilityChange,
    );
    expect(clearHover).toHaveBeenCalledTimes(1);

    cleanup();

    expect(domElement.removeEventListener).toHaveBeenCalledWith(
      "wheel",
      handlers.handleWheelCapture,
      { capture: true },
    );
    expect(controls.removeEventListener).toHaveBeenCalledWith(
      "change",
      handlers.handleControlsChange,
    );
    expect(windowTarget.removeEventListener).toHaveBeenCalledWith(
      "blur",
      handlers.handleWindowBlur,
    );
    expect(documentTarget.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      handlers.handleVisibilityChange,
    );
    expect(clearHover).toHaveBeenCalledTimes(2);
  });
});
