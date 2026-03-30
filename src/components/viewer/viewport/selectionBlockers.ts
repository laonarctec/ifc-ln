import * as THREE from "three";

const SELECTION_BLOCKER_KEY = "selectionBlocker";

export function markSelectionBlocked<T extends THREE.Object3D>(object: T): T {
  object.userData[SELECTION_BLOCKER_KEY] = true;
  return object;
}

export function isSelectionBlocked(object: THREE.Object3D | null) {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData[SELECTION_BLOCKER_KEY] === true) {
      return true;
    }
    current = current.parent;
  }
  return false;
}
