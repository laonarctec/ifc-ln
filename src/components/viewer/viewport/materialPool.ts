import * as THREE from "three";

// --- Mesh material pool ---

const meshPool = new Map<string, THREE.MeshPhongMaterial>();

function meshKey(hexColor: string, opacity: number): string {
  return `${hexColor}:${opacity.toFixed(2)}`;
}

/**
 * Get or create a shared MeshPhongMaterial from the pool.
 * Shared materials must NOT have their color/opacity mutated directly.
 * For visual state changes (selection, override), clone the material first.
 */
export function getPooledMeshMaterial(
  color: THREE.Color,
  opacity: number,
): THREE.MeshPhongMaterial {
  const key = meshKey(color.getHexString(), opacity);
  let mat = meshPool.get(key);
  if (!mat) {
    mat = new THREE.MeshPhongMaterial({
      color: color.clone(),
      transparent: opacity < 1,
      opacity,
      shininess: 30,
      side: THREE.FrontSide,
    });
    meshPool.set(key, mat);
  }
  return mat;
}

// --- Edge material pool ---

const edgePool = new Map<string, THREE.LineBasicMaterial>();

function edgeKey(hexColor: string, opacity: number): string {
  return `e:${hexColor}:${opacity.toFixed(2)}`;
}

/** Get or create a shared LineBasicMaterial for edges. */
export function getPooledEdgeMaterial(
  color: THREE.Color,
  opacity: number,
): THREE.LineBasicMaterial {
  const key = edgeKey(color.getHexString(), opacity);
  let mat = edgePool.get(key);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({
      color: color.clone(),
      depthTest: true,
      transparent: true,
      opacity,
    });
    edgePool.set(key, mat);
  }
  return mat;
}

/** Dispose all pooled materials. Call on scene teardown. */
export function disposeMaterialPool(): void {
  meshPool.forEach((mat) => mat.dispose());
  meshPool.clear();
  edgePool.forEach((mat) => mat.dispose());
  edgePool.clear();
}
