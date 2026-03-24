import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SceneRefs } from "./useThreeScene";
import { useViewportInput } from "./useViewportInput";

const pickEntityAtPointerMock = vi.fn();

vi.mock("@/components/viewer/viewport/raycasting", () => ({
  pickEntityAtPointer: (...args: unknown[]) => pickEntityAtPointerMock(...args),
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
}: {
  refs: SceneRefs;
  onHover: (expressId: number | null, position: { x: number; y: number } | null) => void;
}) {
  const onSelectEntityRef = useRef<(expressId: number | null, additive?: boolean) => void>(() => {});
  const onHoverEntityRef = useRef(onHover);
  const onContextMenuRef = useRef<
    ((expressId: number | null, position: { x: number; y: number }) => void) | undefined
  >(undefined);

  onHoverEntityRef.current = onHover;

  useViewportInput(refs, { onSelectEntityRef, onHoverEntityRef, onContextMenuRef }, 1);
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

    pickEntityAtPointerMock.mockReturnValue(101);

    render(<TestHarness refs={createSceneRefs(domElement, controls)} onHover={onHover} />);
    onHover.mockClear();

    fireEvent.mouseMove(domElement, { clientX: 40, clientY: 20 });
    expect(onHover).toHaveBeenLastCalledWith(101, { x: 40, y: 20 });

    fireEvent.mouseLeave(domElement);
    expect(onHover).toHaveBeenLastCalledWith(null, null);
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

    pickEntityAtPointerMock.mockReturnValue(202);

    render(<TestHarness refs={createSceneRefs(domElement, controls)} onHover={onHover} />);
    onHover.mockClear();

    fireEvent.mouseMove(domElement, { clientX: 80, clientY: 40 });
    expect(onHover).toHaveBeenLastCalledWith(202, { x: 80, y: 40 });

    controls.emit("change");
    expect(onHover).toHaveBeenLastCalledWith(null, null);
  });
});
