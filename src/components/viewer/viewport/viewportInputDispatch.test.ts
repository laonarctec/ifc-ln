import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  dispatchViewportClickCommand,
  dispatchViewportHoverCommand,
} from "./viewportInputDispatch";

function createHit(expressId = 101) {
  return {
    modelId: 1,
    expressId,
    point: new THREE.Vector3(1, 2, 3),
    faceNormal: null,
    object: new THREE.Mesh(),
    instanceId: null,
  };
}

describe("viewportInputDispatch", () => {
  it("dispatches clipping placement payloads", () => {
    const onClippingPlace = vi.fn();

    dispatchViewportClickCommand({
      command: { kind: "clipping-place", hit: createHit(606) },
      pointer: new THREE.Vector2(0.1, 0.2),
      ray: new THREE.Ray(),
      clientX: 40,
      clientY: 20,
      onClippingPlace,
      onSelectEntity: vi.fn(),
    });

    expect(onClippingPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        hit: expect.objectContaining({ expressId: 606 }),
        clientX: 40,
        clientY: 20,
        pointer: expect.any(THREE.Vector2),
        ray: expect.any(THREE.Ray),
      }),
    );
  });

  it("dispatches click commands to measurement and selection handlers", () => {
    const onMeasurePoint = vi.fn();
    const onSelectEntity = vi.fn();
    const onDeselectClippingPlane = vi.fn();

    dispatchViewportClickCommand({
      command: { kind: "measure-point", hit: createHit(303) },
      pointer: new THREE.Vector2(),
      ray: new THREE.Ray(),
      clientX: 10,
      clientY: 15,
      onMeasurePoint,
      onSelectEntity,
    });
    dispatchViewportClickCommand({
      command: { kind: "clear-selection" },
      pointer: new THREE.Vector2(),
      ray: new THREE.Ray(),
      clientX: 10,
      clientY: 15,
      onSelectEntity,
      onDeselectClippingPlane,
    });
    dispatchViewportClickCommand({
      command: {
        kind: "select-entity",
        modelId: 1,
        expressId: 404,
        additive: true,
      },
      pointer: new THREE.Vector2(),
      ray: new THREE.Ray(),
      clientX: 10,
      clientY: 15,
      onSelectEntity,
    });

    expect(onMeasurePoint).toHaveBeenCalledWith(
      expect.objectContaining({ expressId: 303 }),
    );
    expect(onSelectEntity).toHaveBeenCalledWith(null, null);
    expect(onDeselectClippingPlane).toHaveBeenCalledTimes(1);
    expect(onSelectEntity).toHaveBeenCalledWith(1, 404, true);
  });

  it("dispatches hover preview and hover updates", () => {
    const hoverState = {
      shouldProcessMove: vi.fn(),
      clearHover: vi.fn(),
      updateHover: vi.fn(),
    };
    const onClippingPreview = vi.fn();

    dispatchViewportHoverCommand({
      command: { kind: "clipping-preview", hit: createHit(707) },
      hoverState,
      pointer: new THREE.Vector2(0.2, 0.4),
      ray: new THREE.Ray(),
      clientX: 30,
      clientY: 18,
      showMeasure: false,
      onClippingPreview,
    });
    dispatchViewportHoverCommand({
      command: { kind: "blocked" },
      hoverState,
      pointer: new THREE.Vector2(),
      ray: new THREE.Ray(),
      clientX: 30,
      clientY: 18,
      showMeasure: false,
    });
    dispatchViewportHoverCommand({
      command: { kind: "hover", hit: createHit(808) },
      hoverState,
      pointer: new THREE.Vector2(),
      ray: new THREE.Ray(),
      clientX: 30,
      clientY: 18,
      showMeasure: true,
    });

    expect(onClippingPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        hit: expect.objectContaining({ expressId: 707 }),
      }),
    );
    expect(hoverState.clearHover).toHaveBeenCalledTimes(2);
    expect(hoverState.updateHover).toHaveBeenCalledWith({
      hit: expect.objectContaining({ expressId: 808 }),
      position: { x: 30, y: 18 },
      showMeasure: true,
    });
  });
});
