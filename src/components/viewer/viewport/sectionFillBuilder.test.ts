import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildSectionFillGeometry } from "./sectionFillBuilder";
import type { SectionClosedLoop } from "./sectionEdgeBuilder";

describe("sectionFillBuilder", () => {
  it("returns empty array for empty input", () => {
    const result = buildSectionFillGeometry([], new THREE.Vector3(0, 0, 1));
    expect(result.length).toBe(0);
  });

  it("triangulates a triangular loop into 1 triangle", () => {
    const loop: SectionClosedLoop = {
      points: [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
      ],
    };
    const result = buildSectionFillGeometry([loop], new THREE.Vector3(0, 0, 1));
    expect(result.length).toBe(9); // 1 triangle * 3 vertices * 3 coords
  });

  it("triangulates a rectangular loop into 2 triangles", () => {
    const loop: SectionClosedLoop = {
      points: [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(1, 1, 0),
        new THREE.Vector3(0, 1, 0),
      ],
    };
    const result = buildSectionFillGeometry([loop], new THREE.Vector3(0, 0, 1));
    expect(result.length).toBe(18); // 2 triangles * 3 vertices * 3 coords
  });

  it("skips loops with fewer than 3 points", () => {
    const loop: SectionClosedLoop = {
      points: [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
      ],
    };
    const result = buildSectionFillGeometry([loop], new THREE.Vector3(0, 0, 1));
    expect(result.length).toBe(0);
  });
});
