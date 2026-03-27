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
}

// --- Colors ---
const AXIS_COLORS: Record<string, { base: THREE.Color; highlight: THREE.Color }> = {
  x: { base: new THREE.Color(0xe53e3e), highlight: new THREE.Color(0xff6b6b) },
  y: { base: new THREE.Color(0x38a169), highlight: new THREE.Color(0x68d391) },
  z: { base: new THREE.Color(0x3182ce), highlight: new THREE.Color(0x63b3ed) },
  normal: { base: new THREE.Color(0xed8936), highlight: new THREE.Color(0xfbb03b) },
};

function createHandleMaterial(color: THREE.Color): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: color.clone(),
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.85,
    clippingPlanes: [],
  });
}

// --- Arrow (translate handle) ---
function createArrow(
  axis: THREE.Vector3,
  color: THREE.Color,
  scale: number,
): THREE.Mesh {
  const shaftRadius = scale * 0.012;
  const shaftLength = scale * 0.3;
  const tipRadius = scale * 0.03;
  const tipLength = scale * 0.08;

  const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 6);
  shaftGeo.translate(0, shaftLength / 2, 0);

  const tipGeo = new THREE.ConeGeometry(tipRadius, tipLength, 8);
  tipGeo.translate(0, shaftLength + tipLength / 2, 0);

  const merged = mergeGeometries(shaftGeo, tipGeo);
  shaftGeo.dispose();
  tipGeo.dispose();

  const mat = createHandleMaterial(color);
  const mesh = new THREE.Mesh(merged, mat);

  // Align Y-up geometry to the target axis
  alignToAxis(mesh, axis);
  mesh.renderOrder = 2000;
  return mesh;
}

// --- Torus (rotation handle) ---
function createRotationArc(
  axis: THREE.Vector3,
  color: THREE.Color,
  scale: number,
): THREE.Mesh {
  const radius = scale * 0.25;
  const tube = scale * 0.008;
  const arc = Math.PI * 1.5;
  const geo = new THREE.TorusGeometry(radius, tube, 6, 48, arc);
  const mat = createHandleMaterial(color);
  const mesh = new THREE.Mesh(geo, mat);

  // TorusGeometry lies in XY plane with Z as normal.
  // Rotate so the torus normal aligns with the handle's axis.
  alignTorusToAxis(mesh, axis);
  mesh.renderOrder = 2000;
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
  // Torus normal is Z by default — rotate so normal = axis
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

  return { group, handles };
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

  // Update the "translate-normal" handle axis to match the current plane normal
  const normalHandle = gumball.handles.find((h) => h.type === "translate-normal");
  if (normalHandle) {
    // In gumball's local space, the normal is always +Z (since gumball rotates with the plane)
    normalHandle.axis.set(0, 0, 1);
  }

  // Scale handles proportionally
  const s = scale;
  gumball.group.scale.setScalar(s > 0 ? 1 : 1);
}

/** Highlight or un-highlight a gumball handle. */
export function highlightHandle(handle: GumballHandle, highlighted: boolean): void {
  const mat = handle.mesh.material as THREE.MeshBasicMaterial;
  mat.color.copy(highlighted ? handle.highlightColor : handle.color);
  mat.opacity = highlighted ? 1 : 0.85;
}

/** Dispose all gumball geometries and materials. */
export function disposeGumball(gumball: GumballComponents): void {
  for (const handle of gumball.handles) {
    handle.mesh.geometry.dispose();
    if (handle.mesh.material instanceof THREE.Material) {
      handle.mesh.material.dispose();
    }
  }
}
