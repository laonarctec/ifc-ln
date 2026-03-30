import * as THREE from "three";
import type { ViewCamera } from "./cameraMath";
import { createBoxSelectionQuery } from "./viewportPointerUtils";
import {
  pickEntitiesInBox,
  type BoxSelectionResult,
} from "./raycasting";
import type { ViewportContextMenuCommand } from "./viewportInputCommands";
import type { ModelEntityKey } from "@/utils/modelEntity";

export function executeViewportContextMenuCommand(params: {
  command: ViewportContextMenuCommand;
  clientX: number;
  clientY: number;
  onSelectEntity: (
    modelId: number | null,
    expressId: number | null,
    additive?: boolean,
  ) => void;
  onContextMenu?: (
    modelId: number | null,
    expressId: number | null,
    position: { x: number; y: number },
  ) => void;
}) {
  const {
    command,
    clientX,
    clientY,
    onSelectEntity,
    onContextMenu,
  } = params;

  if (command.kind !== "open") {
    return false;
  }

  if (command.selectBeforeOpen && command.expressId !== null) {
    onSelectEntity(command.modelId, command.expressId);
  }

  onContextMenu?.(command.modelId, command.expressId, {
    x: clientX,
    y: clientY,
  });
  return true;
}

export function completeViewportBoxSelection(params: {
  domElement: HTMLElement;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  camera: ViewCamera;
  sceneRoot: THREE.Group;
  hiddenEntityKeys: Set<ModelEntityKey>;
  clippingPlanes: THREE.Plane[];
  additive: boolean;
  onBoxSelect?: (results: BoxSelectionResult[], additive: boolean) => void;
}) {
  const {
    domElement,
    startX,
    startY,
    endX,
    endY,
    camera,
    sceneRoot,
    hiddenEntityKeys,
    clippingPlanes,
    additive,
    onBoxSelect,
  } = params;

  const selectionQuery = createBoxSelectionQuery(
    domElement,
    startX,
    startY,
    endX,
    endY,
  );
  const results = pickEntitiesInBox(
    selectionQuery.selMinX,
    selectionQuery.selMinY,
    selectionQuery.selMaxX,
    selectionQuery.selMaxY,
    selectionQuery.mode,
    camera,
    sceneRoot,
    hiddenEntityKeys,
    clippingPlanes,
  );
  onBoxSelect?.(results, additive);
  return results;
}

export function getViewportWheelThrottleMs(meshCount: number) {
  if (meshCount > 50000) {
    return 40;
  }
  if (meshCount > 10000) {
    return 25;
  }
  return 16;
}
