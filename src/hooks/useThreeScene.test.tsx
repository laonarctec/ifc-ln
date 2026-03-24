import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import type { RenderManifest } from "@/types/worker-messages";
import type { SceneRefs } from "./useThreeScene";
import { useThreeScene } from "./useThreeScene";

const {
  getWebGLBlockReasonMock,
  storeState,
  subscribers,
  useViewerStoreMock,
} = vi.hoisted(() => {
  const getWebGLBlockReasonMock = vi.fn(() => "WebGL blocked for test");
  const storeState = {
    edgesVisible: true,
    theme: "light" as const,
    frameRate: null as number | null,
  };
  type StoreState = typeof storeState;
  type StoreListener = (state: StoreState) => void;
  const subscribers = new Set<StoreListener>();
  const useViewerStoreMock = Object.assign(
    <T,>(selector: (state: StoreState) => T) => selector(storeState),
    {
      getState: () => storeState,
      setState: (partial: Partial<StoreState>) => {
        Object.assign(storeState, partial);
        subscribers.forEach((listener) => listener(storeState));
      },
      subscribe: (listener: StoreListener) => {
        subscribers.add(listener);
        return () => subscribers.delete(listener);
      },
    },
  );

  return {
    getWebGLBlockReasonMock,
    storeState,
    subscribers,
    useViewerStoreMock,
  };
});

vi.mock("@/stores", () => ({
  useViewerStore: useViewerStoreMock,
}));

vi.mock("@/components/viewer/viewport/geometryFactory", () => ({
  getWebGLBlockReason: () => getWebGLBlockReasonMock(),
}));

function createManifest(modelId: number): RenderManifest {
  return {
    modelId,
    meshCount: 1,
    vertexCount: 3,
    indexCount: 3,
    chunkCount: 1,
    modelBounds: [0, 0, 0, 10, 10, 10],
    initialChunkIds: [1],
    chunks: [],
  };
}

function TestHarness({
  manifest,
  projectionMode = "perspective",
}: {
  manifest: RenderManifest;
  projectionMode?: "perspective" | "orthographic";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef(null);
  const sceneRootRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const needsRenderRef = useRef(false);
  const chunkGroupsRef = useRef(new Map());
  const meshEntriesRef = useRef([]);
  const entryIndexRef = useRef(new Map());
  const geometryCacheRef = useRef(new Map());
  const refs = useRef<SceneRefs>({
    containerRef,
    sceneRef,
    sceneRootRef,
    cameraRef,
    controlsRef,
    rendererRef,
    needsRenderRef,
    chunkGroupsRef,
    meshEntriesRef,
    entryIndexRef,
    geometryCacheRef,
  }).current;

  const { rendererError, sceneGeneration } = useThreeScene(
    refs,
    projectionMode,
    manifest,
  );

  return (
    <div ref={containerRef}>
      <span data-testid="scene-generation">{sceneGeneration}</span>
      <span data-testid="renderer-error">{rendererError}</span>
    </div>
  );
}

describe("useThreeScene", () => {
  beforeEach(() => {
    storeState.edgesVisible = true;
    storeState.theme = "light";
    storeState.frameRate = null;
    subscribers.clear();
    getWebGLBlockReasonMock.mockClear();
    getWebGLBlockReasonMock.mockReturnValue("WebGL blocked for test");
  });

  beforeEach(() => {
    cleanup();
  });

  it("does not recreate the scene when manifest identity changes", async () => {
    const { rerender } = render(<TestHarness manifest={createManifest(1)} />);

    await waitFor(() => {
      expect(screen.getByTestId("scene-generation").textContent).toBe("1");
    });
    expect(screen.getByTestId("renderer-error").textContent).toBe(
      "WebGL blocked for test",
    );

    rerender(<TestHarness manifest={createManifest(1)} />);

    await waitFor(() => {
      expect(screen.getByTestId("scene-generation").textContent).toBe("1");
    });
  });

  it("recreates the scene when the projection mode changes", async () => {
    const { rerender } = render(
      <TestHarness manifest={createManifest(2)} projectionMode="perspective" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("scene-generation").textContent).toBe("1");
    });

    rerender(
      <TestHarness manifest={createManifest(2)} projectionMode="orthographic" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("scene-generation").textContent).toBe("2");
    });
  });
});
