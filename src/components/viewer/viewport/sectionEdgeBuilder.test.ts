import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildSectionEdgePositions } from "./sectionEdgeBuilder";
import { buildSectionTopology } from "./sectionTopologyCache";

function collectUniquePoints(positions: number[]) {
  const keys = new Set<string>();
  for (let index = 0; index < positions.length; index += 3) {
    keys.add(
      [
        positions[index]?.toFixed(5),
        positions[index + 1]?.toFixed(5),
        positions[index + 2]?.toFixed(5),
      ].join(":"),
    );
  }
  return keys;
}

describe("sectionEdgeBuilder", () => {
  it("builds a closed rectangular loop when slicing through a box", () => {
    const topology = buildSectionTopology(new THREE.BoxGeometry(2, 2, 2));
    const result = buildSectionEdgePositions(
      topology,
      new THREE.Matrix4(),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
      0,
    );

    expect(result.stats.stitchedLoops).toBe(1);
    expect(result.positions.length / 6).toBe(4);
    expect(result.closedLoops.length).toBe(1);
    expect(result.closedLoops[0]?.points.length).toBe(4);

    const uniquePoints = collectUniquePoints(result.positions);
    expect(uniquePoints.size).toBe(4);
    uniquePoints.forEach((pointKey) => {
      expect(pointKey.startsWith("0.00000:")).toBe(true);
    });
  });

  it("extracts only the outer face boundary when the clipping plane is coplanar with a box face", () => {
    const topology = buildSectionTopology(new THREE.BoxGeometry(2, 2, 2));
    const result = buildSectionEdgePositions(
      topology,
      new THREE.Matrix4(),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -1),
      0,
    );

    expect(result.stats.coplanarFaces).toBeGreaterThan(0);
    expect(result.positions.length / 6).toBe(4);
    expect(result.stats.dedupedSegments).toBe(4);
    expect(result.stats.stitchedLoops).toBe(1);
  });

  it("handles duplicate local vertices and instance transforms without stitching across objects", () => {
    const topology = buildSectionTopology(new THREE.BoxGeometry(2, 2, 2).toNonIndexed());
    const translatedMatrix = new THREE.Matrix4().makeTranslation(5, 0, 0);
    const translatedPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -5);

    const result = buildSectionEdgePositions(
      topology,
      translatedMatrix,
      translatedPlane,
      0,
    );

    expect(result.stats.stitchedLoops).toBe(1);
    expect(result.positions.length / 6).toBe(4);

    const uniquePoints = collectUniquePoints(result.positions);
    expect(uniquePoints.size).toBe(4);
    uniquePoints.forEach((pointKey) => {
      expect(pointKey.startsWith("5.00000:")).toBe(true);
    });
  });

  it("does not emit section edges for open surface geometry", () => {
    const topology = buildSectionTopology(new THREE.PlaneGeometry(10, 10, 2, 2));
    const result = buildSectionEdgePositions(
      topology,
      new THREE.Matrix4(),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
      0,
    );

    expect(topology.isClosedManifold).toBe(false);
    expect(result.stats.stitchedLoops).toBe(0);
    expect(result.closedLoops.length).toBe(0);
    expect(result.positions.length).toBeGreaterThan(0);
  });

  it("clips section edges to the plane rectangle bounds", () => {
    const topology = buildSectionTopology(new THREE.BoxGeometry(6, 6, 6));
    const result = buildSectionEdgePositions(
      topology,
      new THREE.Matrix4(),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
      0,
      [
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -4),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), -4),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), -1),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), -1),
      ],
    );

    expect(result.positions.length).toBeGreaterThan(0);
    for (let index = 0; index < result.positions.length; index += 3) {
      expect(Math.abs(result.positions[index + 2] ?? 0)).toBeLessThanOrEqual(1.0001);
    }
  });
});
