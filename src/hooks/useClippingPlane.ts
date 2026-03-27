import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useViewerStore } from "@/stores";
import type { SceneRefs } from "./useThreeScene";
import type { RenderManifest } from "@/types/worker-messages";
import { boundsFromTuple } from "@/components/viewer/viewport/cameraMath";
import { setGlobalClippingPlanes } from "@/components/viewer/viewport/materialPool";
import {
  createPlaneWidget,
  disposePlaneWidget,
  type ClippingPlaneWidgetVisual,
  updatePlaneWidget,
} from "@/components/viewer/viewport/clippingPlaneWidget";
import {
  createGumball,
  disposeGumball,
  type GumballComponents,
  updateGumballTransform,
} from "@/components/viewer/viewport/gumball";
import { getPlaneQuaternion } from "@/components/viewer/viewport/clippingMath";
import { useGumballInput } from "./useGumballInput";

export interface ClippingPlaneLabel {
  id: string;
  name: string;
  left: number;
  top: number;
  selected: boolean;
}

export function useClippingPlane(
  refs: SceneRefs,
  manifest: RenderManifest,
  sceneGeneration: number,
) {
  const planeVisualsRef = useRef<Map<string, ClippingPlaneWidgetVisual>>(new Map());
  const draftVisualRef = useRef<ClippingPlaneWidgetVisual | null>(null);
  const gumballRef = useRef<GumballComponents | null>(null);
  const [labels, setLabels] = useState<ClippingPlaneLabel[]>([]);

  const clipping = useViewerStore((state) => state.clipping);
  const selectClippingPlane = useViewerStore((state) => state.selectClippingPlane);
  const updateClippingPlaneTransform = useViewerStore(
    (state) => state.updateClippingPlaneTransform,
  );
  const resizeClippingPlane = useViewerStore((state) => state.resizeClippingPlane);

  const selectedPlane = useMemo(
    () =>
      clipping.activePlaneId
        ? clipping.planes.find((plane) => plane.id === clipping.activePlaneId) ?? null
        : null,
    [clipping.activePlaneId, clipping.planes],
  );

  const modelSize = useRef(1);
  const minPlaneSizeRef = useRef(0.25);

  useEffect(() => {
    const bounds = boundsFromTuple(manifest.modelBounds);
    const size = bounds.getSize(new THREE.Vector3()).length();
    modelSize.current = Math.max(size, 1);
    minPlaneSizeRef.current = Math.max(size * 0.015, 0.25);
  }, [manifest.modelBounds]);

  useGumballInput(
    refs,
    planeVisualsRef,
    gumballRef,
    selectedPlane,
    {
      selectClippingPlane,
      updateClippingPlaneTransform,
      resizeClippingPlane,
    },
    minPlaneSizeRef.current,
    sceneGeneration,
  );

  const syncCloneMaterials = useCallback(
    (planes: THREE.Plane[]) => {
      refs.chunkGroupsRef.current.forEach((chunkGroup) => {
        chunkGroup.materials.forEach((material) => {
          if (material.userData?.poolClone) {
            (material as THREE.MeshPhongMaterial).clippingPlanes =
              planes.length > 0 ? planes : null;
          }
        });
      });
    },
    [refs],
  );

  useEffect(() => {
    const scene = refs.sceneRef.current;
    if (!scene) return;

    const clippingPlanes = clipping.planes
      .filter((plane) => plane.enabled)
      .map((plane) => {
        const normal = new THREE.Vector3(...plane.normal).normalize();
        if (plane.flipped) normal.negate();
        const origin = new THREE.Vector3(...plane.origin);
        return new THREE.Plane(normal, -normal.dot(origin));
      });

    setGlobalClippingPlanes(clippingPlanes);
    syncCloneMaterials(clippingPlanes);

    const widgetScale = Math.max(modelSize.current * 0.08, 0.2);

    const staleIds = new Set(planeVisualsRef.current.keys());
    for (const plane of clipping.planes) {
      staleIds.delete(plane.id);
      let visual = planeVisualsRef.current.get(plane.id) ?? null;
      if (!visual) {
        visual = createPlaneWidget(plane.id);
        planeVisualsRef.current.set(plane.id, visual);
        scene.add(visual.group);
      }
      updatePlaneWidget(visual, plane, {
        selected: plane.selected,
        interactive: plane.selected,
        scale: widgetScale,
      });
    }

    for (const staleId of staleIds) {
      const visual = planeVisualsRef.current.get(staleId);
      if (!visual) continue;
      scene.remove(visual.group);
      disposePlaneWidget(visual);
      planeVisualsRef.current.delete(staleId);
    }

    const draft = clipping.draft;
    if (
      clipping.mode === "creating" &&
      draft?.origin &&
      draft.normal &&
      draft.uAxis &&
      draft.vAxis
    ) {
      if (!draftVisualRef.current) {
        draftVisualRef.current = createPlaneWidget("draft");
        scene.add(draftVisualRef.current.group);
      }

      updatePlaneWidget(
        draftVisualRef.current,
        {
          id: "draft",
          name: "Draft",
          enabled: true,
          locked: true,
          selected: false,
          origin: draft.origin,
          normal: draft.normal,
          uAxis: draft.uAxis,
          vAxis: draft.vAxis,
          width: Math.max(draft.width, minPlaneSizeRef.current),
          height: Math.max(draft.height, minPlaneSizeRef.current),
          flipped: false,
          labelVisible: false,
        },
        {
          selected: false,
          interactive: false,
          scale: widgetScale,
        },
      );
    } else if (draftVisualRef.current) {
      scene.remove(draftVisualRef.current.group);
      disposePlaneWidget(draftVisualRef.current);
      draftVisualRef.current = null;
    }

    const gumballScale = Math.max(modelSize.current * 0.1, 0.5);
    if (selectedPlane && selectedPlane.enabled && !selectedPlane.locked) {
      if (!gumballRef.current) {
        gumballRef.current = createGumball(gumballScale);
        scene.add(gumballRef.current.group);
      }

      updateGumballTransform(
        gumballRef.current,
        new THREE.Vector3(...selectedPlane.origin),
        getPlaneQuaternion(selectedPlane),
        gumballScale,
      );
      gumballRef.current.group.visible = true;
    } else if (gumballRef.current) {
      gumballRef.current.group.visible = false;
    }

    refs.needsRenderRef.current = true;
  }, [clipping, refs, sceneGeneration, selectedPlane, syncCloneMaterials]);

  useEffect(() => {
    return () => {
      setGlobalClippingPlanes([]);
      planeVisualsRef.current.forEach((visual) => {
        disposePlaneWidget(visual);
      });
      planeVisualsRef.current.clear();

      if (draftVisualRef.current) {
        disposePlaneWidget(draftVisualRef.current);
        draftVisualRef.current = null;
      }

      if (gumballRef.current) {
        disposeGumball(gumballRef.current);
        gumballRef.current = null;
      }
    };
  }, [sceneGeneration]);

  useEffect(() => {
    const controls = refs.controlsRef.current;
    const container = refs.containerRef.current;
    const camera = refs.cameraRef.current;
    if (!controls || !container || !camera) return;

    let rafId = 0;
    const schedule = () => {
      if (rafId !== 0) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const nextLabels = clipping.planes
          .filter((plane) => plane.enabled && plane.labelVisible)
          .map((plane) => {
            const origin = new THREE.Vector3(...plane.origin);
            const vAxis = new THREE.Vector3(...plane.vAxis).normalize();
            const normal = new THREE.Vector3(...plane.normal).normalize();
            const anchor = origin
              .clone()
              .addScaledVector(vAxis, plane.height * 0.5 + modelSize.current * 0.01)
              .addScaledVector(normal, modelSize.current * 0.01);

            const projected = anchor.project(camera);
            const isHidden = projected.z < -1 || projected.z > 1;
            const left = ((projected.x + 1) * 0.5) * container.clientWidth;
            const top = ((1 - projected.y) * 0.5) * container.clientHeight;

            return {
              id: plane.id,
              name: plane.name,
              left,
              top,
              selected: plane.selected,
              hidden: isHidden,
            };
          })
          .filter((label) => !label.hidden)
          .map(({ hidden: _hidden, ...label }) => label);

        setLabels(nextLabels);
      });
    };

    schedule();
    controls.addEventListener("change", schedule);
    window.addEventListener("resize", schedule);

    return () => {
      controls.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  }, [clipping.planes, refs, sceneGeneration]);

  return {
    labels,
    minPlaneSizeRef,
  };
}
