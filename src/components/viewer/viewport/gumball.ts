import * as THREE from "three";

export type GumballHandleType =
  | "translate-x"
  | "translate-y"
  | "translate-normal"
  | "rotate-x"
  | "rotate-y"
  | "rotate-z";

export interface GumballHandle {
  type: GumballHandleType;
  mesh: THREE.Mesh;
  axis: THREE.Vector3;
  color: THREE.Color;
  highlightColor: THREE.Color;
}

export interface GumballComponents {
  group: THREE.Group;
  handles: GumballHandle[];
  centerDot: THREE.Mesh;
}

// --- Muted, refined color palette ---
const AXIS_COLORS: Record<string, { base: THREE.Color; highlight: THREE.Color }> = {
  x: { base: new THREE.Color(0xd95f5f), highlight: new THREE.Color(0xf28b8b) },
  y: { base: new THREE.Color(0x4daa6d), highlight: new THREE.Color(0x7dcea0) },
  z: { base: new THREE.Color(0x4a90c4), highlight: new THREE.Color(0x7fb8e0) },
  normal: { base: new THREE.Color(0xd4915c), highlight: new THREE.Color(0xf0b87a) },
};
const CENTER_COLOR = new THREE.Color(0xf0f0f0);

function createHandleMaterial(color: THREE.Color, opacity = 0.78): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: color.clone(),
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity,
    clippingPlanes: [],
  });
}

// --- Translate arrow: needle-thin tapered shaft + compact tip ---
function createArrow(
  axis: THREE.Vector3,
  color: THREE.Color,
  scale: number,
): THREE.Mesh {
  const shaftBaseRadius = scale * 0.004;
  const shaftTopRadius = scale * 0.002;
  const shaftLength = scale * 0.26;
  const tipRadius = scale * 0.012;
  const tipLength = scale * 0.04;

  const shaftGeo = new THREE.CylinderGeometry(shaftTopRadius, shaftBaseRadius, shaftLength, 8);
  shaftGeo.translate(0, shaftLength / 2, 0);

  const tipGeo = new THREE.ConeGeometry(tipRadius, tipLength, 10);
  tipGeo.translate(0, shaftLength + tipLength / 2, 0);

  const merged = mergeGeometries(shaftGeo, tipGeo);
  shaftGeo.dispose();
  tipGeo.dispose();

  const mesh = new THREE.Mesh(merged, createHandleMaterial(color));
  alignToAxis(mesh, axis);
  mesh.renderOrder = 2000;
  return mesh;
}

// --- Rotation arc: smooth torus with capped ends ---
function createRotationArc(
  axis: THREE.Vector3,
  color: THREE.Color,
  scale: number,
): THREE.Mesh {
  const radius = scale * 0.2;
  const tube = scale * 0.0025;
  const arc = Math.PI * 1.6;
  const geo = new THREE.TorusGeometry(radius, tube, 8, 80, arc);

  const mesh = new THREE.Mesh(geo, createHandleMaterial(color, 0.65));
  alignTorusToAxis(mesh, axis);
  mesh.renderOrder = 1999;
  return mesh;
}

// --- Center origin dot ---
function createCenterDot(scale: number): THREE.Mesh {
  const radius = scale * 0.012;
  const geo = new THREE.SphereGeometry(radius, 12, 10);
  const mat = new THREE.MeshBasicMaterial({
    color: CENTER_COLOR,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.92,
    clippingPlanes: [],
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2001;
  return mesh;
}

function alignToAxis(mesh: THREE.Mesh, axis: THREE.Vector3): void {
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(axis.dot(up)) > 0.999) {
    if (axis.y < 0) mesh.rotateX(Math.PI);
  } else {
    const q = new THREE.Quaternion().setFromUnitVectors(up, axis.clone().normalize());
    mesh.quaternion.copy(q);
  }
}

function alignTorusToAxis(mesh: THREE.Mesh, axis: THREE.Vector3): void {
  const torusNormal = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(torusNormal, axis.clone().normalize());
  mesh.quaternion.copy(q);
}

function mergeGeometries(
  a: THREE.BufferGeometry,
  b: THREE.BufferGeometry,
): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();

  const posA = a.getAttribute("position") as THREE.BufferAttribute;
  const posB = b.getAttribute("position") as THREE.BufferAttribute;
  const positions = new Float32Array(posA.count * 3 + posB.count * 3);
  positions.set(posA.array as Float32Array, 0);
  positions.set(posB.array as Float32Array, posA.count * 3);
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const normA = a.getAttribute("normal") as THREE.BufferAttribute | null;
  const normB = b.getAttribute("normal") as THREE.BufferAttribute | null;
  if (normA && normB) {
    const normals = new Float32Array(normA.count * 3 + normB.count * 3);
    normals.set(normA.array as Float32Array, 0);
    normals.set(normB.array as Float32Array, normA.count * 3);
    merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  }

  const idxA = a.getIndex();
  const idxB = b.getIndex();
  if (idxA && idxB) {
    const indices = new Uint32Array(idxA.count + idxB.count);
    indices.set(idxA.array as Uint32Array, 0);
    const offset = posA.count;
    for (let i = 0; i < idxB.count; i++) {
      indices[idxA.count + i] = (idxB.array as Uint32Array)[i] + offset;
    }
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  return merged;
}

/** Create a full gumball manipulator. */
export function createGumball(scale: number): GumballComponents {
  const group = new THREE.Group();
  group.name = "clipping-gumball";
  const handles: GumballHandle[] = [];

  // Center origin dot
  const centerDot = createCenterDot(scale);
  group.add(centerDot);

  // Translate arrows
  const axes: Array<{ type: GumballHandleType; axis: THREE.Vector3; colorKey: string }> = [
    { type: "translate-x", axis: new THREE.Vector3(1, 0, 0), colorKey: "x" },
    { type: "translate-y", axis: new THREE.Vector3(0, 1, 0), colorKey: "y" },
    { type: "translate-normal", axis: new THREE.Vector3(0, 0, 1), colorKey: "normal" },
  ];

  for (const { type, axis, colorKey } of axes) {
    const colors = AXIS_COLORS[colorKey];
    const mesh = createArrow(axis, colors.base, scale);
    mesh.userData.gumballHandleType = type;
    group.add(mesh);
    handles.push({
      type,
      mesh,
      axis: axis.clone(),
      color: colors.base,
      highlightColor: colors.highlight,
    });
  }

  // Rotation arcs
  const rotAxes: Array<{ type: GumballHandleType; axis: THREE.Vector3; colorKey: string }> = [
    { type: "rotate-x", axis: new THREE.Vector3(1, 0, 0), colorKey: "x" },
    { type: "rotate-y", axis: new THREE.Vector3(0, 1, 0), colorKey: "y" },
    { type: "rotate-z", axis: new THREE.Vector3(0, 0, 1), colorKey: "z" },
  ];

  for (const { type, axis, colorKey } of rotAxes) {
    const colors = AXIS_COLORS[colorKey];
    const mesh = createRotationArc(axis, colors.base, scale);
    mesh.userData.gumballHandleType = type;
    group.add(mesh);
    handles.push({
      type,
      mesh,
      axis: axis.clone(),
      color: colors.base,
      highlightColor: colors.highlight,
    });
  }

  return { group, handles, centerDot };
}

/** Update gumball position and orientation. */
export function updateGumballTransform(
  gumball: GumballComponents,
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  _scale: number,
): void {
  gumball.group.position.copy(position);
  gumball.group.quaternion.copy(quaternion);

  const normalHandle = gumball.handles.find((h) => h.type === "translate-normal");
  if (normalHandle) {
    normalHandle.axis.set(0, 0, 1);
  }
}

/** Highlight or un-highlight a gumball handle. */
export function highlightHandle(handle: GumballHandle, highlighted: boolean): void {
  const mat = handle.mesh.material as THREE.MeshBasicMaterial;
  mat.color.copy(highlighted ? handle.highlightColor : handle.color);
  mat.opacity = highlighted ? 1 : 0.78;
}

/** Dispose all gumball geometries and materials. */
export function disposeGumball(gumball: GumballComponents): void {
  gumball.centerDot.geometry.dispose();
  (gumball.centerDot.material as THREE.Material).dispose();
  for (const handle of gumball.handles) {
    handle.mesh.geometry.dispose();
    if (handle.mesh.material instanceof THREE.Material) {
      handle.mesh.material.dispose();
    }
  }
}
