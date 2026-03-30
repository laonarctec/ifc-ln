import * as THREE from "three";
import type {
  ClippingPlaneDraft,
  ClippingPlaneObject,
} from "@/stores/slices/clippingSlice";
import {
  createPlaneWidget,
  disposePlaneWidget,
  type ClippingPlaneWidgetVisual,
  updatePlaneWidget,
} from "./clippingPlaneWidget";
import { createGumball, type GumballComponents } from "./gumball";

interface SyncClippingPlaneSceneParams {
  scene: THREE.Scene;
  planes: ClippingPlaneObject[];
  planeVisuals: Map<string, ClippingPlaneWidgetVisual>;
  draft: ClippingPlaneDraft | null;
  draftVisual: ClippingPlaneWidgetVisual | null;
  selectedPlane: ClippingPlaneObject | null;
  gumball: GumballComponents | null;
  widgetScale: number;
  gumballScale: number;
  minPlaneSize: number;
  isCreatingDraft: boolean;
  syncGumballToViewportScale: () => boolean;
}

interface SyncClippingPlaneSceneResult {
  draftVisual: ClippingPlaneWidgetVisual | null;
  gumball: GumballComponents | null;
}

function syncPlaneVisuals(
  scene: THREE.Scene,
  planeVisuals: Map<string, ClippingPlaneWidgetVisual>,
  planes: ClippingPlaneObject[],
  widgetScale: number,
) {
  const staleIds = new Set(planeVisuals.keys());
  for (const plane of planes) {
    staleIds.delete(plane.id);
    let visual = planeVisuals.get(plane.id) ?? null;
    if (!visual) {
      visual = createPlaneWidget(plane.id);
      planeVisuals.set(plane.id, visual);
      scene.add(visual.group);
    }

    updatePlaneWidget(visual, plane, {
      selected: plane.selected,
      interactive: plane.selected,
      scale: widgetScale,
    });
  }

  for (const staleId of staleIds) {
    const visual = planeVisuals.get(staleId);
    if (!visual) {
      continue;
    }
    scene.remove(visual.group);
    disposePlaneWidget(visual);
    planeVisuals.delete(staleId);
  }
}

function isRenderableDraft(
  draft: ClippingPlaneDraft | null,
): draft is ClippingPlaneDraft & {
  origin: [number, number, number];
  normal: [number, number, number];
  uAxis: [number, number, number];
  vAxis: [number, number, number];
} {
  return Boolean(draft?.origin && draft.normal && draft.uAxis && draft.vAxis);
}

function buildDraftPlaneObject(
  draft: ClippingPlaneDraft & {
    origin: [number, number, number];
    normal: [number, number, number];
    uAxis: [number, number, number];
    vAxis: [number, number, number];
  },
  minPlaneSize: number,
): ClippingPlaneObject {
  return {
    id: "draft",
    name: "Draft",
    enabled: true,
    locked: true,
    selected: false,
    origin: draft.origin,
    normal: draft.normal,
    uAxis: draft.uAxis,
    vAxis: draft.vAxis,
    width: Math.max(draft.width, minPlaneSize),
    height: Math.max(draft.height, minPlaneSize),
    flipped: false,
    labelVisible: false,
  };
}

function syncDraftVisual(
  scene: THREE.Scene,
  draftVisual: ClippingPlaneWidgetVisual | null,
  draft: ClippingPlaneDraft | null,
  isCreatingDraft: boolean,
  minPlaneSize: number,
  widgetScale: number,
) {
  if (isCreatingDraft && isRenderableDraft(draft)) {
    let nextDraftVisual = draftVisual;
    if (!nextDraftVisual) {
      nextDraftVisual = createPlaneWidget("draft");
      scene.add(nextDraftVisual.group);
    }

    updatePlaneWidget(
      nextDraftVisual,
      buildDraftPlaneObject(draft, minPlaneSize),
      {
        selected: false,
        interactive: false,
        scale: widgetScale,
      },
    );

    return nextDraftVisual;
  }

  if (draftVisual) {
    scene.remove(draftVisual.group);
    disposePlaneWidget(draftVisual);
  }

  return null;
}

function syncGumballVisual(
  scene: THREE.Scene,
  gumball: GumballComponents | null,
  selectedPlane: ClippingPlaneObject | null,
  gumballScale: number,
  syncGumballToViewportScale: () => boolean,
) {
  let nextGumball = gumball;

  if (selectedPlane && selectedPlane.enabled && !selectedPlane.locked) {
    if (!nextGumball) {
      nextGumball = createGumball(gumballScale);
      scene.add(nextGumball.group);
    }

    syncGumballToViewportScale();
    nextGumball.group.visible = true;
    return nextGumball;
  }

  if (nextGumball) {
    nextGumball.group.visible = false;
  }

  return nextGumball;
}

export function syncClippingPlaneScene(
  params: SyncClippingPlaneSceneParams,
): SyncClippingPlaneSceneResult {
  syncPlaneVisuals(
    params.scene,
    params.planeVisuals,
    params.planes,
    params.widgetScale,
  );

  return {
    draftVisual: syncDraftVisual(
      params.scene,
      params.draftVisual,
      params.draft,
      params.isCreatingDraft,
      params.minPlaneSize,
      params.widgetScale,
    ),
    gumball: syncGumballVisual(
      params.scene,
      params.gumball,
      params.selectedPlane,
      params.gumballScale,
      params.syncGumballToViewportScale,
    ),
  };
}
