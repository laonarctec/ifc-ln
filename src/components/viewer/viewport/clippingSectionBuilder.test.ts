import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildSectionPlaneVisualData,
} from "./clippingSectionBuilder";
import type { RenderEntry } from "./meshManagement";
import { buildSectionTopology } from "./sectionTopologyCache";
import { createModelEntityKey } from "@/utils/modelEntity";

function createMeshEntry({
  geometryExpressId,
  geometry,
  visible = true,
}: {
  geometryExpressId: number;
  geometry: THREE.BufferGeometry;
  visible?: boolean;
}): RenderEntry {
  geometry.computeBoundingBox();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.visible = visible;
  mesh.updateMatrixWorld(true);

  return {
    modelId: 1,
    expressId: geometryExpressId,
    entityKey: createModelEntityKey(1, geometryExpressId),
    object: mesh,
    baseColor: new THREE.Color("#ffffff"),
    baseOpacity: 1,
    instanceIndex: null,
    baseMatrix: new THREE.Matrix4(),
    geometryExpressId,
    geometryBounds: geometry.boundingBox?.clone() ?? null,
  };
}

describe("clippingSectionBuilder", () => {
  it("builds section visual data and stats for intersecting visible meshes", () => {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const meshEntries = [createMeshEntry({ geometryExpressId: 11, geometry })];
    const topologyCache = new Map<number, ReturnType<typeof buildSectionTopology>>();

    const result = buildSectionPlaneVisualData({
      activePlanes: [
        {
          planeId: "plane-a",
          mainPlane: new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
        },
      ],
      meshEntries,
      geometryCache: new Map(),
      getSectionTopology: (geometryExpressId, nextGeometry) => {
        const existing = topologyCache.get(geometryExpressId);
        if (existing) {
          return existing;
        }
        const topology = buildSectionTopology(nextGeometry);
        topologyCache.set(geometryExpressId, topology);
        return topology;
      },
      sectionEdgeOffset: 0,
    });

    expect(result.statsByPlaneId["plane-a"]?.entriesVisited).toBe(1);
    expect(result.visuals).toHaveLength(1);
    expect(result.visuals[0]?.planeId).toBe("plane-a");
    expect(result.visuals[0]?.edgePositions.length ?? 0).toBeGreaterThan(0);
    expect(result.visuals[0]?.closedLoops.length).toBe(1);
  });

  it("skips hidden meshes and excludes the active plane from sibling clipping planes", () => {
    const visibleEntry = createMeshEntry({
      geometryExpressId: 21,
      geometry: new THREE.BoxGeometry(2, 2, 2),
      visible: true,
    });
    const hiddenEntry = createMeshEntry({
      geometryExpressId: 22,
      geometry: new THREE.BoxGeometry(2, 2, 2),
      visible: false,
    });

    const result = buildSectionPlaneVisualData({
      activePlanes: [
        {
          planeId: "plane-a",
          mainPlane: new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
        },
        {
          planeId: "plane-b",
          mainPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        },
      ],
      meshEntries: [visibleEntry, hiddenEntry],
      geometryCache: new Map(),
      getSectionTopology: (_geometryExpressId, geometry) =>
        buildSectionTopology(geometry),
      sectionEdgeOffset: 0,
    });

    expect(result.statsByPlaneId["plane-a"]?.entriesVisited).toBe(1);
    expect(result.statsByPlaneId["plane-b"]?.entriesVisited).toBe(1);
    expect(
      result.visuals.find((visual) => visual.planeId === "plane-a")?.clippingPlanes,
    ).toHaveLength(1);
    expect(
      result.visuals.find((visual) => visual.planeId === "plane-b")?.clippingPlanes,
    ).toHaveLength(1);
  });
});
