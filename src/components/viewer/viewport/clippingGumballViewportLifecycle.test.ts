import { describe, expect, it, vi } from "vitest";
import { bindClippingGumballViewportLifecycle } from "./clippingGumballViewportLifecycle";

describe("clippingGumballViewportLifecycle", () => {
  it("binds change and resize observers and returns a cleanup", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const observe = vi.fn();
    const disconnect = vi.fn();
    const syncAndRequestRender = vi.fn();
    const container = document.createElement("div");

    const cleanup = bindClippingGumballViewportLifecycle({
      controls: {
        addEventListener,
        removeEventListener,
      },
      container,
      syncAndRequestRender,
      createResizeObserver: () => ({
        observe,
        disconnect,
      }),
    });

    expect(addEventListener).toHaveBeenCalledWith("change", syncAndRequestRender);
    expect(observe).toHaveBeenCalledWith(container);
    expect(syncAndRequestRender).toHaveBeenCalledTimes(1);

    cleanup();

    expect(removeEventListener).toHaveBeenCalledWith("change", syncAndRequestRender);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
