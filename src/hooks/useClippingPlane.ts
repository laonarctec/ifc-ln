import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useViewerStore } from "@/stores";
import type { SceneRefs } from "./useThreeScene";
import type { RenderManifest } from "@/types/worker-messages";
import { setGlobalClippingPlanes } from "@/components/viewer/viewport/materialPool";
import {
  type ClippingPlaneWidgetVisual,
} from "@/components/viewer/viewport/clippingPlaneWidget";
import {
  type GumballComponents,
} from "@/components/viewer/viewport/gumball";
import {
  buildRuntimeClippingPlanes,
} from "@/components/viewer/viewport/clippingMath";
import {
  createSectionPlaneVisualGroup,
  disposeObjectTree,
} from "@/components/viewer/viewport/clippingSectionVisuals";
import {
  disposeClippingSceneResources,
  disposeGroupChildren,
} from "@/components/viewer/viewport/clippingSceneLifecycle";
import { bindClippingGumballViewportLifecycle } from "@/components/viewer/viewport/clippingGumballViewportLifecycle";
import {
  calculateClippingSceneMetrics,
} from "@/components/viewer/viewport/clippingSceneUtils";
import {
  buildSectionPlaneVisualData,
  type SectionPlaneStats,
} from "@/components/viewer/viewport/clippingSectionBuilder";
import {
  getOrCreateSectionTopology,
  type SectionTopology,
} from "@/components/viewer/viewport/sectionTopologyCache";
import { syncClippingPlaneScene } from "@/components/viewer/viewport/clippingPlaneSceneSync";
import { syncClippingGumballViewportScale } from "@/components/viewer/viewport/clippingGumballViewportSync";
import { getActiveClippingPlane } from "@/stores/slices/clippingStateUtils";
import { useGumballInput } from "./useGumballInput";

interface ActiveClippingPlaneEntry {
  planeId: string;
  mainPlane: THREE.Plane;
  sidePlanes: THREE.Plane[];
  allPlanes: THREE.Plane[];
}

function getSectionStatsTarget() {
  return globalThis as typeof globalThis & {
    __ifcSectionStats?: Record<string, SectionPlaneStats>;
  };
}

export function useClippingPlane(
  refs: SceneRefs,
  manifest: RenderManifest,
  chunkVersion: number,
  sceneGeneration: number,
) {
  const planeVisualsRef = useRef<Map<string, ClippingPlaneWidgetVisual>>(new Map());
  const draftVisualRef = useRef<ClippingPlaneWidgetVisual | null>(null);
  const gumballRef = useRef<GumballComponents | null>(null);
  const sectionEdgesGroupRef = useRef<THREE.Group | null>(null);
  const sectionTopologyCacheRef = useRef<Map<number, SectionTopology>>(new Map());

  const clipping = useViewerStore((state) => state.clipping);
  const beginClippingInteraction = useViewerStore(
    (state) => state.beginClippingInteraction,
  );
  const endClippingInteraction = useViewerStore(
    (state) => state.endClippingInteraction,
  );
  const selectClippingPlane = useViewerStore((state) => state.selectClippingPlane);
  const updateClippingPlaneTransform = useViewerStore(
    (state) => state.updateClippingPlaneTransform,
  );
  const resizeClippingPlane = useViewerStore((state) => state.resizeClippingPlane);

  const selectedPlane = useMemo(
    () => getActiveClippingPlane(clipping),
    [clipping],
  );
  const selectedPlaneRef = useRef(selectedPlane);

  useEffect(() => {
    selectedPlaneRef.current = selectedPlane;
  }, [selectedPlane]);

  const activePlaneEntries = useMemo<ActiveClippingPlaneEntry[]>(
    () =>
      clipping.planes
        .filter((plane) => plane.enabled)
        .map((plane) => ({
          planeId: plane.id,
          ...buildRuntimeClippingPlanes(plane),
        })),
    [clipping.planes],
  );

  const clippingPlanes = useMemo(
    () => activePlaneEntries.map((entry) => entry.mainPlane),
    [activePlaneEntries],
  );
  const sceneMetrics = useMemo(
    () => calculateClippingSceneMetrics(manifest.modelBounds),
    [manifest.modelBounds],
  );

  useGumballInput(
    refs,
    planeVisualsRef,
    gumballRef,
    selectedPlane,
    {
      beginClippingInteraction,
      endClippingInteraction,
      selectClippingPlane,
      updateClippingPlaneTransform,
      resizeClippingPlane,
    },
    sceneMetrics.minPlaneSize,
    sceneGeneration,
  );

  const syncCloneMaterials = useCallback(
    (planes: THREE.Plane[]) => {
      refs.chunkGroupsRef.current.forEach((chunkGroup) => {
        chunkGroup.materials.forEach((material) => {
          if (material.userData?.poolClone) {
            (material as THREE.MeshPhongMaterial).clippingPlanes =
              planes.length > 0 ? planes : null;
            material.needsUpdate = true;
          }
        });
      });
    },
    [refs],
  );

  const syncGumballToViewportScale = useCallback(() => {
    return syncClippingGumballViewportScale({
      gumball: gumballRef.current,
      camera: refs.cameraRef.current,
      renderer: refs.rendererRef.current,
      plane: selectedPlaneRef.current,
    });
  }, [refs]);

  const ensureSectionEdgesGroup = useCallback(() => {
    const scene = refs.sceneRef.current;
    if (!scene) {
      return null;
    }

    if (!sectionEdgesGroupRef.current) {
      sectionEdgesGroupRef.current = new THREE.Group();
      sectionEdgesGroupRef.current.name = "clipping-section-edges";
      scene.add(sectionEdgesGroupRef.current);
    }

    return sectionEdgesGroupRef.current;
  }, [refs]);

  const disposeSectionEdges = useCallback(() => {
    disposeGroupChildren(sectionEdgesGroupRef.current);
  }, []);

  const getSectionTopology = useCallback(
    (geometryExpressId: number, geometry: THREE.BufferGeometry) => {
      return getOrCreateSectionTopology(
        sectionTopologyCacheRef.current,
        geometryExpressId,
        geometry,
      );
    },
    [],
  );

  useEffect(() => {
    const scene = refs.sceneRef.current;
    if (!scene) {
      return;
    }

    setGlobalClippingPlanes(clippingPlanes);
    syncCloneMaterials(clippingPlanes);

    const syncedScene = syncClippingPlaneScene({
      scene,
      planes: clipping.planes,
      planeVisuals: planeVisualsRef.current,
      draft: clipping.draft,
      draftVisual: draftVisualRef.current,
      selectedPlane,
      gumball: gumballRef.current,
      widgetScale: sceneMetrics.widgetScale,
      gumballScale: sceneMetrics.gumballScale,
      minPlaneSize: sceneMetrics.minPlaneSize,
      isCreatingDraft: clipping.mode === "creating",
      syncGumballToViewportScale,
    });
    draftVisualRef.current = syncedScene.draftVisual;
    gumballRef.current = syncedScene.gumball;

    refs.needsRenderRef.current = true;
  }, [
    chunkVersion,
    clipping,
    clippingPlanes,
    refs,
    sceneGeneration,
    selectedPlane,
    sceneMetrics.gumballScale,
    sceneMetrics.minPlaneSize,
    sceneMetrics.widgetScale,
    syncGumballToViewportScale,
    syncCloneMaterials,
  ]);

  useEffect(() => {
    const controls = refs.controlsRef.current;
    const container = refs.containerRef.current;
    if (!controls || !container) {
      return;
    }

    const syncAndRequestRender = () => {
      if (!syncGumballToViewportScale()) {
        return;
      }
      refs.needsRenderRef.current = true;
    };

    return bindClippingGumballViewportLifecycle({
      controls,
      container,
      syncAndRequestRender,
    });
  }, [refs, sceneGeneration, syncGumballToViewportScale]);

  useEffect(() => {
    const sectionGroup = ensureSectionEdgesGroup();
    if (!sectionGroup) {
      return;
    }

    const statsTarget = getSectionStatsTarget();
    if (activePlaneEntries.length === 0) {
      disposeSectionEdges();
      statsTarget.__ifcSectionStats = {};
      refs.needsRenderRef.current = true;
      return;
    }

    if (clipping.interaction.dragging) {
      const draggingPlaneId = clipping.interaction.planeId;
      const validPlaneIds = new Set(activePlaneEntries.map((e) => e.planeId));

      sectionGroup.children.slice().forEach((child) => {
        if (!validPlaneIds.has(child.userData.planeId)) {
          sectionGroup.remove(child);
          disposeObjectTree(child);
        }
      });

      sectionGroup.children.forEach((child) => {
        child.visible = child.userData.planeId !== draggingPlaneId;
      });
      refs.needsRenderRef.current = true;
      return;
    }

    disposeSectionEdges();

    const sectionEdgeColor = new THREE.Color("#38bdf8");
    const sectionBuild = buildSectionPlaneVisualData({
      activePlanes: activePlaneEntries,
      meshEntries: refs.meshEntriesRef.current,
      geometryCache: refs.geometryCacheRef.current,
      getSectionTopology,
      sectionEdgeOffset: sceneMetrics.sectionEdgeOffset,
    });

    sectionBuild.visuals.forEach((visual) => {
      sectionGroup.add(
        createSectionPlaneVisualGroup({
          planeId: visual.planeId,
          edgePositions: visual.edgePositions,
          closedLoops: visual.closedLoops,
          normal: visual.normal,
          clippingPlanes: visual.clippingPlanes,
          edgeColor: sectionEdgeColor,
          edgeOffset: sceneMetrics.sectionEdgeOffset,
        }),
      );
    });

    statsTarget.__ifcSectionStats = sectionBuild.statsByPlaneId;
    refs.needsRenderRef.current = true;
  }, [
    activePlaneEntries,
    chunkVersion,
    clipping.interaction.dragging,
    clipping.interaction.planeId,
    clippingPlanes,
    disposeSectionEdges,
    ensureSectionEdgesGroup,
    getSectionTopology,
    refs,
    sceneMetrics.sectionEdgeOffset,
    sceneGeneration,
  ]);

  useEffect(() => {
    return () => {
      setGlobalClippingPlanes([]);
      syncCloneMaterials([]);
      disposeClippingSceneResources({
        scene: refs.sceneRef.current,
        sectionEdgesGroup: sectionEdgesGroupRef.current,
        sectionTopologyCache: sectionTopologyCacheRef.current,
        planeVisuals: planeVisualsRef.current,
        draftVisual: draftVisualRef.current,
        gumball: gumballRef.current,
      });
      sectionEdgesGroupRef.current = null;
      draftVisualRef.current = null;
      gumballRef.current = null;
    };
  }, [refs, sceneGeneration, syncCloneMaterials]);
}
