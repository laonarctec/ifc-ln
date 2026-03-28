import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useViewerStore } from "@/stores";
import type { SceneRefs } from "./useThreeScene";
import type { RenderManifest } from "@/types/worker-messages";
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
import {
  buildRuntimeClippingPlanes,
  getPlaneQuaternion,
} from "@/components/viewer/viewport/clippingMath";
import {
  calculateClippingSceneMetrics,
} from "@/components/viewer/viewport/clippingSceneUtils";
import {
  buildSectionEdgePositions,
  type SectionBuildStats,
  type SectionClosedLoop,
} from "@/components/viewer/viewport/sectionEdgeBuilder";
import {
  buildSectionFillGeometry,
  offsetSectionFillPositions,
} from "@/components/viewer/viewport/sectionFillBuilder";
import { buildSectionTopology } from "@/components/viewer/viewport/sectionTopologyCache";
import type { SectionTopology } from "@/components/viewer/viewport/sectionTopologyCache";
import { getActiveClippingPlane } from "@/stores/slices/clippingStateUtils";
import { useGumballInput } from "./useGumballInput";

interface ActiveClippingPlaneEntry {
  planeId: string;
  mainPlane: THREE.Plane;
  sidePlanes: THREE.Plane[];
  allPlanes: THREE.Plane[];
}

interface SectionPlaneStats extends SectionBuildStats {
  entriesVisited: number;
}

const EMPTY_SECTION_STATS: SectionPlaneStats = {
  entriesVisited: 0,
  trianglesTested: 0,
  coplanarFaces: 0,
  rawSegments: 0,
  dedupedSegments: 0,
  stitchedLoops: 0,
  branchNodes: 0,
  droppedDegenerate: 0,
};

function createPlaneStats() {
  return { ...EMPTY_SECTION_STATS };
}

function accumulateSectionStats(
  target: SectionPlaneStats,
  next: SectionBuildStats,
) {
  target.trianglesTested += next.trianglesTested;
  target.coplanarFaces += next.coplanarFaces;
  target.rawSegments += next.rawSegments;
  target.dedupedSegments += next.dedupedSegments;
  target.stitchedLoops += next.stitchedLoops;
  target.branchNodes += next.branchNodes;
  target.droppedDegenerate += next.droppedDegenerate;
}

function disposeObjectTree(object: THREE.Object3D) {
  object.traverse((node) => {
    const disposable = node as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    disposable.geometry?.dispose();
    if (Array.isArray(disposable.material)) {
      disposable.material.forEach((material) => material.dispose());
    } else {
      disposable.material?.dispose();
    }
  });
}

function getSectionStatsTarget() {
  return globalThis as typeof globalThis & {
    __ifcSectionStats?: Record<string, SectionPlaneStats>;
  };
}

function createSectionFillMesh(
  positions: number[],
  normal: THREE.Vector3,
  clippingPlanes: THREE.Plane[],
) {
  const fillGeometry = new THREE.BufferGeometry();
  fillGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );

  const fillNormal = normal.clone().normalize();
  const normals = new Float32Array(positions.length);
  for (let index = 0; index < positions.length; index += 3) {
    normals[index] = fillNormal.x;
    normals[index + 1] = fillNormal.y;
    normals[index + 2] = fillNormal.z;
  }
  fillGeometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normals, 3),
  );

  const fillMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#94a3b8"),
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    clippingPlanes,
    toneMapped: false,
  });

  const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
  fillMesh.renderOrder = 7;
  return fillMesh;
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
  const hiddenEntityKeys = useViewerStore((state) => state.hiddenEntityKeys);
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
          }
        });
      });
    },
    [refs],
  );

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
    const group = sectionEdgesGroupRef.current;
    if (!group) {
      return;
    }

    group.children.slice().forEach((child) => {
      group.remove(child);
      disposeObjectTree(child);
    });
  }, []);

  const getSectionTopology = useCallback(
    (geometryExpressId: number, geometry: THREE.BufferGeometry) => {
      const existing = sectionTopologyCacheRef.current.get(geometryExpressId);
      if (existing) {
        return existing;
      }

      const topology = buildSectionTopology(geometry);
      sectionTopologyCacheRef.current.set(geometryExpressId, topology);
      return topology;
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
        scale: sceneMetrics.widgetScale,
      });
    }

    for (const staleId of staleIds) {
      const visual = planeVisualsRef.current.get(staleId);
      if (!visual) {
        continue;
      }
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
          width: Math.max(draft.width, sceneMetrics.minPlaneSize),
          height: Math.max(draft.height, sceneMetrics.minPlaneSize),
          flipped: false,
          labelVisible: false,
        },
        {
          selected: false,
          interactive: false,
          scale: sceneMetrics.widgetScale,
        },
      );
    } else if (draftVisualRef.current) {
      scene.remove(draftVisualRef.current.group);
      disposePlaneWidget(draftVisualRef.current);
      draftVisualRef.current = null;
    }

    if (selectedPlane && selectedPlane.enabled && !selectedPlane.locked) {
      if (!gumballRef.current) {
        gumballRef.current = createGumball(sceneMetrics.gumballScale);
        scene.add(gumballRef.current.group);
      }

      updateGumballTransform(
        gumballRef.current,
        new THREE.Vector3(...selectedPlane.origin),
        getPlaneQuaternion(selectedPlane),
        sceneMetrics.gumballScale,
      );
      gumballRef.current.group.visible = true;
    } else if (gumballRef.current) {
      gumballRef.current.group.visible = false;
    }

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
    syncCloneMaterials,
  ]);

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
      sectionGroup.children.forEach((child) => {
        child.visible = child.userData.planeId !== draggingPlaneId;
      });
      refs.needsRenderRef.current = true;
      return;
    }

    disposeSectionEdges();

    const sectionEdgeColor = new THREE.Color("#38bdf8");
    const nextStats: Record<string, SectionPlaneStats> = {};

    for (const activePlane of activePlaneEntries) {
      const planeStats = createPlaneStats();
      const planePositions: number[] = [];
      const planeClosedLoops: SectionClosedLoop[] = [];

      for (const entry of refs.meshEntriesRef.current) {
        const isVisible =
          entry.object instanceof THREE.BatchedMesh
            ? entry.object.getVisibleAt(entry.instanceIndex ?? 0)
            : entry.object.visible;
        if (!isVisible) {
          continue;
        }

        const geometry =
          refs.geometryCacheRef.current.get(entry.geometryExpressId)?.geometry ??
          (entry.object instanceof THREE.Mesh ? entry.object.geometry : null);
        if (!geometry) {
          continue;
        }

        const topology = getSectionTopology(entry.geometryExpressId, geometry);
        if (topology.geometryBounds.isEmpty()) {
          continue;
        }

        const worldMatrix =
          entry.object instanceof THREE.BatchedMesh
            ? entry.baseMatrix
            : entry.object.matrixWorld;
        const worldBounds =
          (entry.geometryBounds ?? geometry.boundingBox)?.clone().applyMatrix4(worldMatrix) ??
          null;
        if (worldBounds && !activePlane.mainPlane.intersectsBox(worldBounds)) {
          continue;
        }

        planeStats.entriesVisited += 1;
        const result = buildSectionEdgePositions(
          topology,
          worldMatrix,
          activePlane.mainPlane,
          sceneMetrics.sectionEdgeOffset,
        );
        accumulateSectionStats(planeStats, result.stats);
        planePositions.push(...result.positions);
        planeClosedLoops.push(...result.closedLoops);
      }

      nextStats[activePlane.planeId] = planeStats;
      if (planePositions.length === 0) {
        continue;
      }

      const planeGroup = new THREE.Group();
      planeGroup.name = `clipping-section-edge:${activePlane.planeId}`;
      planeGroup.userData.planeId = activePlane.planeId;
      const sectionClippingPlanes = activePlaneEntries
        .filter((entry) => entry.planeId !== activePlane.planeId)
        .map((entry) => entry.mainPlane);

      const edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(planePositions, 3),
      );

      const edgeMaterial = new THREE.LineBasicMaterial({
        color: sectionEdgeColor,
        transparent: true,
        opacity: 0.96,
        depthTest: true,
        depthWrite: false,
        clippingPlanes: sectionClippingPlanes,
        toneMapped: false,
      });

      const lineSegments = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      lineSegments.renderOrder = 8;
      planeGroup.add(lineSegments);

      if (planeClosedLoops.length > 0) {
        const fillPositions = buildSectionFillGeometry(
          planeClosedLoops,
          activePlane.mainPlane.normal,
        );
        if (fillPositions.length > 0) {
          const fillShift = sceneMetrics.sectionEdgeOffset * 2;
          planeGroup.add(
            createSectionFillMesh(
              fillPositions,
              activePlane.mainPlane.normal,
              sectionClippingPlanes,
            ),
          );
          planeGroup.add(
            createSectionFillMesh(
              offsetSectionFillPositions(
                fillPositions,
                activePlane.mainPlane.normal,
                fillShift,
              ),
              activePlane.mainPlane.normal,
              sectionClippingPlanes,
            ),
          );
        }
      }

      sectionGroup.add(planeGroup);
    }

    statsTarget.__ifcSectionStats = nextStats;
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
    hiddenEntityKeys,
    refs,
    sceneMetrics.sectionEdgeOffset,
    sceneGeneration,
  ]);

  useEffect(() => {
    return () => {
      setGlobalClippingPlanes([]);
      syncCloneMaterials([]);
      disposeSectionEdges();
      if (sectionEdgesGroupRef.current && refs.sceneRef.current) {
        refs.sceneRef.current.remove(sectionEdgesGroupRef.current);
      }
      sectionEdgesGroupRef.current = null;
      sectionTopologyCacheRef.current.clear();
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
  }, [disposeSectionEdges, refs, sceneGeneration, syncCloneMaterials]);
}
