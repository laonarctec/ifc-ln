import { useEffect, useRef, useState } from "react";
import { useViewerStore } from "@/stores";
import { VISIBLE_CHUNK_SAMPLE_MS, FPS_SAMPLE_INTERVAL_MS } from "@/config/performance";
import type { RenderManifest } from "@/types/worker-messages";
import { calculateVisibleChunkIds } from "@/components/viewer/viewport/cameraMath";
import {
  calculateScaleBarWorldSize,
  formatScaleLabel,
  getCameraOverlayRotation,
} from "@/components/viewer/viewport/overlayMath";
import type { AxisHelperRef } from "@/components/viewer/AxisHelper";
import type { ViewCubeRef } from "@/components/viewer/ViewCube";
import type { SceneRefs } from "./useThreeScene";

export function useRenderLoop(
  refs: SceneRefs,
  manifests: RenderManifest[],
  sceneGeneration: number,
  onVisibleChunkIdsChange: (modelId: number, chunkIds: number[]) => void,
  viewCubeRef: React.RefObject<ViewCubeRef | null>,
  axisHelperRef: React.RefObject<AxisHelperRef | null>,
) {
  const [scaleLabel, setScaleLabel] = useState("10m");
  const manifestsRef = useRef(manifests);
  const onVisibleChunkIdsChangeRef = useRef(onVisibleChunkIdsChange);
  const scaleLabelRef = useRef(scaleLabel);

  useEffect(() => {
    manifestsRef.current = manifests;
  }, [manifests]);

  useEffect(() => {
    onVisibleChunkIdsChangeRef.current = onVisibleChunkIdsChange;
  }, [onVisibleChunkIdsChange]);

  useEffect(() => {
    scaleLabelRef.current = scaleLabel;
  }, [scaleLabel]);

  useEffect(() => {
    const scene = refs.sceneRef.current;
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    const renderer = refs.rendererRef.current;
    const container = refs.containerRef.current;
    if (!scene || !camera || !controls || !renderer || !container) return;

    let lastScaleValue = 0;
    let fpsSampleStart = performance.now();
    let fpsSampleFrames = 0;
    let lastPublishedFrameRate: number | null = useViewerStore.getState().frameRate;
    let lastVisibleSample = 0;
    const lastVisibleByModel = new Map<number, string>();

    let animationFrame = 0;
    const renderFrame = () => {
      // Guard: stop stale RAF callbacks from rendering a torn-down scene after
      // projection switches or other scene re-initialization.
      if (
        refs.rendererRef.current !== renderer ||
        refs.sceneRef.current !== scene ||
        refs.cameraRef.current !== camera ||
        refs.controlsRef.current !== controls ||
        refs.containerRef.current !== container
      ) {
        return;
      }

      if (!refs.needsRenderRef.current) {
        animationFrame = window.requestAnimationFrame(renderFrame);
        return;
      }

      controls.update();
      const viewportWidth = Math.max(1, container.clientWidth);
      const viewportHeight = Math.max(1, container.clientHeight);

      renderer.setViewport(0, 0, viewportWidth, viewportHeight);
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.render(scene, camera);

      const { distance, rotationX, rotationY } = getCameraOverlayRotation(
        camera,
        controls,
      );
      viewCubeRef.current?.updateRotation(rotationX, rotationY);
      axisHelperRef.current?.updateRotation(rotationX, rotationY);

      const worldScale = calculateScaleBarWorldSize(
        camera,
        distance,
        viewportHeight,
      );
      const scaleDelta =
        lastScaleValue === 0
          ? 1
          : Math.abs(worldScale - lastScaleValue) / lastScaleValue;
      if (scaleDelta > 0.01) {
        lastScaleValue = worldScale;
        const nextScaleLabel = formatScaleLabel(worldScale);
        if (scaleLabelRef.current !== nextScaleLabel) {
          scaleLabelRef.current = nextScaleLabel;
          setScaleLabel(nextScaleLabel);
        }
      }

      const now = performance.now();
      if (now - lastVisibleSample >= VISIBLE_CHUNK_SAMPLE_MS) {
        manifestsRef.current.forEach((manifest) => {
          const visibleChunkIds = calculateVisibleChunkIds(camera, manifest);
          const visibleChunkKey = visibleChunkIds.join(",");
          if (lastVisibleByModel.get(manifest.modelId) !== visibleChunkKey) {
            lastVisibleByModel.set(manifest.modelId, visibleChunkKey);
            onVisibleChunkIdsChangeRef.current(manifest.modelId, visibleChunkIds);
          }
        });
        lastVisibleSample = now;
      }

      fpsSampleFrames += 1;
      if (now - fpsSampleStart >= FPS_SAMPLE_INTERVAL_MS) {
        const nextFrameRate = Math.round(
          (fpsSampleFrames * 1000) / (now - fpsSampleStart),
        );
        if (nextFrameRate !== lastPublishedFrameRate) {
          useViewerStore.setState({ frameRate: nextFrameRate });
          lastPublishedFrameRate = nextFrameRate;
        }
        fpsSampleStart = now;
        fpsSampleFrames = 0;
      }

      refs.needsRenderRef.current = false;
      animationFrame = window.requestAnimationFrame(renderFrame);
    };
    animationFrame = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [
    refs,
    sceneGeneration,
    viewCubeRef,
    axisHelperRef,
  ]);

  return scaleLabel;
}
