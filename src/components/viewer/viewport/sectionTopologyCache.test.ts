import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildSectionTopology,
  getOrCreateSectionTopology,
} from "./sectionTopologyCache";

describe("sectionTopologyCache", () => {
  it("reuses cached topology for the same geometry express id", () => {
    const cache = new Map<number, ReturnType<typeof buildSectionTopology>>();
    const geometry = new THREE.BoxGeometry(2, 2, 2);

    const first = getOrCreateSectionTopology(cache, 11, geometry);
    const second = getOrCreateSectionTopology(cache, 11, geometry);

    expect(first).toBe(second);
    expect(cache.size).toBe(1);
  });

  it("builds an empty topology when the geometry has no position attribute", () => {
    const topology = buildSectionTopology(new THREE.BufferGeometry());

    expect(topology.geometryBounds.isEmpty()).toBe(true);
    expect(topology.triangles.length).toBe(0);
    expect(topology.edges.size).toBe(0);
    expect(topology.isClosedManifold).toBe(false);
  });
});
