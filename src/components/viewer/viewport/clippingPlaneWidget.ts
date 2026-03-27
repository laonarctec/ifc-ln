import * as THREE from "three";
import type { ClippingPlaneObject } from "@/stores/slices/clippingSlice";
import {
  getPlaneQuaternion,
  type ResizeHandleType,
} from "./clippingMath";

export interface ClippingPlaneWidgetHandle {
  type: "plane-body" | ResizeHandleType;
  mesh: THREE.Mesh;
}

export interface ClippingPlaneWidgetVisual {
  planeId: string;
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  edgeLines: THREE.LineSegments;
  directionArrow: THREE.Mesh;
  handles: ClippingPlaneWidgetHandle[];
}

const HANDLE_TYPES: readonly ResizeHandleType[] = [
  "resize-n",
  "resize-s",
  "resize-e",
  "resize-w",
  "resize-ne",
  "resize-nw",
  "resize-se",
  "resize-sw",
];

function createWidgetMaterial(color: number, opacity: number) {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    clippingPlanes: [],
  });
}

function createHandleMesh(type: ResizeHandleType) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = createWidgetMaterial(0xf8fafc, 0.95);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.clippingHandleType = type;
  mesh.renderOrder = 914;
  return mesh;
}

function getLocalHandlePosition(
  halfWidth: number,
  halfHeight: number,
  type: ResizeHandleType,
) {
  let x = 0;
  let y = 0;

  if (type.includes("e")) x = halfWidth;
  if (type.includes("w")) x = -halfWidth;
  if (type.includes("n")) y = halfHeight;
  if (type.includes("s")) y = -halfHeight;

  return new THREE.Vector3(x, y, 0);
}

export function createPlaneWidget(planeId: string): ClippingPlaneWidgetVisual {
  const group = new THREE.Group();
  group.name = `clipping-plane-widget:${planeId}`;
  group.userData.clippingPlaneId = planeId;

  const bodyGeometry = new THREE.PlaneGeometry(1, 1);
  const bodyMesh = new THREE.Mesh(bodyGeometry, createWidgetMaterial(0x3b82f6, 0.14));
  bodyMesh.userData.clippingHandleType = "plane-body";
  bodyMesh.renderOrder = 910;
  group.add(bodyMesh);

  const edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(bodyGeometry),
    new THREE.LineBasicMaterial({
      color: 0x60a5fa,
      opacity: 0.6,
      transparent: true,
      depthTest: false,
      clippingPlanes: [],
    }),
  );
  edgeLines.renderOrder = 911;
  group.add(edgeLines);

  const directionArrowGeometry = new THREE.ConeGeometry(0.12, 0.28, 10);
  directionArrowGeometry.rotateX(Math.PI / 2);
  const directionArrow = new THREE.Mesh(
    directionArrowGeometry,
    createWidgetMaterial(0x93c5fd, 0.96),
  );
  directionArrow.renderOrder = 912;
  group.add(directionArrow);

  const handles: ClippingPlaneWidgetHandle[] = [
    { type: "plane-body", mesh: bodyMesh },
  ];

  for (const type of HANDLE_TYPES) {
    const mesh = createHandleMesh(type);
    group.add(mesh);
    handles.push({ type, mesh });
  }

  return {
    planeId,
    group,
    bodyMesh,
    edgeLines,
    directionArrow,
    handles,
  };
}

export function updatePlaneWidget(
  visual: ClippingPlaneWidgetVisual,
  plane: ClippingPlaneObject,
  options: {
    selected: boolean;
    interactive: boolean;
    scale: number;
  },
) {
  const quaternion = getPlaneQuaternion(plane);
  const halfWidth = plane.width * 0.5;
  const halfHeight = plane.height * 0.5;
  const normalSign = plane.flipped ? -1 : 1;
  const bodyMaterial = visual.bodyMesh.material as THREE.MeshBasicMaterial;
  const edgeMaterial = visual.edgeLines.material as THREE.LineBasicMaterial;
  const arrowMaterial = visual.directionArrow.material as THREE.MeshBasicMaterial;

  visual.group.position.set(...plane.origin);
  visual.group.quaternion.copy(quaternion);
  visual.group.visible = plane.enabled;

  visual.bodyMesh.scale.set(plane.width, plane.height, 1);
  visual.edgeLines.scale.set(plane.width, plane.height, 1);
  visual.directionArrow.position.set(0, 0, normalSign * Math.max(options.scale * 0.12, 0.08));
  visual.directionArrow.scale.setScalar(Math.max(options.scale * 0.35, 0.25));

  bodyMaterial.color.set(options.selected ? 0x2563eb : 0x3b82f6);
  bodyMaterial.opacity = options.selected ? 0.22 : 0.14;
  edgeMaterial.color.set(options.selected ? 0x1d4ed8 : 0x60a5fa);
  edgeMaterial.opacity = options.selected ? 0.9 : 0.6;
  arrowMaterial.color.set(options.selected ? 0x1d4ed8 : 0x93c5fd);

  const handleSize = Math.max(options.scale * 0.06, 0.08);
  for (const handle of visual.handles) {
    if (handle.type === "plane-body") {
      handle.mesh.userData.clippingPlaneId = plane.id;
      handle.mesh.userData.clippingLocked = plane.locked;
      continue;
    }

    handle.mesh.visible = options.selected && options.interactive && !plane.locked;
    handle.mesh.scale.setScalar(handleSize);
    handle.mesh.position.copy(getLocalHandlePosition(halfWidth, halfHeight, handle.type));
    handle.mesh.userData.clippingPlaneId = plane.id;
    handle.mesh.userData.clippingLocked = plane.locked;
  }

  visual.bodyMesh.userData.clippingPlaneId = plane.id;
  visual.bodyMesh.userData.clippingLocked = plane.locked;
  visual.group.userData.clippingPlaneId = plane.id;
  visual.group.userData.clippingLocked = plane.locked;
}

export function disposePlaneWidget(visual: ClippingPlaneWidgetVisual) {
  visual.group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      if (child.material instanceof THREE.Material) {
        child.material.dispose();
      }
    }
  });
}
