import type { TransferableMeshData } from "@/types/worker-messages";
import type { ModelEntityKey } from "@/utils/modelEntity";
import { createModelEntityKey } from "@/utils/modelEntity";
import {
  computeMultiEntityMetrics,
  transformVertex,
  type GeometryMetrics,
} from "./geometryMetrics";
import type { SplitBounds, SplitLine, SplitRegion } from "@/stores/slices/quantitySplitSlice";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EPSILON = 1e-8;
const COORD_EPSILON = 1e-6;

export const REGION_COLORS = [
  "#e74c3c",
  "#f1c40f",
  "#2ecc71",
  "#3498db",
  "#9b59b6",
  "#e67e22",
  "#1abc9c",
  "#e84393",
  "#00cec9",
  "#fdcb6e",
  "#6c5ce7",
  "#ff7675",
];

// ---------------------------------------------------------------------------
// 2D geometry primitives
// ---------------------------------------------------------------------------

type Vec2 = [number, number];

function vec2Eq(a: Vec2, b: Vec2): boolean {
  return Math.abs(a[0] - b[0]) < COORD_EPSILON && Math.abs(a[1] - b[1]) < COORD_EPSILON;
}

function cross2D(o: Vec2, a: Vec2, b: Vec2): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Angle from positive X axis, range (-PI, PI]. */
function edgeAngle(from: Vec2, to: Vec2): number {
  return Math.atan2(to[1] - from[1], to[0] - from[0]);
}

// ---------------------------------------------------------------------------
// Segment–segment intersection
// ---------------------------------------------------------------------------

export function segmentIntersection(
  a1: Vec2, a2: Vec2,
  b1: Vec2, b2: Vec2,
): Vec2 | null {
  const d1x = a2[0] - a1[0];
  const d1y = a2[1] - a1[1];
  const d2x = b2[0] - b1[0];
  const d2y = b2[1] - b1[1];

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < EPSILON) return null; // parallel

  const t = ((b1[0] - a1[0]) * d2y - (b1[1] - a1[1]) * d2x) / denom;
  const u = ((b1[0] - a1[0]) * d1y - (b1[1] - a1[1]) * d1x) / denom;

  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) return null;

  return [a1[0] + t * d1x, a1[1] + t * d1y];
}

// ---------------------------------------------------------------------------
// Clip line segment to bounding rectangle (Liang-Barsky)
// ---------------------------------------------------------------------------

export function clipLineToBounds(
  start: Vec2,
  end: Vec2,
  bounds: SplitBounds,
): [Vec2, Vec2] | null {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  const p = [-dx, dx, -dy, dy];
  const q = [
    start[0] - bounds.min[0],
    bounds.max[0] - start[0],
    start[1] - bounds.min[1],
    bounds.max[1] - start[1],
  ];

  let tMin = 0;
  let tMax = 1;

  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < EPSILON) {
      if (q[i] < -EPSILON) return null;
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) {
      tMin = Math.max(tMin, t);
    } else {
      tMax = Math.min(tMax, t);
    }
    if (tMin > tMax + EPSILON) return null;
  }

  return [
    [start[0] + tMin * dx, start[1] + tMin * dy],
    [start[0] + tMax * dx, start[1] + tMax * dy],
  ];
}

/**
 * Extend a user-drawn line segment so it reaches the bounding box edges.
 * The line defined by start→end is extended in both directions until it
 * intersects the bounds rectangle.
 */
export function extendLineToBounds(
  start: Vec2,
  end: Vec2,
  bounds: SplitBounds,
): [Vec2, Vec2] | null {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return null;

  // Extend the line to a very large segment, then clip
  const bigT = 1e6;
  const farStart: Vec2 = [start[0] - dx * bigT, start[1] - dy * bigT];
  const farEnd: Vec2 = [start[0] + dx * bigT, start[1] + dy * bigT];
  return clipLineToBounds(farStart, farEnd, bounds);
}

// ---------------------------------------------------------------------------
// Vertex pool — merge nearby coordinates
// ---------------------------------------------------------------------------

class VertexPool {
  private coords: Vec2[] = [];

  add(v: Vec2): number {
    for (let i = 0; i < this.coords.length; i++) {
      if (vec2Eq(this.coords[i], v)) return i;
    }
    this.coords.push([v[0], v[1]]);
    return this.coords.length - 1;
  }

  get(i: number): Vec2 {
    return this.coords[i];
  }

  get size(): number {
    return this.coords.length;
  }
}

// ---------------------------------------------------------------------------
// Half-edge planar subdivision → polygon extraction
// ---------------------------------------------------------------------------

interface HalfEdge {
  from: number;
  to: number;
  twin: number;   // index of twin half-edge
  next: number;   // index of next half-edge in face
  visited: boolean;
}

/**
 * Build a planar subdivision from a set of line segments and extract all
 * minimal face polygons.
 */
export function computePolygonsFromSegments(
  segments: [Vec2, Vec2][],
): Vec2[][] {
  const pool = new VertexPool();

  // 1. Collect all segments and compute intersection points
  const rawSegs: [number, number][] = [];
  for (const [a, b] of segments) {
    rawSegs.push([pool.add(a), pool.add(b)]);
  }

  // Find all intersection points and split segments
  const splitSegs = splitSegmentsAtIntersections(rawSegs, pool);

  // 2. Build adjacency: for each vertex, list outgoing edges sorted by angle
  const adj = buildAdjacency(splitSegs, pool);

  // 3. Build half-edge structure
  const halfEdges = buildHalfEdges(splitSegs, adj, pool);
  if (halfEdges.length === 0) return [];

  // 4. Link "next" pointers using the planar face traversal rule
  linkNextPointers(halfEdges, adj, pool);

  // 5. Extract faces by traversing half-edge cycles
  const faces = extractFaces(halfEdges, pool);

  // 6. Remove the outer (unbounded) face — the one with the largest signed area
  return removeOuterFace(faces);
}

function splitSegmentsAtIntersections(
  segs: [number, number][],
  pool: VertexPool,
): [number, number][] {
  // For each segment, collect parameter values where intersections occur
  const paramsBySegIdx: Map<number, number[]> = new Map();
  for (let i = 0; i < segs.length; i++) {
    paramsBySegIdx.set(i, []);
  }

  for (let i = 0; i < segs.length; i++) {
    const a1 = pool.get(segs[i][0]);
    const a2 = pool.get(segs[i][1]);
    for (let j = i + 1; j < segs.length; j++) {
      const b1 = pool.get(segs[j][0]);
      const b2 = pool.get(segs[j][1]);
      const hit = segmentIntersection(a1, a2, b1, b2);
      if (!hit) continue;

      const vi = pool.add(hit);
      // Compute parameter t for segment i
      const dxi = a2[0] - a1[0];
      const dyi = a2[1] - a1[1];
      const ti = Math.abs(dxi) > Math.abs(dyi)
        ? (hit[0] - a1[0]) / dxi
        : (hit[1] - a1[1]) / dyi;
      paramsBySegIdx.get(i)!.push(ti);

      const dxj = b2[0] - b1[0];
      const dyj = b2[1] - b1[1];
      const tj = Math.abs(dxj) > Math.abs(dyj)
        ? (hit[0] - b1[0]) / dxj
        : (hit[1] - b1[1]) / dyj;
      paramsBySegIdx.get(j)!.push(tj);
    }
  }

  // Split each segment at its sorted parameter values
  const result: [number, number][] = [];
  for (let i = 0; i < segs.length; i++) {
    const params = paramsBySegIdx.get(i)!;
    params.push(0, 1);
    params.sort((a, b) => a - b);

    const a1 = pool.get(segs[i][0]);
    const a2 = pool.get(segs[i][1]);
    const dx = a2[0] - a1[0];
    const dy = a2[1] - a1[1];

    let prevIdx = -1;
    for (const t of params) {
      const clamped = Math.max(0, Math.min(1, t));
      const pt: Vec2 = [a1[0] + clamped * dx, a1[1] + clamped * dy];
      const vi = pool.add(pt);
      if (prevIdx >= 0 && prevIdx !== vi) {
        result.push([prevIdx, vi]);
      }
      prevIdx = vi;
    }
  }

  // Remove duplicate edges
  const edgeSet = new Set<string>();
  const deduped: [number, number][] = [];
  for (const [a, b] of result) {
    if (a === b) continue;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    deduped.push([a, b]);
  }

  return deduped;
}

type Adjacency = Map<number, { to: number; angle: number }[]>;

function buildAdjacency(segs: [number, number][], pool: VertexPool): Adjacency {
  const adj: Adjacency = new Map();

  const ensure = (v: number) => {
    if (!adj.has(v)) adj.set(v, []);
  };

  for (const [a, b] of segs) {
    ensure(a);
    ensure(b);
    const angleAB = edgeAngle(pool.get(a), pool.get(b));
    const angleBA = edgeAngle(pool.get(b), pool.get(a));
    adj.get(a)!.push({ to: b, angle: angleAB });
    adj.get(b)!.push({ to: a, angle: angleBA });
  }

  // Sort each vertex's edges by angle
  for (const edges of adj.values()) {
    edges.sort((a, b) => a.angle - b.angle);
  }

  return adj;
}

function buildHalfEdges(
  segs: [number, number][],
  _adj: Adjacency,
  _pool: VertexPool,
): HalfEdge[] {
  const halfEdges: HalfEdge[] = [];
  const edgeIndex = new Map<string, number>();

  for (const [a, b] of segs) {
    const heAB: HalfEdge = { from: a, to: b, twin: -1, next: -1, visited: false };
    const heBA: HalfEdge = { from: b, to: a, twin: -1, next: -1, visited: false };
    const idxAB = halfEdges.length;
    const idxBA = halfEdges.length + 1;
    heAB.twin = idxBA;
    heBA.twin = idxAB;
    halfEdges.push(heAB, heBA);
    edgeIndex.set(`${a}-${b}`, idxAB);
    edgeIndex.set(`${b}-${a}`, idxBA);
  }

  return halfEdges;
}

function linkNextPointers(
  halfEdges: HalfEdge[],
  adj: Adjacency,
  pool: VertexPool,
): void {
  // Group half-edges by their "to" vertex
  const incomingByVertex = new Map<number, number[]>();
  for (let i = 0; i < halfEdges.length; i++) {
    const he = halfEdges[i];
    if (!incomingByVertex.has(he.to)) incomingByVertex.set(he.to, []);
    incomingByVertex.get(he.to)!.push(i);
  }

  // For each vertex, match each incoming half-edge to its "next" outgoing half-edge
  // The rule: for incoming edge (X→V), find its twin (V→X), then the next outgoing
  // edge from V in CW order after the angle of (V→X) is the "next" half-edge.
  for (const [v, edges] of adj) {
    const sortedOutgoing = edges; // already sorted by angle ascending
    if (sortedOutgoing.length === 0) continue;

    // For each outgoing edge from v (V→W), find its twin (W→V) = incoming
    // The incoming half-edge (X→V) needs next = outgoing (V→Y) where Y is
    // the next CW neighbor after X.
    //
    // In the sorted list by angle, "next CW" means the PREVIOUS entry
    // (since angles are sorted CCW, the previous one is the next CW).
    for (let i = 0; i < sortedOutgoing.length; i++) {
      const outEdge = sortedOutgoing[i];
      // The twin of this outgoing edge is an incoming edge to v
      const outHalfEdgeIdx = findHalfEdge(halfEdges, v, outEdge.to);
      if (outHalfEdgeIdx < 0) continue;
      const inHalfEdgeIdx = halfEdges[outHalfEdgeIdx].twin; // incoming (outEdge.to → v)

      // Next outgoing from v in CW order = previous in the CCW-sorted list
      const prevIdx = (i - 1 + sortedOutgoing.length) % sortedOutgoing.length;
      const nextOut = sortedOutgoing[prevIdx];
      const nextHalfEdgeIdx = findHalfEdge(halfEdges, v, nextOut.to);
      if (nextHalfEdgeIdx < 0) continue;

      halfEdges[inHalfEdgeIdx].next = nextHalfEdgeIdx;
    }
  }
}

function findHalfEdge(halfEdges: HalfEdge[], from: number, to: number): number {
  for (let i = 0; i < halfEdges.length; i++) {
    if (halfEdges[i].from === from && halfEdges[i].to === to) return i;
  }
  return -1;
}

function extractFaces(halfEdges: HalfEdge[], pool: VertexPool): Vec2[][] {
  const faces: Vec2[][] = [];

  for (let startIdx = 0; startIdx < halfEdges.length; startIdx++) {
    if (halfEdges[startIdx].visited) continue;
    if (halfEdges[startIdx].next < 0) continue;

    const face: Vec2[] = [];
    let current = startIdx;
    let safety = halfEdges.length + 1;

    while (safety-- > 0) {
      if (halfEdges[current].visited) break;
      halfEdges[current].visited = true;
      face.push(pool.get(halfEdges[current].from));
      const next = halfEdges[current].next;
      if (next < 0 || next === startIdx) break;
      current = next;
    }

    if (face.length >= 3) {
      faces.push(face);
    }
  }

  return faces;
}

function polygonSignedArea(polygon: Vec2[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }
  return area / 2;
}

function removeOuterFace(faces: Vec2[][]): Vec2[][] {
  if (faces.length <= 1) return faces;

  // The outer face has the largest absolute area, and typically negative signed area (CW)
  let outerIdx = 0;
  let maxAbsArea = 0;
  for (let i = 0; i < faces.length; i++) {
    const absArea = Math.abs(polygonSignedArea(faces[i]));
    if (absArea > maxAbsArea) {
      maxAbsArea = absArea;
      outerIdx = i;
    }
  }

  const result: Vec2[][] = [];
  for (let i = 0; i < faces.length; i++) {
    if (i === outerIdx) continue;
    const face = faces[i];
    // Ensure CCW orientation
    if (polygonSignedArea(face) < 0) {
      face.reverse();
    }
    result.push(face);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Point-in-polygon (ray casting)
// ---------------------------------------------------------------------------

export function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  const [px, py] = point;
  const n = polygon.length;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if ((yi > py) !== (yj > py) &&
        px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

// ---------------------------------------------------------------------------
// Entity centroid computation
// ---------------------------------------------------------------------------

export function computeEntityCentroids(
  meshes: TransferableMeshData[],
): Map<number, Vec2> {
  // Group meshes by expressId, accumulate XY sums
  const acc = new Map<number, { sumX: number; sumY: number; count: number }>();

  for (const mesh of meshes) {
    const { vertices, transform, expressId } = mesh;
    const vertexCount = vertices.length / 6;
    if (vertexCount === 0) continue;

    let entry = acc.get(expressId);
    if (!entry) {
      entry = { sumX: 0, sumY: 0, count: 0 };
      acc.set(expressId, entry);
    }

    for (let i = 0; i < vertexCount; i++) {
      const off = i * 6;
      const [wx, wy] = transformVertex(
        vertices[off], vertices[off + 1], vertices[off + 2],
        transform,
      );
      entry.sumX += wx;
      entry.sumY += wy;
      entry.count++;
    }
  }

  const result = new Map<number, Vec2>();
  for (const [id, { sumX, sumY, count }] of acc) {
    result.set(id, [sumX / count, sumY / count]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// High-level API: compute regions from bounds + lines
// ---------------------------------------------------------------------------

export function computeRegionsFromLines(
  bounds: SplitBounds,
  lines: SplitLine[],
): Vec2[][] {
  // Collect all segments: bounding box edges + extended split lines
  const segments: [Vec2, Vec2][] = [];

  // Bounding rectangle edges
  const bl: Vec2 = [bounds.min[0], bounds.min[1]];
  const br: Vec2 = [bounds.max[0], bounds.min[1]];
  const tr: Vec2 = [bounds.max[0], bounds.max[1]];
  const tl: Vec2 = [bounds.min[0], bounds.max[1]];
  segments.push([bl, br], [br, tr], [tr, tl], [tl, bl]);

  // Extend each split line to bounds
  for (const line of lines) {
    const extended = extendLineToBounds(line.start, line.end, bounds);
    if (extended) {
      segments.push(extended);
    }
  }

  if (lines.length === 0) {
    // No split lines → single region = entire bounds
    return [[bl, br, tr, tl]];
  }

  return computePolygonsFromSegments(segments);
}

// ---------------------------------------------------------------------------
// Full pipeline: assign entities to regions and compute metrics
// ---------------------------------------------------------------------------

export function assignEntitiesToRegions(
  polygons: Vec2[][],
  meshes: TransferableMeshData[],
  modelId: number,
): SplitRegion[] {
  const centroids = computeEntityCentroids(meshes);

  const regions: SplitRegion[] = polygons.map((polygon, i) => ({
    id: `region-${i}`,
    polygon,
    color: REGION_COLORS[i % REGION_COLORS.length],
    entityKeys: [],
    metrics: null,
  }));

  // Assign each entity to a region based on its centroid
  for (const [expressId, centroid] of centroids) {
    for (const region of regions) {
      if (pointInPolygon(centroid, region.polygon)) {
        region.entityKeys.push(createModelEntityKey(modelId, expressId));
        break;
      }
    }
  }

  // Compute metrics per region
  for (const region of regions) {
    const entityIds = region.entityKeys.map((key) => {
      const parts = key.split(":");
      return Number(parts[1]);
    });

    if (entityIds.length > 0) {
      const result = computeMultiEntityMetrics(meshes, entityIds);
      region.metrics = result?.aggregate ?? null;
    }
  }

  return regions;
}
