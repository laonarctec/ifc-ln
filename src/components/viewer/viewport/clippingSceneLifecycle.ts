import * as THREE from "three";
import {
  disposePlaneWidget,
  type ClippingPlaneWidgetVisual,
} from "./clippingPlaneWidget";
import { disposeGumball, type GumballComponents } from "./gumball";
import { disposeObjectTree } from "./clippingSectionVisuals";
import type { SectionTopology } from "./sectionTopologyCache";

interface DisposeClippingSceneResourcesParams {
  scene: THREE.Scene | null;
  sectionEdgesGroup: THREE.Group | null;
  sectionTopologyCache: Map<number, SectionTopology>;
  planeVisuals: Map<string, ClippingPlaneWidgetVisual>;
  draftVisual: ClippingPlaneWidgetVisual | null;
  gumball: GumballComponents | null;
}

export function disposeGroupChildren(group: THREE.Group | null) {
  if (!group) {
    return;
  }

  group.children.slice().forEach((child) => {
    group.remove(child);
    disposeObjectTree(child);
  });
}

export function disposeClippingSceneResources({
  scene,
  sectionEdgesGroup,
  sectionTopologyCache,
  planeVisuals,
  draftVisual,
  gumball,
}: DisposeClippingSceneResourcesParams) {
  disposeGroupChildren(sectionEdgesGroup);
  if (sectionEdgesGroup) {
    scene?.remove(sectionEdgesGroup);
  }
  sectionTopologyCache.clear();

  planeVisuals.forEach((visual) => {
    scene?.remove(visual.group);
    disposePlaneWidget(visual);
  });
  planeVisuals.clear();

  if (draftVisual) {
    scene?.remove(draftVisual.group);
    disposePlaneWidget(draftVisual);
  }

  if (gumball) {
    scene?.remove(gumball.group);
    disposeGumball(gumball);
  }
}
