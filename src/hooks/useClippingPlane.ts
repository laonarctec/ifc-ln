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
import {
  buildRuntimeClippingPlanes,
  getPlaneQuaternion,
} from "@/components/viewer/viewport/clippingMath";
import {
  buildSectionEdgePositions,
  type SectionBuildStats,
  type SectionClosedLoop,
} from "@/components/viewer/viewport/sectionEdgeBuilder";
import { buildSectionFillGeometry } from "@/components/viewer/viewport/sectionFillBuilder";
import { buildSectionTopology } from "@/components/viewer/viewport/sectionTopologyCache";
import type { SectionTopology } from "@/components/viewer/viewport/sectionTopologyCache";
import { useGumballInput } from "./useGumballInput";

export interface ClippingPlaneLabel {
  id: string;
  name: string;
  left: number;
  top: number;
  selected: boolean;
}

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
  const [labels, setLabels] = useState<ClippingPlaneLabel[]>([]);

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
    () =>
      clipping.activePlaneId
        ? clipping.planes.find((plane) => plane.id === clipping.activePlaneId) ?? null
        : null,
    [clipping.activePlaneId, clipping.planes],
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
      beginClippingInteraction,
      endClippingInteraction,
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
  }, [
    chunkVersion,
    clipping,
    clippingPlanes,
    refs,
    sceneGeneration,
    selectedPlane,
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

    const sectionEdgeOffset = THREE.MathUtils.clamp(
      modelSize.current * 0.00035,
      0.0002,
      0.003,
    );
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
          sectionEdgeOffset,
          activePlane.sidePlanes,
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
        clippingPlanes: activePlaneEntries
          .filter((entry) => entry.planeId !== activePlane.planeId)
          .map((entry) => entry.mainPlane),
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
          const fillGeometry = new THREE.BufferGeometry();
          fillGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(fillPositions, 3),
          );
          const n = activePlane.mainPlane.normal;
          const normals = new Float32Array(fillPositions.length);
          for (let i = 0; i < fillPositions.length; i += 3) {
            normals[i] = n.x;
            normals[i + 1] = n.y;
            normals[i + 2] = n.z;
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
            clippingPlanes: activePlaneEntries
              .filter((entry) => entry.planeId !== activePlane.planeId)
              .map((entry) => entry.mainPlane),
            toneMapped: false,
          });

          const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
          fillMesh.renderOrder = 7;
          planeGroup.add(fillMesh);
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

  useEffect(() => {
    const controls = refs.controlsRef.current;
    const container = refs.containerRef.current;
    const camera = refs.cameraRef.current;
    if (!controls || !container || !camera) {
      return;
    }

    let rafId = 0;
    const schedule = () => {
      if (rafId !== 0) {
        return;
      }
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
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [clipping.planes, refs, sceneGeneration]);

  return {
    labels,
    minPlaneSizeRef,
  };
}
