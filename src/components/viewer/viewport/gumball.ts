import * as THREE from "three";
import type { ViewCamera } from "./cameraMath";
import { markSelectionBlocked } from "./selectionBlockers";

export type GumballHandleType =
  | "translate-x"
  | "translate-y"
  | "translate-normal"
  | "translate-plane-xy"
  | "translate-plane-yz"
  | "translate-plane-zx"
  | "translate-center"
  | "rotate-x"
  | "rotate-y"
  | "rotate-z"
  | "resize-x"
  | "resize-y"
  | "resize-xy"
  | "resize-yz"
  | "resize-zx";

export type GumballHandleKind =
  | "translate-axis"
  | "translate-plane"
  | "translate-center"
  | "rotate"
  | "resize";

type GumballTintMaterial = THREE.MeshBasicMaterial | THREE.LineBasicMaterial;

export interface GumballHandle {
  type: GumballHandleType;
  kind: GumballHandleKind;
  root: THREE.Object3D;
  pickTarget: THREE.Object3D;
  axis?: THREE.Vector3;
  planeAxes?: [THREE.Vector3, THREE.Vector3];
  color: THREE.Color;
  highlightColor: THREE.Color;
  priority: number;
  cursor: string;
  materials: GumballTintMaterial[];
  baseOpacity: number;
  mutedOpacity: number;
  activeOpacity: number;
}

export interface GumballComponents {
  group: THREE.Group;
  handles: GumballHandle[];
  handlesByType: Map<GumballHandleType, GumballHandle>;
  hitTargets: THREE.Object3D[];
  centerDot: THREE.Object3D;
  guideGroup: THREE.Group;
  previewGroup: THREE.Group;
  baseScale: number;
}

const AXIS_COLORS: Record<string, { base: THREE.Color; highlight: THREE.Color }> = {
  x: { base: new THREE.Color(0xff3030), highlight: new THREE.Color(0xff8c8c) },
  y: { base: new THREE.Color(0x1fe243), highlight: new THREE.Color(0x88ff9d) },
  z: { base: new THREE.Color(0x2947ff), highlight: new THREE.Color(0x8a98ff) },
  xy: { base: new THREE.Color(0xffb02e), highlight: new THREE.Color(0xffd075) },
  yz: { base: new THREE.Color(0x2bd4ff), highlight: new THREE.Color(0x8feaff) },
  zx: { base: new THREE.Color(0xff6d5a), highlight: new THREE.Color(0xffaa9c) },
  center: { base: new THREE.Color(0xffffff), highlight: new THREE.Color(0xcfe4ff) },
  resize: { base: new THREE.Color(0xf8fafc), highlight: new THREE.Color(0xcfe4ff) },
};
const CENTER_RING_OUTER = 0x1f1720;
const CENTER_RING_INNER = 0xffffff;
const CENTER_RING_DOT = 0x20181f;
const DECORATION_WHITE = 0xfafafa;
const DECORATION_DASH = 0xd9d9d9;
const GUMBALL_VIEWPORT_FRACTION = 0.36;
const MIN_GUMBALL_SCREEN_PIXELS = 192;
const MAX_GUMBALL_SCREEN_PIXELS = 312;

function createHandleMaterial(color: THREE.Color, opacity = 0.94): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: color.clone(),
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity,
    clippingPlanes: [],
    side: THREE.DoubleSide,
  });
}

function createLineMaterial(color: THREE.Color, opacity = 0.94): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: color.clone(),
    depthTest: false,
    transparent: true,
    opacity,
    clippingPlanes: [],
  });
}

function createPickMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    clippingPlanes: [],
  });
}

function applyHandleTag(object: THREE.Object3D, type: GumballHandleType): void {
  object.userData.gumballHandleType = type;
  object.traverse((child) => {
    child.userData.gumballHandleType = type;
  });
}

function createArrowVisual(
  axis: THREE.Vector3,
  color: THREE.Color,
  scale: number,
): { visual: THREE.Mesh; pickTarget: THREE.Mesh } {
  const shaftRadius = scale * 0.0035;
  const shaftLength = scale * 0.24;
  const tipRadius = scale * 0.017;
  const tipLength = scale * 0.05;
  const gripRadius = scale * 0.015;
  const gripOffset = scale * 0.1;

  const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 10);
  shaftGeo.translate(0, shaftLength / 2, 0);

  const tipGeo = new THREE.ConeGeometry(tipRadius, tipLength, 10);
  tipGeo.translate(0, shaftLength + tipLength / 2, 0);

  const gripGeo = new THREE.SphereGeometry(gripRadius, 16, 12);
  gripGeo.translate(0, gripOffset, 0);

  const merged = mergeGeometries([shaftGeo, tipGeo, gripGeo]);
  shaftGeo.dispose();
  tipGeo.dispose();
  gripGeo.dispose();

  const visual = new THREE.Mesh(merged, createHandleMaterial(color));
  alignToAxis(visual, axis);
  visual.renderOrder = 2000;

  const pickGeometry = new THREE.CylinderGeometry(scale * 0.022, scale * 0.026, scale * 0.34, 12);
  pickGeometry.translate(0, scale * 0.17, 0);
  const pickTarget = new THREE.Mesh(pickGeometry, createPickMaterial());
  alignToAxis(pickTarget, axis);
  pickTarget.renderOrder = 2005;

  return { visual, pickTarget };
}

function createRotationVisual(
  axis: THREE.Vector3,
  color: THREE.Color,
  scale: number,
  spin: number,
): { visual: THREE.Mesh; pickTarget: THREE.Mesh } {
  const radius = scale * 0.205;
  const tube = scale * 0.0045;
  const visualGeometry = new THREE.TorusGeometry(radius, tube, 12, 72, Math.PI * 0.88);
  visualGeometry.rotateZ(spin);

  const visual = new THREE.Mesh(visualGeometry, createHandleMaterial(color, 0.9));
  alignTorusToAxis(visual, axis);
  visual.renderOrder = 1999;

  const pickGeometry = new THREE.TorusGeometry(radius, scale * 0.03, 10, 48, Math.PI * 0.94);
  pickGeometry.rotateZ(spin);
  const pickTarget = new THREE.Mesh(pickGeometry, createPickMaterial());
  alignTorusToAxis(pickTarget, axis);
  pickTarget.renderOrder = 2004;

  return { visual, pickTarget };
}

function createCenterDot(scale: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "gumball-center";

  const outerGeo = new THREE.CircleGeometry(scale * 0.017, 24);
  const outerMat = new THREE.MeshBasicMaterial({
    color: CENTER_RING_OUTER,
    depthTest: false,
    depthWrite: false,
    clippingPlanes: [],
  });
  const outer = new THREE.Mesh(outerGeo, outerMat);
  outer.renderOrder = 2001;
  group.add(outer);

  const innerGeo = new THREE.CircleGeometry(scale * 0.0115, 24);
  const innerMat = new THREE.MeshBasicMaterial({
    color: CENTER_RING_INNER,
    depthTest: false,
    depthWrite: false,
    clippingPlanes: [],
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.position.z = 0.0004;
  inner.renderOrder = 2002;
  group.add(inner);

  const dotGeo = new THREE.CircleGeometry(scale * 0.0035, 18);
  const dotMat = new THREE.MeshBasicMaterial({
    color: CENTER_RING_DOT,
    depthTest: false,
    depthWrite: false,
    clippingPlanes: [],
  });
  const dot = new THREE.Mesh(dotGeo, dotMat);
  dot.position.z = 0.0008;
  dot.renderOrder = 2003;
  group.add(dot);

  return group;
}

function createCenterTranslateHandle(scale: number): { root: THREE.Group; pickTarget: THREE.Mesh; materials: GumballTintMaterial[] } {
  const root = new THREE.Group();
  root.name = "gumball-center-translate";

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(scale * 0.02, scale * 0.028, 28),
    createHandleMaterial(AXIS_COLORS.center.base, 0.95),
  );
  ring.position.z = 0.0014;
  ring.renderOrder = 2004;
  root.add(ring);

  const pickTarget = new THREE.Mesh(
    new THREE.SphereGeometry(scale * 0.036, 18, 18),
    createPickMaterial(),
  );
  root.add(pickTarget);

  return { root, pickTarget, materials: [ring.material as THREE.MeshBasicMaterial] };
}

function createPlaneGlyph(scale: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "gumball-plane-glyph";
  group.position.set(-scale * 0.17, scale * 0.17, 0);

  const bluePoints = [
    new THREE.Vector3(-0.03, -0.03, 0),
    new THREE.Vector3(0.03, -0.03, 0),
    new THREE.Vector3(0.03, 0.03, 0),
    new THREE.Vector3(-0.03, 0.03, 0),
    new THREE.Vector3(-0.03, -0.03, 0),
    new THREE.Vector3(0, -0.03, 0),
    new THREE.Vector3(0, 0.03, 0),
  ];
  const blueGeometry = new THREE.BufferGeometry().setFromPoints(bluePoints);
  const blueLine = new THREE.Line(
    blueGeometry,
    new THREE.LineBasicMaterial({
      color: AXIS_COLORS.z.base,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
      clippingPlanes: [],
    }),
  );
  blueLine.scale.setScalar(scale);
  blueLine.renderOrder = 1997;
  group.add(blueLine);

  const redSegments = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.03, 0, 0),
    new THREE.Vector3(0.03, 0, 0),
    new THREE.Vector3(-0.03, -0.03, 0),
    new THREE.Vector3(0.03, 0.03, 0),
  ]);
  const redLine = new THREE.LineSegments(
    redSegments,
    new THREE.LineBasicMaterial({
      color: AXIS_COLORS.x.base,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
      clippingPlanes: [],
    }),
  );
  redLine.scale.setScalar(scale);
  redLine.renderOrder = 1998;
  group.add(redLine);

  return group;
}

function createReferenceGuide(scale: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "gumball-reference-guide";

  const guideTarget = new THREE.Vector3(scale * 0.13, -scale * 0.07, 0);
  const guideGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    guideTarget,
  ]);
  const guideMaterial = new THREE.LineDashedMaterial({
    color: DECORATION_DASH,
    transparent: true,
    opacity: 0.9,
    dashSize: scale * 0.012,
    gapSize: scale * 0.014,
    depthTest: false,
    clippingPlanes: [],
  });
  const guideLine = new THREE.Line(guideGeometry, guideMaterial);
  guideLine.computeLineDistances();
  guideLine.renderOrder = 1996;
  group.add(guideLine);

  const ringGeometry = new THREE.RingGeometry(scale * 0.012, scale * 0.016, 24);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: DECORATION_WHITE,
    depthTest: false,
    transparent: true,
    opacity: 0.96,
    clippingPlanes: [],
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.copy(guideTarget);
  ring.position.z = 0.0008;
  ring.renderOrder = 2002;
  group.add(ring);

  return group;
}

function createPlanarHandle(
  color: THREE.Color,
  scale: number,
  axisA: THREE.Vector3,
  axisB: THREE.Vector3,
  offset: THREE.Vector3,
): { root: THREE.Group; pickTarget: THREE.Mesh; materials: GumballTintMaterial[] } {
  const root = new THREE.Group();
  root.position.copy(offset);
  root.quaternion.copy(getBasisQuaternion(axisA, axisB));

  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(scale * 0.068, scale * 0.068),
    createHandleMaterial(color, 0.24),
  );
  patch.renderOrder = 1995;
  root.add(patch);

  const outlinePoints = [
    new THREE.Vector3(-0.034, -0.034, 0),
    new THREE.Vector3(0.034, -0.034, 0),
    new THREE.Vector3(0.034, 0.034, 0),
    new THREE.Vector3(-0.034, 0.034, 0),
    new THREE.Vector3(-0.034, -0.034, 0),
  ].map((point) => point.multiplyScalar(scale));
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(outlinePoints),
    createLineMaterial(color, 0.98),
  );
  outline.renderOrder = 1996;
  root.add(outline);

  const pickTarget = new THREE.Mesh(
    new THREE.PlaneGeometry(scale * 0.1, scale * 0.1),
    createPickMaterial(),
  );
  pickTarget.position.z = 0.001;
  root.add(pickTarget);

  return {
    root,
    pickTarget,
    materials: [
      patch.material as THREE.MeshBasicMaterial,
      outline.material as THREE.LineBasicMaterial,
    ],
  };
}

function createResizeHandle(
  type: "resize-x" | "resize-y" | "resize-xy",
  scale: number,
): { root: THREE.Group; pickTarget: THREE.Mesh; materials: GumballTintMaterial[] } {
  const root = new THREE.Group();
  const material = createHandleMaterial(AXIS_COLORS.resize.base, 0.92);
  const outlineMaterial = createLineMaterial(AXIS_COLORS.resize.base, 1);
  let pickTarget: THREE.Mesh;

  if (type === "resize-x") {
    root.position.set(scale * 0.15, 0, 0);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(scale * 0.026, scale * 0.06, scale * 0.008),
      material,
    );
    mesh.renderOrder = 2000;
    root.add(mesh);
    pickTarget = new THREE.Mesh(
      new THREE.BoxGeometry(scale * 0.06, scale * 0.09, scale * 0.04),
      createPickMaterial(),
    );
    root.add(pickTarget);
  } else if (type === "resize-y") {
    root.position.set(0, scale * 0.15, 0);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(scale * 0.06, scale * 0.026, scale * 0.008),
      material,
    );
    mesh.renderOrder = 2000;
    root.add(mesh);
    pickTarget = new THREE.Mesh(
      new THREE.BoxGeometry(scale * 0.09, scale * 0.06, scale * 0.04),
      createPickMaterial(),
    );
    root.add(pickTarget);
  } else {
    root.position.set(scale * 0.145, scale * 0.145, 0);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(scale * 0.032, scale * 0.032, scale * 0.01),
      material,
    );
    mesh.renderOrder = 2000;
    root.add(mesh);

    const corner = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(scale * 0.04, scale * 0.04)),
      outlineMaterial,
    );
    corner.renderOrder = 2001;
    root.add(corner);

    pickTarget = new THREE.Mesh(
      new THREE.BoxGeometry(scale * 0.075, scale * 0.075, scale * 0.04),
      createPickMaterial(),
    );
    root.add(pickTarget);

    return {
      root,
      pickTarget,
      materials: [material, outlineMaterial],
    };
  }

  return {
    root,
    pickTarget,
    materials: [material],
  };
}

function alignToAxis(object: THREE.Object3D, axis: THREE.Vector3): void {
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(axis.dot(up)) > 0.999) {
    object.quaternion.identity();
    if (axis.y < 0) object.rotateX(Math.PI);
  } else {
    const q = new THREE.Quaternion().setFromUnitVectors(up, axis.clone().normalize());
    object.quaternion.copy(q);
  }
}

function alignTorusToAxis(object: THREE.Object3D, axis: THREE.Vector3): void {
  const torusNormal = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(torusNormal, axis.clone().normalize());
  object.quaternion.copy(q);
}

function getBasisQuaternion(axisA: THREE.Vector3, axisB: THREE.Vector3): THREE.Quaternion {
  const xAxis = axisA.clone().normalize();
  const yAxis = axisB.clone().normalize();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
  const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

function mergeGeometries(
  geometries: THREE.BufferGeometry[],
): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const positionCount = geometries.reduce(
    (sum, geometry) => sum + (geometry.getAttribute("position") as THREE.BufferAttribute).count,
    0,
  );
  const positions = new Float32Array(positionCount * 3);
  const normals = new Float32Array(positionCount * 3);
  let positionOffset = 0;
  let normalOffset = 0;

  for (const geometry of geometries) {
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    positions.set(position.array as Float32Array, positionOffset);
    positionOffset += position.count * 3;

    const normal = geometry.getAttribute("normal") as THREE.BufferAttribute | null;
    if (normal) {
      normals.set(normal.array as Float32Array, normalOffset);
    }
    normalOffset += position.count * 3;
  }

  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

  const indexCount = geometries.reduce((sum, geometry) => sum + (geometry.getIndex()?.count ?? 0), 0);
  if (indexCount > 0) {
    const indices = new Uint32Array(indexCount);
    let indexOffset = 0;
    let vertexOffset = 0;

    for (const geometry of geometries) {
      const index = geometry.getIndex();
      const position = geometry.getAttribute("position") as THREE.BufferAttribute;
      if (index) {
        for (let i = 0; i < index.count; i++) {
          indices[indexOffset + i] = Number(index.array[i]) + vertexOffset;
        }
        indexOffset += index.count;
      }
      vertexOffset += position.count;
    }

    merged.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  return merged;
}

function styleHandle(
  handle: GumballHandle,
  mode: "idle" | "hovered" | "active" | "muted",
): void {
  const color =
    mode === "hovered" || mode === "active" ? handle.highlightColor : handle.color;
  const opacity =
    mode === "active"
      ? handle.activeOpacity
      : mode === "hovered"
        ? Math.min(handle.activeOpacity, 1)
        : mode === "muted"
          ? handle.mutedOpacity
          : handle.baseOpacity;

  handle.materials.forEach((material) => {
    material.color.copy(color);
    material.opacity = opacity;
    material.needsUpdate = true;
  });
}

function disposePreviewChild(child: THREE.Object3D): void {
  child.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.LineSegments) {
      node.geometry.dispose();
      if (Array.isArray(node.material)) {
        node.material.forEach((material) => material.dispose());
      } else {
        node.material.dispose();
      }
    }
  });
}

function clampPreviewOffset(gumball: GumballComponents, offset: number) {
  if (Math.abs(offset) < 1e-4) {
    return 0;
  }
  return THREE.MathUtils.clamp(offset, -0.48, 0.48) * gumball.baseScale;
}

export function applyGumballHandleState(
  gumball: GumballComponents,
  hoveredType: GumballHandleType | null,
  activeType: GumballHandleType | null,
): void {
  const hasFocus = hoveredType !== null || activeType !== null;
  gumball.handles.forEach((handle) => {
    const mode =
      activeType === handle.type
        ? "active"
        : hoveredType === handle.type
          ? "hovered"
          : hasFocus
            ? "muted"
            : "idle";
    styleHandle(handle, mode);
  });
}

export function highlightHandle(handle: GumballHandle, highlighted: boolean): void {
  styleHandle(handle, highlighted ? "hovered" : "idle");
}

export function clearGumballPreview(gumball: GumballComponents): void {
  gumball.previewGroup.children.slice().forEach((child) => {
    gumball.previewGroup.remove(child);
    disposePreviewChild(child);
  });
}

export function showAxisTranslationPreview(
  gumball: GumballComponents,
  axis: THREE.Vector3,
  localOffset: number,
  color: THREE.Color,
): void {
  clearGumballPreview(gumball);
  const clampedOffset = clampPreviewOffset(gumball, localOffset);
  if (Math.abs(clampedOffset) <= 1e-4) {
    return;
  }

  const end = axis.clone().normalize().multiplyScalar(clampedOffset);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), end]),
    createLineMaterial(color, 1),
  );
  line.renderOrder = 2008;
  gumball.previewGroup.add(line);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(gumball.baseScale * 0.013, 14, 12),
    createHandleMaterial(color, 0.92),
  );
  marker.position.copy(end);
  marker.renderOrder = 2009;
  gumball.previewGroup.add(marker);
}

export function showPlaneTranslationPreview(
  gumball: GumballComponents,
  axisA: THREE.Vector3,
  axisB: THREE.Vector3,
  localOffsetA: number,
  localOffsetB: number,
  color: THREE.Color,
): void {
  clearGumballPreview(gumball);
  const offsetA = clampPreviewOffset(gumball, localOffsetA);
  const offsetB = clampPreviewOffset(gumball, localOffsetB);
  if (Math.abs(offsetA) <= 1e-4 && Math.abs(offsetB) <= 1e-4) {
    return;
  }

  const halfA = axisA.clone().normalize().multiplyScalar(offsetA * 0.5);
  const halfB = axisB.clone().normalize().multiplyScalar(offsetB * 0.5);
  const center = halfA.clone().add(halfB);
  const width = Math.max(Math.abs(offsetA), 0.04);
  const height = Math.max(Math.abs(offsetB), 0.04);

  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    createHandleMaterial(color, 0.18),
  );
  patch.position.copy(center);
  patch.quaternion.copy(getBasisQuaternion(axisA, axisB));
  patch.renderOrder = 2007;
  gumball.previewGroup.add(patch);

  const corners = [
    halfA.clone().negate().add(halfB.clone().negate()).add(center),
    halfA.clone().add(halfB.clone().negate()).add(center),
    halfA.clone().add(halfB).add(center),
    halfA.clone().negate().add(halfB).add(center),
    halfA.clone().negate().add(halfB.clone().negate()).add(center),
  ];
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(corners),
    createLineMaterial(color, 1),
  );
  outline.renderOrder = 2008;
  gumball.previewGroup.add(outline);
}

export function showRotationPreview(
  gumball: GumballComponents,
  axis: THREE.Vector3,
  angle: number,
  color: THREE.Color,
): void {
  clearGumballPreview(gumball);
  const arcAngle = THREE.MathUtils.clamp(angle, -Math.PI * 1.7, Math.PI * 1.7);
  if (Math.abs(arcAngle) <= 1e-4) {
    return;
  }

  const normal = axis.clone().normalize();
  const tangent = Math.abs(normal.z) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), normal).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  const radius = gumball.baseScale * 0.205;
  const steps = 40;
  const points: THREE.Vector3[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = (arcAngle * index) / steps;
    points.push(
      tangent
        .clone()
        .multiplyScalar(Math.cos(t) * radius)
        .add(bitangent.clone().multiplyScalar(Math.sin(t) * radius)),
    );
  }

  const arc = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    createLineMaterial(color, 1),
  );
  arc.renderOrder = 2008;
  gumball.previewGroup.add(arc);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(gumball.baseScale * 0.012, 12, 10),
    createHandleMaterial(color, 0.92),
  );
  marker.position.copy(points[points.length - 1] ?? new THREE.Vector3());
  marker.renderOrder = 2009;
  gumball.previewGroup.add(marker);
}

export function showResizePreview(
  gumball: GumballComponents,
  widthRatio: number,
  heightRatio: number,
  color: THREE.Color,
): void {
  clearGumballPreview(gumball);
  const halfWidth = THREE.MathUtils.clamp(0.09 * widthRatio, 0.06, 0.32);
  const halfHeight = THREE.MathUtils.clamp(0.09 * heightRatio, 0.06, 0.32);
  const points = [
    new THREE.Vector3(-halfWidth, -halfHeight, 0),
    new THREE.Vector3(halfWidth, -halfHeight, 0),
    new THREE.Vector3(halfWidth, halfHeight, 0),
    new THREE.Vector3(-halfWidth, halfHeight, 0),
    new THREE.Vector3(-halfWidth, -halfHeight, 0),
  ].map((point) => point.multiplyScalar(gumball.baseScale));

  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    createLineMaterial(color, 1),
  );
  outline.renderOrder = 2008;
  gumball.previewGroup.add(outline);
}

/** Create a Rhino-style gumball manipulator for clipping planes. */
export function createGumball(scale: number): GumballComponents {
  const group = markSelectionBlocked(new THREE.Group());
  group.name = "clipping-gumball";
  const handles: GumballHandle[] = [];
  const handlesByType = new Map<GumballHandleType, GumballHandle>();
  const hitTargets: THREE.Object3D[] = [];

  const centerDot = createCenterDot(scale);
  group.add(centerDot);
  const guideGroup = createReferenceGuide(scale);
  group.add(createPlaneGlyph(scale));
  group.add(guideGroup);

  const previewGroup = new THREE.Group();
  previewGroup.name = "gumball-preview";
  group.add(previewGroup);

  const registerHandle = (handle: GumballHandle) => {
    applyHandleTag(handle.root, handle.type);
    applyHandleTag(handle.pickTarget, handle.type);
    group.add(handle.root);
    handles.push(handle);
    handlesByType.set(handle.type, handle);
    hitTargets.push(handle.pickTarget);
  };

  const axisHandles: Array<{
    type: GumballHandleType;
    axis: THREE.Vector3;
    colorKey: "x" | "y" | "z";
    priority: number;
  }> = [
    { type: "translate-x", axis: new THREE.Vector3(1, 0, 0), colorKey: "x", priority: 3 },
    { type: "translate-y", axis: new THREE.Vector3(0, 1, 0), colorKey: "y", priority: 3 },
    { type: "translate-normal", axis: new THREE.Vector3(0, 0, 1), colorKey: "z", priority: 3 },
  ];

  axisHandles.forEach(({ type, axis, colorKey, priority }) => {
    const colors = AXIS_COLORS[colorKey];
    const { visual, pickTarget } = createArrowVisual(axis, colors.base, scale);
    const root = new THREE.Group();
    root.add(visual);
    root.add(pickTarget);
    registerHandle({
      type,
      kind: "translate-axis",
      root,
      pickTarget,
      axis: axis.clone(),
      color: colors.base,
      highlightColor: colors.highlight,
      priority,
      cursor: "grab",
      materials: [visual.material as THREE.MeshBasicMaterial],
      baseOpacity: 0.94,
      mutedOpacity: 0.28,
      activeOpacity: 1,
    });
  });

  const planeHandles: Array<{
    type: GumballHandleType;
    axisA: THREE.Vector3;
    axisB: THREE.Vector3;
    colorKey: "xy" | "yz" | "zx";
    offset: THREE.Vector3;
  }> = [
    {
      type: "translate-plane-xy",
      axisA: new THREE.Vector3(1, 0, 0),
      axisB: new THREE.Vector3(0, 1, 0),
      colorKey: "xy",
      offset: new THREE.Vector3(scale * 0.083, scale * 0.083, 0),
    },
    {
      type: "translate-plane-yz",
      axisA: new THREE.Vector3(0, 1, 0),
      axisB: new THREE.Vector3(0, 0, 1),
      colorKey: "yz",
      offset: new THREE.Vector3(0, scale * 0.082, scale * 0.082),
    },
    {
      type: "translate-plane-zx",
      axisA: new THREE.Vector3(0, 0, 1),
      axisB: new THREE.Vector3(1, 0, 0),
      colorKey: "zx",
      offset: new THREE.Vector3(scale * 0.082, 0, scale * 0.082),
    },
  ];

  planeHandles.forEach(({ type, axisA, axisB, colorKey, offset }) => {
    const colors = AXIS_COLORS[colorKey];
    const { root, pickTarget, materials } = createPlanarHandle(
      colors.base,
      scale,
      axisA,
      axisB,
      offset,
    );
    registerHandle({
      type,
      kind: "translate-plane",
      root,
      pickTarget,
      planeAxes: [axisA.clone(), axisB.clone()],
      color: colors.base,
      highlightColor: colors.highlight,
      priority: 2,
      cursor: "grab",
      materials,
      baseOpacity: 0.92,
      mutedOpacity: 0.24,
      activeOpacity: 1,
    });
  });

  const centerHandleVisual = createCenterTranslateHandle(scale);
  registerHandle({
    type: "translate-center",
    kind: "translate-center",
    root: centerHandleVisual.root,
    pickTarget: centerHandleVisual.pickTarget,
    color: AXIS_COLORS.center.base,
    highlightColor: AXIS_COLORS.center.highlight,
    priority: 1,
    cursor: "grab",
    materials: centerHandleVisual.materials,
    baseOpacity: 0.95,
    mutedOpacity: 0.3,
    activeOpacity: 1,
  });

  const rotationHandles: Array<{
    type: GumballHandleType;
    axis: THREE.Vector3;
    colorKey: "x" | "y" | "z";
    spin: number;
  }> = [
    { type: "rotate-x", axis: new THREE.Vector3(1, 0, 0), colorKey: "x", spin: -Math.PI * 0.6 },
    { type: "rotate-y", axis: new THREE.Vector3(0, 1, 0), colorKey: "y", spin: -Math.PI * 0.52 },
    { type: "rotate-z", axis: new THREE.Vector3(0, 0, 1), colorKey: "z", spin: -Math.PI * 0.35 },
  ];

  rotationHandles.forEach(({ type, axis, colorKey, spin }) => {
    const colors = AXIS_COLORS[colorKey];
    const { visual, pickTarget } = createRotationVisual(axis, colors.base, scale, spin);
    const root = new THREE.Group();
    root.add(visual);
    root.add(pickTarget);
    registerHandle({
      type,
      kind: "rotate",
      root,
      pickTarget,
      axis: axis.clone(),
      color: colors.base,
      highlightColor: colors.highlight,
      priority: 5,
      cursor: "alias",
      materials: [visual.material as THREE.MeshBasicMaterial],
      baseOpacity: 0.9,
      mutedOpacity: 0.2,
      activeOpacity: 1,
    });
  });

  (["resize-x", "resize-y", "resize-xy"] as const).forEach((type) => {
    const { root, pickTarget, materials } = createResizeHandle(type, scale);
    registerHandle({
      type,
      kind: "resize",
      root,
      pickTarget,
      axis:
        type === "resize-x"
          ? new THREE.Vector3(1, 0, 0)
          : type === "resize-y"
            ? new THREE.Vector3(0, 1, 0)
            : undefined,
      planeAxes: type === "resize-xy" ? [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)] : undefined,
      color: AXIS_COLORS.resize.base,
      highlightColor: AXIS_COLORS.resize.highlight,
      priority: 4,
      cursor: "nwse-resize",
      materials,
      baseOpacity: 0.92,
      mutedOpacity: 0.24,
      activeOpacity: 1,
    });
  });

  applyGumballHandleState(
    { group, handles, handlesByType, hitTargets, centerDot, guideGroup, previewGroup, baseScale: scale },
    null,
    null,
  );

  return {
    group,
    handles,
    handlesByType,
    hitTargets,
    centerDot,
    guideGroup,
    previewGroup,
    baseScale: scale,
  };
}

export function calculateGumballWorldScale(
  camera: ViewCamera,
  position: THREE.Vector3,
  viewportHeight: number,
) {
  const safeViewportHeight = Math.max(viewportHeight, 1);
  const targetPixels = THREE.MathUtils.clamp(
    safeViewportHeight * GUMBALL_VIEWPORT_FRACTION,
    MIN_GUMBALL_SCREEN_PIXELS,
    MAX_GUMBALL_SCREEN_PIXELS,
  );

  if (camera instanceof THREE.OrthographicCamera) {
    return (
      (targetPixels / safeViewportHeight) *
      ((camera.top - camera.bottom) / camera.zoom)
    );
  }

  camera.updateMatrixWorld();
  const cameraSpacePosition = position.clone().applyMatrix4(camera.matrixWorldInverse);
  const depth = Math.max(Math.abs(cameraSpacePosition.z), 0.0001);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  return (
    (targetPixels / safeViewportHeight) *
    (depth * Math.tan(fov / 2) * 2)
  );
}

export function getGumballCurrentWorldScale(gumball: GumballComponents): number {
  return Math.abs(gumball.group.scale.x) * gumball.baseScale;
}

/** Update gumball position and orientation. */
export function updateGumballTransform(
  gumball: GumballComponents,
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  scale: number,
): void {
  gumball.group.position.copy(position);
  gumball.group.quaternion.copy(quaternion);
  gumball.group.scale.setScalar(
    gumball.baseScale > 0 ? scale / gumball.baseScale : 1,
  );
}

/** Dispose all gumball geometries and materials. */
export function disposeGumball(gumball: GumballComponents): void {
  clearGumballPreview(gumball);
  gumball.group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
