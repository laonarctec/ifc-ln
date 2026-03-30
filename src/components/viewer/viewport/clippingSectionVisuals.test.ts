import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  createSectionPlaneVisualGroup,
  disposeObjectTree,
} from "./clippingSectionVisuals";
import { isSelectionBlocked } from "./selectionBlockers";

describe("clippingSectionVisuals", () => {
  it("creates a section visual group with edge geometry and fill layers", () => {
    const group = createSectionPlaneVisualGroup({
      planeId: "plane-a",
      edgePositions: [
        0, 0, 0,
        1, 0, 0,
        1, 0, 0,
        1, 1, 0,
      ],
      closedLoops: [
        {
          points: [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(1, 1, 0),
            new THREE.Vector3(0, 1, 0),
          ],
        },
      ],
      normal: new THREE.Vector3(0, 0, 1),
      clippingPlanes: [],
      edgeColor: "#38bdf8",
      edgeOffset: 0.01,
    });

    expect(group.name).toBe("clipping-section-edge:plane-a");
    expect(group.userData.planeId).toBe("plane-a");
    expect(group.children).toHaveLength(4);
    expect(group.children[0]).toBeInstanceOf(THREE.LineSegments);
    expect(group.children.some((child) => isSelectionBlocked(child))).toBe(true);
  });

  it("disposes geometry and both single and array materials across the tree", () => {
    const root = new THREE.Group();
    const childGeometry = new THREE.BufferGeometry();
    const childMaterial = new THREE.MeshBasicMaterial();
    const child = new THREE.Mesh(childGeometry, childMaterial);
    root.add(child);

    const secondGeometry = new THREE.BufferGeometry();
    const secondMaterials = [
      new THREE.MeshBasicMaterial(),
      new THREE.MeshBasicMaterial(),
    ];
    const secondChild = new THREE.Mesh(secondGeometry, secondMaterials);
    root.add(secondChild);

    const geometryDispose = vi.spyOn(childGeometry, "dispose");
    const materialDispose = vi.spyOn(childMaterial, "dispose");
    const secondGeometryDispose = vi.spyOn(secondGeometry, "dispose");
    const secondMaterialDisposes = secondMaterials.map((material) =>
      vi.spyOn(material, "dispose"),
    );

    disposeObjectTree(root);

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(secondGeometryDispose).toHaveBeenCalledTimes(1);
    secondMaterialDisposes.forEach((spy) => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
