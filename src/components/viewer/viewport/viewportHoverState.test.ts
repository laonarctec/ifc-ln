import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createViewportHoverState } from "./viewportHoverState";
import type { RaycastHit } from "./raycasting";

function createHit(expressId = 101): RaycastHit {
  return {
    modelId: 1,
    expressId,
    point: new THREE.Vector3(1, 2, 3),
    faceNormal: null,
    object: new THREE.Mesh(),
    instanceId: null,
  };
}

describe("viewportHoverState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throttles hover processing by time", () => {
    const hoverState = createViewportHoverState({
      onHoverEntity: vi.fn(),
      onMeasureHover: vi.fn(),
    });

    expect(hoverState.shouldProcessMove(100)).toBe(true);
    expect(hoverState.shouldProcessMove(120)).toBe(false);
    expect(hoverState.shouldProcessMove(151)).toBe(true);
  });

  it("emits hover updates immediately for hits", () => {
    const onHoverEntity = vi.fn();
    const onMeasureHover = vi.fn();
    const hoverState = createViewportHoverState({
      onHoverEntity,
      onMeasureHover,
    });

    hoverState.updateHover({
      hit: createHit(303),
      position: { x: 40, y: 20 },
      showMeasure: true,
    });

    expect(onHoverEntity).toHaveBeenLastCalledWith(1, 303, { x: 40, y: 20 });
    expect(onMeasureHover).toHaveBeenLastCalledWith(
      expect.objectContaining({ expressId: 303 }),
    );
  });

  it("schedules a delayed clear after a miss when something was previously hovered", () => {
    const onHoverEntity = vi.fn();
    const onMeasureHover = vi.fn();
    const hoverState = createViewportHoverState({
      onHoverEntity,
      onMeasureHover,
    });

    hoverState.updateHover({
      hit: createHit(404),
      position: { x: 50, y: 25 },
      showMeasure: false,
    });

    onHoverEntity.mockClear();
    onMeasureHover.mockClear();

    hoverState.updateHover({
      hit: null,
      position: { x: 60, y: 30 },
      showMeasure: false,
    });

    expect(onHoverEntity).not.toHaveBeenCalled();
    vi.advanceTimersByTime(149);
    expect(onHoverEntity).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onHoverEntity).toHaveBeenLastCalledWith(null, null, null);
    expect(onMeasureHover).toHaveBeenLastCalledWith(null);
  });

  it("clearHover cancels pending clear timers and resets callbacks immediately", () => {
    const onHoverEntity = vi.fn();
    const onMeasureHover = vi.fn();
    const hoverState = createViewportHoverState({
      onHoverEntity,
      onMeasureHover,
    });

    hoverState.updateHover({
      hit: createHit(505),
      position: { x: 20, y: 10 },
      showMeasure: false,
    });
    hoverState.updateHover({
      hit: null,
      position: { x: 30, y: 15 },
      showMeasure: false,
    });

    onHoverEntity.mockClear();
    onMeasureHover.mockClear();

    hoverState.clearHover();
    vi.runAllTimers();

    expect(onHoverEntity).toHaveBeenCalledTimes(1);
    expect(onHoverEntity).toHaveBeenLastCalledWith(null, null, null);
    expect(onMeasureHover).toHaveBeenLastCalledWith(null);
  });
});
