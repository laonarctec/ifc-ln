import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  completeViewportBoxSelection,
  executeViewportContextMenuCommand,
  getViewportWheelThrottleMs,
} from "./viewportInputEffects";

const pickEntitiesInBoxMock = vi.fn();

vi.mock("./raycasting", () => ({
  pickEntitiesInBox: (...args: unknown[]) => pickEntitiesInBoxMock(...args),
}));

describe("viewportInputEffects", () => {
  it("selects before opening the context menu when requested", () => {
    const onSelectEntity = vi.fn();
    const onContextMenu = vi.fn();

    const didOpen = executeViewportContextMenuCommand({
      command: {
        kind: "open",
        modelId: 1,
        expressId: 101,
        selectBeforeOpen: true,
      },
      clientX: 40,
      clientY: 20,
      onSelectEntity,
      onContextMenu,
    });

    expect(didOpen).toBe(true);
    expect(onSelectEntity).toHaveBeenCalledWith(1, 101);
    expect(onContextMenu).toHaveBeenCalledWith(1, 101, { x: 40, y: 20 });
  });

  it("completes box selection and forwards additive state", () => {
    pickEntitiesInBoxMock.mockReturnValueOnce([{ modelId: 1, expressId: 101 }]);
    const onBoxSelect = vi.fn();
    const domElement = document.createElement("canvas");
    const camera = new THREE.PerspectiveCamera();
    const sceneRoot = new THREE.Group();

    Object.defineProperty(domElement, "getBoundingClientRect", {
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

    const results = completeViewportBoxSelection({
      domElement,
      startX: 0,
      startY: 0,
      endX: 12,
      endY: 12,
      camera,
      sceneRoot,
      hiddenEntityKeys: new Set(),
      clippingPlanes: [],
      additive: true,
      onBoxSelect,
    });

    expect(results).toEqual([{ modelId: 1, expressId: 101 }]);
    expect(onBoxSelect).toHaveBeenCalledWith(
      [{ modelId: 1, expressId: 101 }],
      true,
    );
  });

  it("returns adaptive wheel throttle thresholds by mesh count", () => {
    expect(getViewportWheelThrottleMs(1000)).toBe(16);
    expect(getViewportWheelThrottleMs(12000)).toBe(25);
    expect(getViewportWheelThrottleMs(70000)).toBe(40);
  });
});
