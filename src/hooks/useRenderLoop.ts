import { useEffect, useState } from "react";
import { useViewerStore } from "@/stores";
import type { RenderManifest } from "@/types/worker-messages";
import { calculateVisibleChunkIds } from "@/components/viewer/viewport/cameraMath";
import {
  formatScaleLabel,
  calculateScaleBarWorldSize,
  getCameraOverlayRotation,
} from "@/components/viewer/viewport/overlayMath";
import type { ViewCubeRef } from "@/components/viewer/ViewCube";
import type { AxisHelperRef } from "@/components/viewer/AxisHelper";
import type { SceneRefs } from "./useThreeScene";

export function useRenderLoop(
  refs: SceneRefs,
  manifest: RenderManifest,
  sceneGeneration: number,
  onVisibleChunkIdsChange: (chunkIds: number[]) => void,
  viewCubeRef: React.RefObject<ViewCubeRef | null>,
  axisHelperRef: React.RefObject<AxisHelperRef | null>,
) {
  const [scaleLabel, setScaleLabel] = useState("10m");

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
    let lastVisibleChunkKey = "";

    let animationFrame = 0;
    const renderFrame = () => {
      controls.update();

      if (refs.needsRenderRef.current) {
        const viewportWidth = Math.max(1, container.clientWidth);
        const viewportHeight = Math.max(1, container.clientHeight);

        renderer.setViewport(0, 0, viewportWidth, viewportHeight);
        renderer.setScissorTest(false);
        renderer.clear();
        renderer.render(scene, camera);

        const { distance, rotationX, rotationY } = getCameraOverlayRotation(camera, controls);
        viewCubeRef.current?.updateRotation(rotationX, rotationY);
        axisHelperRef.current?.updateRotation(rotationX, rotationY);

        const worldScale = calculateScaleBarWorldSize(camera, distance, viewportHeight);
        const scaleDelta = lastScaleValue === 0 ? 1 : Math.abs(worldScale - lastScaleValue) / lastScaleValue;
        if (scaleDelta > 0.01) {
          lastScaleValue = worldScale;
          setScaleLabel(formatScaleLabel(worldScale));
        }

        const now = performance.now();
        if (now - lastVisibleSample >= 150) {
          const visibleChunkIds = calculateVisibleChunkIds(camera, manifest);
          const visibleChunkKey = visibleChunkIds.join(",");
          if (visibleChunkKey !== lastVisibleChunkKey) {
            lastVisibleChunkKey = visibleChunkKey;
            onVisibleChunkIdsChange(visibleChunkIds);
          }
          lastVisibleSample = now;
        }

        fpsSampleFrames += 1;
        if (now - fpsSampleStart >= 250) {
          const nextFrameRate = Math.round((fpsSampleFrames * 1000) / (now - fpsSampleStart));
          if (nextFrameRate !== lastPublishedFrameRate) {
            useViewerStore.setState({ frameRate: nextFrameRate });
            lastPublishedFrameRate = nextFrameRate;
          }
          fpsSampleStart = now;
          fpsSampleFrames = 0;
        }

        refs.needsRenderRef.current = false;
      }

      animationFrame = window.requestAnimationFrame(renderFrame);
    };
    renderFrame();

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs, manifest, sceneGeneration, onVisibleChunkIdsChange, viewCubeRef, axisHelperRef]);

  return scaleLabel;
}
