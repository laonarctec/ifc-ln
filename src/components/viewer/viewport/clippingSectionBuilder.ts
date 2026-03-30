import * as THREE from "three";
import {
  buildSectionEdgePositions,
  type SectionBuildStats,
  type SectionClosedLoop,
} from "./sectionEdgeBuilder";
import type { GeometryCacheEntry } from "./geometryFactory";
import type { RenderEntry } from "./meshManagement";
import type { SectionTopology } from "./sectionTopologyCache";

export interface RuntimeSectionPlaneEntry {
  planeId: string;
  mainPlane: THREE.Plane;
}

export interface SectionPlaneStats extends SectionBuildStats {
  entriesVisited: number;
}

export interface SectionPlaneVisualData {
  planeId: string;
  edgePositions: number[];
  closedLoops: SectionClosedLoop[];
  normal: THREE.Vector3;
  clippingPlanes: THREE.Plane[];
}

export interface BuildSectionPlaneVisualDataParams {
  activePlanes: RuntimeSectionPlaneEntry[];
  meshEntries: RenderEntry[];
  geometryCache: Map<number, GeometryCacheEntry>;
  getSectionTopology: (
    geometryExpressId: number,
    geometry: THREE.BufferGeometry,
  ) => SectionTopology;
  sectionEdgeOffset: number;
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

export function createSectionPlaneStats(): SectionPlaneStats {
  return { ...EMPTY_SECTION_STATS };
}

export function accumulateSectionPlaneStats(
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

export function buildSectionPlaneVisualData({
  activePlanes,
  meshEntries,
  geometryCache,
  getSectionTopology,
  sectionEdgeOffset,
}: BuildSectionPlaneVisualDataParams) {
  const statsByPlaneId: Record<string, SectionPlaneStats> = {};
  const visuals: SectionPlaneVisualData[] = [];

  for (const activePlane of activePlanes) {
    const planeStats = createSectionPlaneStats();
    const planePositions: number[] = [];
    const planeClosedLoops: SectionClosedLoop[] = [];

    for (const entry of meshEntries) {
      const isVisible =
        entry.object instanceof THREE.BatchedMesh
          ? entry.object.getVisibleAt(entry.instanceIndex ?? 0)
          : entry.object.visible;
      if (!isVisible) {
        continue;
      }

      const geometry =
        geometryCache.get(entry.geometryExpressId)?.geometry ??
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
      );
      accumulateSectionPlaneStats(planeStats, result.stats);
      planePositions.push(...result.positions);
      planeClosedLoops.push(...result.closedLoops);
    }

    statsByPlaneId[activePlane.planeId] = planeStats;
    if (planePositions.length === 0) {
      continue;
    }

    visuals.push({
      planeId: activePlane.planeId,
      edgePositions: planePositions,
      closedLoops: planeClosedLoops,
      normal: activePlane.mainPlane.normal,
      clippingPlanes: activePlanes
        .filter((entry) => entry.planeId !== activePlane.planeId)
        .map((entry) => entry.mainPlane),
    });
  }

  return {
    statsByPlaneId,
    visuals,
  };
}
