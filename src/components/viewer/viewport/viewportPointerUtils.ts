import * as THREE from "three";

export interface BoxSelectionQuery {
  selMinX: number;
  selMinY: number;
  selMaxX: number;
  selMaxY: number;
  mode: "window" | "crossing";
}

export function updatePointerFromClientPosition(
  domElement: HTMLElement,
  target: THREE.Vector2,
  clientX: number,
  clientY: number,
) {
  const rect = domElement.getBoundingClientRect();
  target.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  target.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  return target;
}

export function isPointInsideViewport(
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
) {
  const rect = domElement.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

export function createBoxSelectionQuery(
  domElement: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): BoxSelectionQuery {
  const rect = domElement.getBoundingClientRect();
  const toNdcX = (px: number) => ((px - rect.left) / rect.width) * 2 - 1;
  const toNdcY = (py: number) => -((py - rect.top) / rect.height) * 2 + 1;

  const ndcX1 = toNdcX(startX);
  const ndcY1 = toNdcY(startY);
  const ndcX2 = toNdcX(endX);
  const ndcY2 = toNdcY(endY);

  return {
    selMinX: Math.min(ndcX1, ndcX2),
    selMinY: Math.min(ndcY1, ndcY2),
    selMaxX: Math.max(ndcX1, ndcX2),
    selMaxY: Math.max(ndcY1, ndcY2),
    mode: endX >= startX ? "window" : "crossing",
  };
}
