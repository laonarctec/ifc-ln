import * as THREE from "three";
import { markSelectionBlocked } from "./selectionBlockers";
import {
  buildSectionFillGeometry,
  offsetSectionFillPositions,
} from "./sectionFillBuilder";
import type { SectionClosedLoop } from "./sectionEdgeBuilder";

export interface SectionPlaneVisualGroupOptions {
  planeId: string;
  edgePositions: number[];
  closedLoops: SectionClosedLoop[];
  normal: THREE.Vector3;
  clippingPlanes: THREE.Plane[];
  edgeColor: THREE.ColorRepresentation;
  edgeOffset: number;
}

export function disposeObjectTree(object: THREE.Object3D) {
  object.traverse((node) => {
    const disposable = node as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    disposable.geometry?.dispose();
    if (Array.isArray(disposable.material)) {
      disposable.material.forEach((material) => material.dispose());
    } else {
      disposable.material?.dispose();
    }
  });
}

function createSectionFillMesh(
  positions: number[],
  normal: THREE.Vector3,
  clippingPlanes: THREE.Plane[],
) {
  const fillGeometry = new THREE.BufferGeometry();
  fillGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );

  const fillNormal = normal.clone().normalize();
  const normals = new Float32Array(positions.length);
  for (let index = 0; index < positions.length; index += 3) {
    normals[index] = fillNormal.x;
    normals[index + 1] = fillNormal.y;
    normals[index + 2] = fillNormal.z;
  }
  fillGeometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normals, 3),
  );

  const fillMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#94a3b8"),
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    clippingPlanes,
    toneMapped: false,
  });

  const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
  fillMesh.renderOrder = 7;
  return fillMesh;
}

function createSectionBlockerMesh(
  positions: number[],
  normal: THREE.Vector3,
  clippingPlanes: THREE.Plane[],
  offsetDistance: number,
) {
  const blockerPositions = offsetSectionFillPositions(
    positions,
    normal,
    offsetDistance,
  );
  const blockerGeometry = new THREE.BufferGeometry();
  blockerGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(blockerPositions, 3),
  );

  const blockerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    clippingPlanes,
    toneMapped: false,
  });

  const blockerMesh = markSelectionBlocked(
    new THREE.Mesh(blockerGeometry, blockerMaterial),
  );
  blockerMesh.renderOrder = 6;
  return blockerMesh;
}

export function createSectionPlaneVisualGroup({
  planeId,
  edgePositions,
  closedLoops,
  normal,
  clippingPlanes,
  edgeColor,
  edgeOffset,
}: SectionPlaneVisualGroupOptions) {
  const planeGroup = new THREE.Group();
  planeGroup.name = `clipping-section-edge:${planeId}`;
  planeGroup.userData.planeId = planeId;

  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(edgePositions, 3),
  );

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: edgeColor,
    transparent: true,
    opacity: 0.96,
    depthTest: true,
    depthWrite: false,
    clippingPlanes,
    toneMapped: false,
  });

  const lineSegments = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  lineSegments.renderOrder = 8;
  planeGroup.add(lineSegments);

  if (closedLoops.length === 0) {
    return planeGroup;
  }

  const fillPositions = buildSectionFillGeometry(closedLoops, normal);
  if (fillPositions.length === 0) {
    return planeGroup;
  }

  const fillShift = edgeOffset * 2;
  planeGroup.add(
    createSectionFillMesh(fillPositions, normal, clippingPlanes),
  );
  planeGroup.add(
    createSectionBlockerMesh(fillPositions, normal, clippingPlanes, -fillShift),
  );
  planeGroup.add(
    createSectionFillMesh(
      offsetSectionFillPositions(fillPositions, normal, fillShift),
      normal,
      clippingPlanes,
    ),
  );

  return planeGroup;
}
