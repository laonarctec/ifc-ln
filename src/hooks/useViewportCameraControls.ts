import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { ViewportCommand } from "@/stores/slices/uiSlice";
import type { ModelEntityKey } from "@/utils/modelEntity";
import type { SceneRefs } from "./useThreeScene";
import {
  boundsFromTuple,
  expandBoundsForEntry,
  fitCameraToBounds,
  fitCameraToBoundsWithDirection,
  orbitCamera,
  zoomCamera,
} from "@/components/viewer/viewport/cameraMath";
import {
  createIsoViewDirection,
  createPresetViewDirection,
  resolvePresetViewportCommand,
} from "@/components/viewer/viewport/viewportSceneUtils";

type PresetView = Exclude<
  NonNullable<ReturnType<typeof resolvePresetViewportCommand>>,
  "iso"
>;

interface UseViewportCameraControlsOptions {
  refs: SceneRefs;
  modelBounds: [number, number, number, number, number, number];
  viewportCommand: ViewportCommand;
  selectedEntityKeys: Set<ModelEntityKey>;
  hiddenEntityKeys: Set<ModelEntityKey>;
}

export function useViewportCameraControls({
  refs,
  modelBounds,
  viewportCommand,
  selectedEntityKeys,
  hiddenEntityKeys,
}: UseViewportCameraControlsOptions) {
  const lastHandledViewportCommandSeqRef = useRef(0);

  const homeToFit = useCallback(() => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls) return;
    fitCameraToBounds(camera, controls, boundsFromTuple(modelBounds));
  }, [modelBounds, refs]);

  const fitAllCurrentView = useCallback(() => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls) return;
    const direction = camera.position.clone().sub(controls.target);
    if (direction.lengthSq() === 0) direction.set(1, 0.75, 1);
    fitCameraToBoundsWithDirection(
      camera,
      controls,
      boundsFromTuple(modelBounds),
      direction,
    );
  }, [modelBounds, refs]);

  const setPresetView = useCallback(
    (view: PresetView) => {
      const camera = refs.cameraRef.current;
      const controls = refs.controlsRef.current;
      if (!camera || !controls) return;
      fitCameraToBoundsWithDirection(
        camera,
        controls,
        boundsFromTuple(modelBounds),
        createPresetViewDirection(view),
      );
    },
    [modelBounds, refs],
  );

  const zoomIn = useCallback(() => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls) return;
    zoomCamera(camera, controls, 0.84);
    refs.needsRenderRef.current = true;
  }, [refs]);

  const zoomOut = useCallback(() => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls) return;
    zoomCamera(camera, controls, 1.2);
    refs.needsRenderRef.current = true;
  }, [refs]);

  const orbitFromViewCube = useCallback(
    (deltaX: number, deltaY: number) => {
      const camera = refs.cameraRef.current;
      const controls = refs.controlsRef.current;
      if (!camera || !controls) return;
      orbitCamera(camera, controls, deltaX, deltaY);
    },
    [refs],
  );

  useEffect(() => {
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!camera || !controls || viewportCommand.type === "none") return;
    if (viewportCommand.seq <= lastHandledViewportCommandSeqRef.current) return;
    lastHandledViewportCommandSeqRef.current = viewportCommand.seq;

    if (viewportCommand.type === "home") {
      homeToFit();
      return;
    }
    if (viewportCommand.type === "fit-all") {
      fitAllCurrentView();
      return;
    }

    const presetView = resolvePresetViewportCommand(viewportCommand.type);
    if (presetView === "iso") {
      fitCameraToBoundsWithDirection(
        camera,
        controls,
        boundsFromTuple(modelBounds),
        createIsoViewDirection(),
      );
      return;
    }
    if (presetView) {
      setPresetView(presetView);
      return;
    }

    if (viewportCommand.type === "fit-selected" && selectedEntityKeys.size > 0) {
      const selectedEntries = refs.meshEntriesRef.current.filter(
        (entry) =>
          selectedEntityKeys.has(entry.entityKey) &&
          !hiddenEntityKeys.has(entry.entityKey),
      );
      if (selectedEntries.length === 0) return;
      const selectedBounds = new THREE.Box3();
      selectedEntries.forEach((entry) =>
        expandBoundsForEntry(selectedBounds, entry),
      );
      fitCameraToBounds(camera, controls, selectedBounds);
    }
  }, [
    fitAllCurrentView,
    hiddenEntityKeys,
    homeToFit,
    modelBounds,
    refs,
    selectedEntityKeys,
    setPresetView,
    viewportCommand,
  ]);

  return {
    homeToFit,
    fitAllCurrentView,
    setPresetView,
    zoomIn,
    zoomOut,
    orbitFromViewCube,
  };
}
