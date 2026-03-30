import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { InteractionMode } from "@/stores/slices/toolsSlice";
import type { SceneRefs } from "./useThreeScene";
import { useViewportInput } from "./useViewportInput";

const pickPointerResultAtPointerMock = vi.fn();
const pickHitAtPointerMock = vi.fn();
const pickEntitiesInBoxMock = vi.fn();

vi.mock("@/components/viewer/viewport/raycasting", () => ({
  pickPointerResultAtPointer: (...args: unknown[]) => pickPointerResultAtPointerMock(...args),
  pickHitAtPointer: (...args: unknown[]) => pickHitAtPointerMock(...args),
  pickEntitiesInBox: (...args: unknown[]) => pickEntitiesInBoxMock(...args),
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

function createSceneRefs(
  domElement: HTMLCanvasElement,
  controls: MockControls,
  options?: {
    scene?: THREE.Scene | null;
    sceneRoot?: THREE.Group;
  },
): SceneRefs {
  const camera = new THREE.PerspectiveCamera();
  const sceneRoot = options?.sceneRoot ?? new THREE.Group();

  return {
    containerRef: { current: null },
    sceneRef: { current: options?.scene ?? null },
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

beforeEach(() => {
  pickPointerResultAtPointerMock.mockReset();
  pickHitAtPointerMock.mockReset();
  pickEntitiesInBoxMock.mockReset();
});

function TestHarness({
  refs,
  onHover,
  onSelect,
  onMeasure,
  onClippingPlace,
  onClippingPreview,
  onContextMenu,
  onBoxSelect,
  interactionMode = "select",
  selectedModelId = null,
  selectedEntityIds = [],
}: {
  refs: SceneRefs;
  onHover: (modelId: number | null, expressId: number | null, position: { x: number; y: number } | null) => void;
  onSelect?: (modelId: number | null, expressId: number | null, additive?: boolean) => void;
  onMeasure?: (hit: unknown) => void;
  onClippingPlace?: (payload: unknown) => void;
  onClippingPreview?: (payload: unknown) => void;
  onContextMenu?: (modelId: number | null, expressId: number | null, position: { x: number; y: number }) => void;
  onBoxSelect?: (results: unknown, additive: boolean) => void;
  interactionMode?: InteractionMode;
  selectedModelId?: number | null;
  selectedEntityIds?: number[];
}) {
  const onSelectEntityRef = useRef<(modelId: number | null, expressId: number | null, additive?: boolean) => void>(onSelect ?? (() => {}));
  const onMeasurePointRef = useRef<((hit: unknown) => void) | undefined>(onMeasure);
  const onMeasureHoverRef = useRef<((hit: unknown | null) => void) | undefined>(undefined);
  const interactionModeRef = useRef<InteractionMode>(interactionMode);
  const selectedModelIdRef = useRef<number | null>(selectedModelId);
  const selectedEntityIdsRef = useRef<number[]>(selectedEntityIds);
  const onHoverEntityRef = useRef(onHover);
  const onContextMenuRef = useRef<
    ((modelId: number | null, expressId: number | null, position: { x: number; y: number }) => void) | undefined
  >(onContextMenu);

  onSelectEntityRef.current = onSelect ?? (() => {});
  onMeasurePointRef.current = onMeasure;
  onHoverEntityRef.current = onHover;
  interactionModeRef.current = interactionMode;
  selectedModelIdRef.current = selectedModelId;
  selectedEntityIdsRef.current = selectedEntityIds;
  onContextMenuRef.current = onContextMenu;

  const onBoxSelectRef = useRef<((results: unknown, additive: boolean) => void) | undefined>(onBoxSelect);
  const onBoxDragChangeRef = useRef<undefined>(undefined);
  const onClippingPlaceRef = useRef<((payload: unknown) => void) | undefined>(onClippingPlace);
  const onClippingPreviewRef = useRef<((payload: unknown) => void) | undefined>(onClippingPreview);
  const onDeselectClippingPlaneRef = useRef<(() => void) | undefined>(undefined);
  const hiddenEntityKeysRef = useRef(new Set<string>());
  onClippingPlaceRef.current = onClippingPlace;
  onClippingPreviewRef.current = onClippingPreview;
  onBoxSelectRef.current = onBoxSelect;
  useViewportInput(refs, { onSelectEntityRef, onBoxSelectRef, onBoxDragChangeRef, onMeasurePointRef, onMeasureHoverRef, onClippingPlaceRef, onClippingPreviewRef, onDeselectClippingPlaneRef, interactionModeRef, selectedModelIdRef, selectedEntityIdsRef, onHoverEntityRef, onContextMenuRef, hiddenEntityKeysRef: hiddenEntityKeysRef as any }, 1);
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

    pickPointerResultAtPointerMock.mockReturnValue({
      kind: "hit",
      hit: { modelId: 1, expressId: 101 },
    });

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

    pickPointerResultAtPointerMock.mockReturnValue({
      kind: "hit",
      hit: { modelId: 2, expressId: 202 },
    });

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

    pickPointerResultAtPointerMock.mockReturnValue({
      kind: "hit",
      hit: {
        modelId: 3,
        expressId: 303,
        point: new THREE.Vector3(1, 2, 3),
        object: new THREE.Mesh(),
        instanceId: null,
      },
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

    pickPointerResultAtPointerMock.mockReturnValue({
      kind: "hit",
      hit: { modelId: 4, expressId: 404 },
    });

    const refs = createSceneRefs(domElement, controls);
    const { rerender } = render(<TestHarness refs={refs} onHover={onHover} />);

    fireEvent.mouseMove(domElement, { clientX: 50, clientY: 25 });
    expect(onHover).toHaveBeenLastCalledWith(4, 404, { x: 50, y: 25 });

    onHover.mockClear();
    rerender(<TestHarness refs={refs} onHover={onHover} />);

    expect(onHover).not.toHaveBeenCalled();
  });

  it("forwards clipping creation clicks and preview rays in clipping mode", () => {
    const domElement = document.createElement("canvas");
    const controls = new MockControls();
    const onHover = vi.fn();
    const onClippingPlace = vi.fn();
    const onClippingPreview = vi.fn();

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

    pickPointerResultAtPointerMock.mockReturnValue({ kind: "miss" });

    render(
      <TestHarness
        refs={createSceneRefs(domElement, controls)}
        onHover={onHover}
        onClippingPlace={onClippingPlace}
        onClippingPreview={onClippingPreview}
        interactionMode="create-clipping-plane"
      />,
    );

    fireEvent.mouseMove(domElement, { clientX: 40, clientY: 20 });
    fireEvent.click(domElement, { clientX: 40, clientY: 20 });

    expect(onClippingPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        hit: null,
        ray: expect.any(THREE.Ray),
      }),
    );
    expect(onClippingPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        hit: null,
        ray: expect.any(THREE.Ray),
      }),
    );
  });

  it("falls back to model-only picking for clipping creation when overlays block the pointer", () => {
    const domElement = document.createElement("canvas");
    const controls = new MockControls();
    const onHover = vi.fn();
    const onClippingPlace = vi.fn();
    const onClippingPreview = vi.fn();
    const scene = new THREE.Scene();
    const sceneRoot = new THREE.Group();
    scene.add(sceneRoot);

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

    pickPointerResultAtPointerMock.mockImplementation((...args: unknown[]) => {
      const raycastRoot = args[3];
      if (raycastRoot === scene) {
        return { kind: "blocked" };
      }
      return { kind: "miss" };
    });
    pickHitAtPointerMock.mockReturnValue({
      modelId: 6,
      expressId: 606,
      point: new THREE.Vector3(1, 2, 3),
      object: new THREE.Mesh(),
      instanceId: null,
    });

    render(
      <TestHarness
        refs={createSceneRefs(domElement, controls, { scene, sceneRoot })}
        onHover={onHover}
        onClippingPlace={onClippingPlace}
        onClippingPreview={onClippingPreview}
        interactionMode="create-clipping-plane"
      />,
    );

    fireEvent.mouseMove(domElement, { clientX: 40, clientY: 20 });
    fireEvent.click(domElement, { clientX: 40, clientY: 20 });

    expect(pickPointerResultAtPointerMock).toHaveBeenCalled();
    expect(pickPointerResultAtPointerMock.mock.calls[0]?.[3]).toBe(scene);
    expect(pickHitAtPointerMock).toHaveBeenCalledTimes(2);
    expect(pickHitAtPointerMock.mock.calls[0]?.[3]).toBe(sceneRoot);
    expect(onClippingPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        hit: expect.objectContaining({
          expressId: 606,
        }),
        ray: expect.any(THREE.Ray),
      }),
    );
    expect(onClippingPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        hit: expect.objectContaining({
          expressId: 606,
        }),
        ray: expect.any(THREE.Ray),
      }),
    );
  });

  it("does not replace the current selection on context menu when something is already selected", () => {
    const domElement = document.createElement("canvas");
    const controls = new MockControls();
    const onHover = vi.fn();
    const onSelect = vi.fn();
    const onContextMenu = vi.fn();

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

    pickPointerResultAtPointerMock.mockReturnValue({
      kind: "hit",
      hit: { modelId: 9, expressId: 909 },
    });

    render(
      <TestHarness
        refs={createSceneRefs(domElement, controls)}
        onHover={onHover}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
        selectedModelId={1}
        selectedEntityIds={[101, 102]}
      />,
    );

    fireEvent.pointerDown(domElement, { button: 2, clientX: 40, clientY: 20 });
    fireEvent.pointerUp(window, { button: 2, clientX: 40, clientY: 20 });
    fireEvent.contextMenu(domElement, { clientX: 40, clientY: 20 });

    expect(onSelect).not.toHaveBeenCalled();
    expect(onContextMenu).toHaveBeenLastCalledWith(9, 909, { x: 40, y: 20 });
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  it("opens the context menu on right button release without dragging", () => {
    const domElement = document.createElement("canvas");
    const controls = new MockControls();
    const onHover = vi.fn();
    const onContextMenu = vi.fn();

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

    pickPointerResultAtPointerMock.mockReturnValue({
      kind: "hit",
      hit: { modelId: 5, expressId: 505 },
    });

    render(
      <TestHarness
        refs={createSceneRefs(domElement, controls)}
        onHover={onHover}
        onContextMenu={onContextMenu}
      />,
    );

    fireEvent.pointerDown(domElement, { button: 2, clientX: 60, clientY: 30 });
    fireEvent.pointerUp(window, { button: 2, clientX: 60, clientY: 30 });
    fireEvent.contextMenu(domElement, { clientX: 60, clientY: 30 });

    expect(onContextMenu).toHaveBeenCalledTimes(1);
    expect(onContextMenu).toHaveBeenLastCalledWith(5, 505, { x: 60, y: 30 });
  });

  it("does not open the context menu after a right button drag", () => {
    const domElement = document.createElement("canvas");
    const controls = new MockControls();
    const onHover = vi.fn();
    const onContextMenu = vi.fn();

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

    render(
      <TestHarness
        refs={createSceneRefs(domElement, controls)}
        onHover={onHover}
        onContextMenu={onContextMenu}
      />,
    );

    fireEvent.pointerDown(domElement, { button: 2, clientX: 60, clientY: 30 });
    fireEvent.pointerMove(window, { clientX: 72, clientY: 42 });
    fireEvent.pointerUp(window, { button: 2, clientX: 72, clientY: 42 });
    fireEvent.contextMenu(domElement, { clientX: 72, clientY: 42 });

    expect(onContextMenu).not.toHaveBeenCalled();
  });

  it("ignores clicks that land on selection blockers", () => {
    const domElement = document.createElement("canvas");
    const controls = new MockControls();
    const onHover = vi.fn();
    const onSelect = vi.fn();

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

    pickPointerResultAtPointerMock.mockReturnValue({ kind: "blocked" });

    render(
      <TestHarness
        refs={createSceneRefs(domElement, controls)}
        onHover={onHover}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(domElement, { clientX: 40, clientY: 20 });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("supports box selection starting at the viewport origin", () => {
    const domElement = document.createElement("canvas");
    const controls = new MockControls();
    const onHover = vi.fn();
    const onBoxSelect = vi.fn();

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

    pickPointerResultAtPointerMock.mockReturnValue({ kind: "miss" });
    pickEntitiesInBoxMock.mockReturnValue([{ modelId: 1, expressId: 101 }]);

    render(
      <TestHarness
        refs={createSceneRefs(domElement, controls)}
        onHover={onHover}
        onBoxSelect={onBoxSelect}
      />,
    );

    fireEvent.pointerDown(domElement, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 12, clientY: 12 });
    fireEvent.pointerUp(window, { button: 0, clientX: 12, clientY: 12 });

    expect(onBoxSelect).toHaveBeenCalledWith([{ modelId: 1, expressId: 101 }], false);
  });
});
