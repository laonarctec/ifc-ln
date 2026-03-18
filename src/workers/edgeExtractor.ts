/**
 * Edge Extractor — feature edge extraction from triangle meshes
 *
 * Adapted from ifc-lite EdgeExtractor for worker-side use.
 * Operates directly on typed arrays (no object allocation) for performance.
 *
 * Identifies:
 * - Boundary edges (only one adjacent triangle)
 * - Crease edges (dihedral angle between adjacent faces exceeds threshold)
 */

/**
 * Extract feature edges from a stride-6 vertex buffer and index buffer.
 *
 * @param vertices  Float32Array with stride 6: [x, y, z, nx, ny, nz, ...]
 * @param indices   Uint32Array of triangle indices
 * @param creaseAngleDeg  Crease angle threshold in degrees (default 70).
 *   70° filters out curved-surface facet edges (~5-30°) while keeping
 *   real geometric edges like wall corners and slab edges (~90°).
 * @returns Float32Array of edge line segments: [x0,y0,z0, x1,y1,z1, ...]
 */
export function extractEdges(
  vertices: Float32Array,
  indices: Uint32Array,
  creaseAngleDeg: number = 70,
): Float32Array {
  const creaseAngle = (creaseAngleDeg * Math.PI) / 180;
  const triangleCount = (indices.length / 3) | 0;
  const vertexCount = (vertices.length / 6) | 0;

  // --- Pass 0: build position-based vertex merge map ---
  // Quantize vertex positions to 0.1mm precision to merge duplicates
  // that web-ifc creates per-face (same position, different normals).
  const PRECISION = 1e4;
  const posMap = new Map<string, number>();
  const canonicalOf = new Uint32Array(vertexCount);

  for (let i = 0; i < vertexCount; i++) {
    const base = i * 6;
    const key = `${Math.round(vertices[base] * PRECISION)}:${Math.round(vertices[base + 1] * PRECISION)}:${Math.round(vertices[base + 2] * PRECISION)}`;
    const existing = posMap.get(key);
    if (existing !== undefined) {
      canonicalOf[i] = existing;
    } else {
      posMap.set(key, i);
      canonicalOf[i] = i;
    }
  }

  // --- Pass 1: compute face normals and build edge adjacency ---
  // Face normals stored flat: [nx0,ny0,nz0, nx1,ny1,nz1, ...]
  const faceNormals = new Float32Array(triangleCount * 3);

  // Edge adjacency map: canonical key → { v0Idx, v1Idx, faceIndices[] }
  const edgeMap = new Map<string, { v0: number; v1: number; faces: number[] }>();

  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];

    // Vertex positions (stride-6)
    const ax = vertices[i0 * 6], ay = vertices[i0 * 6 + 1], az = vertices[i0 * 6 + 2];
    const bx = vertices[i1 * 6], by = vertices[i1 * 6 + 1], bz = vertices[i1 * 6 + 2];
    const cx = vertices[i2 * 6], cy = vertices[i2 * 6 + 1], cz = vertices[i2 * 6 + 2];

    // Cross product of edges (v1-v0) × (v2-v0)
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;

    // Normalize
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-10) {
      nx /= len; ny /= len; nz /= len;
    }

    faceNormals[t * 3] = nx;
    faceNormals[t * 3 + 1] = ny;
    faceNormals[t * 3 + 2] = nz;

    // Register 3 edges using canonical (position-merged) indices
    const c0 = canonicalOf[i0], c1 = canonicalOf[i1], c2 = canonicalOf[i2];
    registerEdge(edgeMap, c0, c1, t);
    registerEdge(edgeMap, c1, c2, t);
    registerEdge(edgeMap, c2, c0, t);
  }

  // --- Pass 2: classify edges and collect feature edges ---
  // TODO: classifyEdge — this is the crease angle classification logic.
  // The user will implement this function below.
  const result: number[] = [];

  for (const edge of edgeMap.values()) {
    const edgeType = classifyEdge(edge.faces, faceNormals, creaseAngle);

    if (edgeType !== "smooth") {
      const v0base = edge.v0 * 6;
      const v1base = edge.v1 * 6;
      result.push(
        vertices[v0base], vertices[v0base + 1], vertices[v0base + 2],
        vertices[v1base], vertices[v1base + 1], vertices[v1base + 2],
      );
    }
  }

  return new Float32Array(result);
}

/**
 * Classify an edge as 'boundary', 'crease', or 'smooth' based on
 * the dihedral angle between its adjacent faces.
 *
 * - boundary: only one adjacent face → always a feature edge
 * - crease: two adjacent faces with dihedral angle > creaseAngle
 * - smooth: two adjacent faces with dihedral angle ≤ creaseAngle
 */
function classifyEdge(
  faceIndices: number[],
  faceNormals: Float32Array,
  creaseAngle: number,
): "boundary" | "crease" | "smooth" {
  if (faceIndices.length === 1) {
    return "boundary";
  }

  if (faceIndices.length < 2) {
    return "smooth";
  }

  const f0 = faceIndices[0] * 3;
  const f1 = faceIndices[1] * 3;

  const dot = Math.max(-1, Math.min(1,
    faceNormals[f0] * faceNormals[f1] +
    faceNormals[f0 + 1] * faceNormals[f1 + 1] +
    faceNormals[f0 + 2] * faceNormals[f1 + 2],
  ));

  const dihedralAngle = Math.acos(dot);
  return dihedralAngle > creaseAngle ? "crease" : "smooth";
}

function registerEdge(
  edgeMap: Map<string, { v0: number; v1: number; faces: number[] }>,
  idx0: number,
  idx1: number,
  faceIndex: number,
): void {
  const minIdx = Math.min(idx0, idx1);
  const maxIdx = Math.max(idx0, idx1);
  const key = `${minIdx}:${maxIdx}`;

  const existing = edgeMap.get(key);
  if (existing) {
    existing.faces.push(faceIndex);
  } else {
    edgeMap.set(key, { v0: minIdx, v1: maxIdx, faces: [faceIndex] });
  }
}
