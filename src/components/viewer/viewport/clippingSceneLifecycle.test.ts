import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createPlaneWidget } from "./clippingPlaneWidget";
import { createGumball } from "./gumball";
import {
  disposeClippingSceneResources,
  disposeGroupChildren,
} from "./clippingSceneLifecycle";
import { buildSectionTopology } from "./sectionTopologyCache";

describe("clippingSceneLifecycle", () => {
  it("disposes group children in place", () => {
    const group = new THREE.Group();
    const child = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    group.add(child);

    disposeGroupChildren(group);

    expect(group.children).toHaveLength(0);
  });

  it("removes clipping scene resources and clears caches", () => {
    const scene = new THREE.Scene();
    const sectionEdgesGroup = new THREE.Group();
    const sectionChild = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    sectionEdgesGroup.add(sectionChild);
    scene.add(sectionEdgesGroup);

    const planeVisual = createPlaneWidget("plane-a");
    const planeVisuals = new Map([["plane-a", planeVisual]]);
    scene.add(planeVisual.group);

    const draftVisual = createPlaneWidget("draft");
    scene.add(draftVisual.group);

    const gumball = createGumball(1);
    scene.add(gumball.group);

    const sectionTopologyCache = new Map([
      [11, buildSectionTopology(new THREE.BoxGeometry(2, 2, 2))],
    ]);

    disposeClippingSceneResources({
      scene,
      sectionEdgesGroup,
      sectionTopologyCache,
      planeVisuals,
      draftVisual,
      gumball,
    });

    expect(scene.children.includes(sectionEdgesGroup)).toBe(false);
    expect(scene.children.includes(planeVisual.group)).toBe(false);
    expect(scene.children.includes(draftVisual.group)).toBe(false);
    expect(scene.children.includes(gumball.group)).toBe(false);
    expect(sectionEdgesGroup.children).toHaveLength(0);
    expect(planeVisuals.size).toBe(0);
    expect(sectionTopologyCache.size).toBe(0);
  });
});
