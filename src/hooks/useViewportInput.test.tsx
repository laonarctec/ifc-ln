import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { InteractionMode } from "@/stores/slices/toolsSlice";
import type { SceneRefs } from "./useThreeScene";
import { useViewportInput } from "./useViewportInput";

const pickHitAtPointerMock = vi.fn();

vi.mock("@/components/viewer/viewport/raycasting", () => ({
  pickHitAtPointer: (...args: unknown[]) => pickHitAtPointerMock(...args),
}));

class MockControls {
  mouseButtons = { RIGHT: THREE.MOUSE.ROTATE };
  private listeners = new Map<string, Set<() => void>>();

  addEventListener(eventName: string, handler: () => void) {
    const handlers = this.listeners.get(eventName) ?? new Set<() => void>();
    handlers.add(handler);
    this.listeners.set(eventName, handlers);
  }

  removeEventListener(eventName: string, handler: () => void) {
    this.listeners.get(eventName)?.delete(handler);
  }

  emit(eventName: string) {
    this.listeners.get(eventName)?.forEach((handler) => handler());
  }
}

function createSceneRefs(domElement: HTMLCanvasElement, controls: MockControls): SceneRefs {
  const camera = new THREE.PerspectiveCamera();
  const sceneRoot = new THREE.Group();

  return {
    containerRef: { current: null },
    sceneRef: { current: null },
    sceneRootRef: { current: sceneRoot },
    cameraRef: { current: camera },
    controlsRef: { current: controls as unknown as OrbitControls },
    rendererRef: { current: { domElement } as THREE.WebGLRenderer },
    needsRenderRef: { current: false },
    chunkGroupsRef: { current: new Map() },
    meshEntriesRef: { current: [] },
    entryIndexRef: { current: new Map() },
    geometryCacheRef: { current: new Map() },
  };
}

function TestHarness({
  refs,
  onHover,
  onSelect,
  onMeasure,
  interactionMode = "select",
}: {
  refs: SceneRefs;
  onHover: (modelId: number | null, expressId: number | null, position: { x: number; y: number } | null) => void;
  onSelect?: (modelId: number | null, expressId: number | null, additive?: boolean) => void;
  onMeasure?: (hit: unknown) => void;
  interactionMode?: InteractionMode;
}) {
  const onSelectEntityRef = useRef<(modelId: number | null, expressId: number | null, additive?: boolean) => void>(onSelect ?? (() => {}));
  const onMeasurePointRef = useRef<((hit: unknown) => void) | undefined>(onMeasure);
  const onMeasureHoverRef = useRef<((hit: unknown | null) => void) | undefined>(undefined);
  const interactionModeRef = useRef<InteractionMode>(interactionMode);
  const onHoverEntityRef = useRef(onHover);
  const onContextMenuRef = useRef<
    ((modelId: number | null, expressId: number | null, position: { x: number; y: number }) => void) | undefined
  >(undefined);

  onSelectEntityRef.current = onSelect ?? (() => {});
  onMeasurePointRef.current = onMeasure;
  onHoverEntityRef.current = onHover;
  interactionModeRef.current = interactionMode;

  useViewportInput(refs, { onSelectEntityRef, onMeasurePointRef, onMeasureHoverRef, interactionModeRef, onHoverEntityRef, onContextMenuRef }, 1);
  return null;
}

describe("useViewportInput", () => {
  it("clears hover state when the pointer leaves the canvas", () => {
    const domElement = document.createElement("canvas");
    const controls = new MockControls();
    const onHover = vi.fn();

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

    pickHitAtPointerMock.mockReturnValue({ modelId: 1, expressId: 101 });

    render(<TestHarness refs={createSceneRefs(domElement, controls)} onHover={onHover} />);
    onHover.mockClear();

    fireEvent.mouseMove(domElement, { clientX: 40, clientY: 20 });
    expect(onHover).toHaveBeenLastCalledWith(1, 101, { x: 40, y: 20 });

    fireEvent.mouseLeave(domElement);
    expect(onHover).toHaveBeenLastCalledWith(null, null, null);
  });

  it("clears hover state when camera controls change the view", () => {
    const domElement = document.createElement("canvas");
    const controls = new MockControls();
    const onHover = vi.fn();

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

    pickHitAtPointerMock.mockReturnValue({ modelId: 2, expressId: 202 });

    render(<TestHarness refs={createSceneRefs(domElement, controls)} onHover={onHover} />);
    onHover.mockClear();

    fireEvent.mouseMove(domElement, { clientX: 80, clientY: 40 });
    expect(onHover).toHaveBeenLastCalledWith(2, 202, { x: 80, y: 40 });

    controls.emit("change");
    expect(onHover).toHaveBeenLastCalledWith(null, null, null);
  });

  it("consumes clicks as measurement points in measure mode", () => {
    const domElement = document.createElement("canvas");
    const controls = new MockControls();
    const onHover = vi.fn();
    const onSelect = vi.fn();
    const onMeasure = vi.fn();

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

    pickHitAtPointerMock.mockReturnValue({
      modelId: 3,
      expressId: 303,
      point: new THREE.Vector3(1, 2, 3),
      object: new THREE.Mesh(),
      instanceId: null,
    });

    render(
      <TestHarness
        refs={createSceneRefs(domElement, controls)}
        onHover={onHover}
        onSelect={onSelect}
        onMeasure={onMeasure}
        interactionMode="measure-distance"
      />,
    );

    fireEvent.click(domElement, { clientX: 30, clientY: 15 });

    expect(onMeasure).toHaveBeenCalledWith(
      expect.objectContaining({
        expressId: 303,
      }),
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not clear hover state on rerender when callback refs stay stable", () => {
    const domElement = document.createElement("canvas");
    const controls = new MockControls();
    const onHover = vi.fn();

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

    pickHitAtPointerMock.mockReturnValue({ modelId: 4, expressId: 404 });

    const refs = createSceneRefs(domElement, controls);
    const { rerender } = render(<TestHarness refs={refs} onHover={onHover} />);

    fireEvent.mouseMove(domElement, { clientX: 50, clientY: 25 });
    expect(onHover).toHaveBeenLastCalledWith(4, 404, { x: 50, y: 25 });

    onHover.mockClear();
    rerender(<TestHarness refs={refs} onHover={onHover} />);

    expect(onHover).not.toHaveBeenCalled();
  });
});
