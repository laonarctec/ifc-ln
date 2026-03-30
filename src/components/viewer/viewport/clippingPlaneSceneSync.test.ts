import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type {
  ClippingPlaneDraft,
  ClippingPlaneObject,
} from "@/stores/slices/clippingSlice";
import { createPlaneWidget } from "./clippingPlaneWidget";
import { syncClippingPlaneScene } from "./clippingPlaneSceneSync";

function createPlane(
  id: string,
  overrides: Partial<ClippingPlaneObject> = {},
): ClippingPlaneObject {
  return {
    id,
    name: id,
    enabled: true,
    locked: false,
    selected: false,
    origin: [0, 0, 0],
    normal: [0, 0, 1],
    uAxis: [1, 0, 0],
    vAxis: [0, 1, 0],
    width: 3,
    height: 2,
    flipped: false,
    labelVisible: true,
    ...overrides,
  };
}

function createDraft(
  overrides: Partial<ClippingPlaneDraft> = {},
): ClippingPlaneDraft {
  return {
    stage: "second-point",
    anchor: [0, 0, 0],
    origin: [1, 2, 3],
    normal: [0, 0, 1],
    uAxis: [1, 0, 0],
    vAxis: [0, 1, 0],
    width: 0.1,
    height: 0.2,
    ...overrides,
  };
}

describe("clippingPlaneSceneSync", () => {
  it("syncs committed plane visuals and removes stale widgets", () => {
    const scene = new THREE.Scene();
    const staleVisual = createPlaneWidget("stale");
    scene.add(staleVisual.group);

    const planeVisuals = new Map([["stale", staleVisual]]);
    const plane = createPlane("plane-a", {
      selected: true,
      origin: [4, 5, 6],
    });

    syncClippingPlaneScene({
      scene,
      planes: [plane],
      planeVisuals,
      draft: null,
      draftVisual: null,
      selectedPlane: null,
      gumball: null,
      widgetScale: 2,
      gumballScale: 4,
      minPlaneSize: 0.5,
      isCreatingDraft: false,
      syncGumballToViewportScale: vi.fn(() => true),
    });

    const syncedVisual = planeVisuals.get("plane-a");
    expect(syncedVisual).toBeDefined();
    expect([...planeVisuals.keys()]).toEqual(["plane-a"]);
    expect(scene.children.includes(staleVisual.group)).toBe(false);
    expect(scene.children.includes(syncedVisual!.group)).toBe(true);
    expect(syncedVisual!.group.position.toArray()).toEqual([4, 5, 6]);
    expect(syncedVisual!.group.visible).toBe(true);
  });

  it("creates and removes the draft visual based on draft state", () => {
    const scene = new THREE.Scene();
    const planeVisuals = new Map<string, ReturnType<typeof createPlaneWidget>>();

    const firstSync = syncClippingPlaneScene({
      scene,
      planes: [],
      planeVisuals,
      draft: createDraft(),
      draftVisual: null,
      selectedPlane: null,
      gumball: null,
      widgetScale: 3,
      gumballScale: 4,
      minPlaneSize: 0.5,
      isCreatingDraft: true,
      syncGumballToViewportScale: vi.fn(() => true),
    });

    expect(firstSync.draftVisual).not.toBeNull();
    expect(scene.children.includes(firstSync.draftVisual!.group)).toBe(true);
    expect(firstSync.draftVisual!.bodyMesh.scale.x).toBeCloseTo(0.5);
    expect(firstSync.draftVisual!.bodyMesh.scale.y).toBeCloseTo(0.5);

    const secondSync = syncClippingPlaneScene({
      scene,
      planes: [],
      planeVisuals,
      draft: null,
      draftVisual: firstSync.draftVisual,
      selectedPlane: null,
      gumball: null,
      widgetScale: 3,
      gumballScale: 4,
      minPlaneSize: 0.5,
      isCreatingDraft: false,
      syncGumballToViewportScale: vi.fn(() => true),
    });

    expect(secondSync.draftVisual).toBeNull();
    expect(scene.children.includes(firstSync.draftVisual!.group)).toBe(false);
  });

  it("creates and hides the gumball based on the selected plane", () => {
    const scene = new THREE.Scene();
    const planeVisuals = new Map<string, ReturnType<typeof createPlaneWidget>>();
    const syncGumballToViewportScale = vi.fn(() => true);

    const firstSync = syncClippingPlaneScene({
      scene,
      planes: [],
      planeVisuals,
      draft: null,
      draftVisual: null,
      selectedPlane: createPlane("plane-a"),
      gumball: null,
      widgetScale: 3,
      gumballScale: 4,
      minPlaneSize: 0.5,
      isCreatingDraft: false,
      syncGumballToViewportScale,
    });

    expect(firstSync.gumball).not.toBeNull();
    expect(scene.children.includes(firstSync.gumball!.group)).toBe(true);
    expect(firstSync.gumball!.group.visible).toBe(true);
    expect(syncGumballToViewportScale).toHaveBeenCalledTimes(1);

    const secondSync = syncClippingPlaneScene({
      scene,
      planes: [],
      planeVisuals,
      draft: null,
      draftVisual: null,
      selectedPlane: createPlane("plane-a", { locked: true }),
      gumball: firstSync.gumball,
      widgetScale: 3,
      gumballScale: 4,
      minPlaneSize: 0.5,
      isCreatingDraft: false,
      syncGumballToViewportScale,
    });

    expect(secondSync.gumball?.group.visible).toBe(false);
    expect(syncGumballToViewportScale).toHaveBeenCalledTimes(1);
  });
});
