import * as THREE from "three";
import { getQuantizedScalar } from "./sectionCutUtils";

export interface SectionTopologyEdge {
  key: string;
  a: number;
  b: number;
  faces: number[];
}

export interface SectionTopology {
  vertexPositions: Float32Array;
  triangles: Uint32Array;
  triangleBoxes: Float32Array;
  triangleEdgeKeys: string[];
  edges: Map<string, SectionTopologyEdge>;
  geometryBounds: THREE.Box3;
  isClosedManifold: boolean;
}

function getEdgeKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function registerEdge(
  edges: Map<string, SectionTopologyEdge>,
  a: number,
  b: number,
  faceIndex: number,
) {
  const key = getEdgeKey(a, b);
  const existing = edges.get(key);
  if (existing) {
    existing.faces.push(faceIndex);
    return key;
  }

  edges.set(key, {
    key,
    a: Math.min(a, b),
    b: Math.max(a, b),
    faces: [faceIndex],
  });
  return key;
}

export function buildSectionTopology(
  geometry: THREE.BufferGeometry,
): SectionTopology {
  const position = geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute)) {
    return {
      vertexPositions: new Float32Array(),
      triangles: new Uint32Array(),
      triangleBoxes: new Float32Array(),
      triangleEdgeKeys: [],
      edges: new Map(),
      geometryBounds: new THREE.Box3().makeEmpty(),
      isClosedManifold: false,
    };
  }

  const index = geometry.getIndex();
  const rawVertexCount = position.count;
  const triangleCount = index ? index.count / 3 : rawVertexCount / 3;
  const canonicalOf = new Uint32Array(rawVertexCount);
  const canonicalKeyToIndex = new Map<string, number>();
  const canonicalPositions: number[] = [];

  for (let vertexIndex = 0; vertexIndex < rawVertexCount; vertexIndex += 1) {
    const key = [
      getQuantizedScalar(position.getX(vertexIndex)),
      getQuantizedScalar(position.getY(vertexIndex)),
      getQuantizedScalar(position.getZ(vertexIndex)),
    ].join(":");
    const existing = canonicalKeyToIndex.get(key);
    if (existing !== undefined) {
      canonicalOf[vertexIndex] = existing;
      continue;
    }

    const nextIndex = canonicalPositions.length / 3;
    canonicalKeyToIndex.set(key, nextIndex);
    canonicalOf[vertexIndex] = nextIndex;
    canonicalPositions.push(
      position.getX(vertexIndex),
      position.getY(vertexIndex),
      position.getZ(vertexIndex),
    );
  }

  const triangles = new Uint32Array(triangleCount * 3);
  const triangleBoxes = new Float32Array(triangleCount * 6);
  const triangleEdgeKeys = new Array<string>(triangleCount * 3);
  const edges = new Map<string, SectionTopologyEdge>();

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let faceIndex = 0; faceIndex < triangleCount; faceIndex += 1) {
    const i0 = canonicalOf[index ? index.getX(faceIndex * 3) : faceIndex * 3];
    const i1 = canonicalOf[index ? index.getX(faceIndex * 3 + 1) : faceIndex * 3 + 1];
    const i2 = canonicalOf[index ? index.getX(faceIndex * 3 + 2) : faceIndex * 3 + 2];

    triangles[faceIndex * 3] = i0;
    triangles[faceIndex * 3 + 1] = i1;
    triangles[faceIndex * 3 + 2] = i2;

    const ax = canonicalPositions[i0 * 3] ?? 0;
    const ay = canonicalPositions[i0 * 3 + 1] ?? 0;
    const az = canonicalPositions[i0 * 3 + 2] ?? 0;
    const bx = canonicalPositions[i1 * 3] ?? 0;
    const by = canonicalPositions[i1 * 3 + 1] ?? 0;
    const bz = canonicalPositions[i1 * 3 + 2] ?? 0;
    const cx = canonicalPositions[i2 * 3] ?? 0;
    const cy = canonicalPositions[i2 * 3 + 1] ?? 0;
    const cz = canonicalPositions[i2 * 3 + 2] ?? 0;

    const boxOffset = faceIndex * 6;
    triangleBoxes[boxOffset] = Math.min(ax, bx, cx);
    triangleBoxes[boxOffset + 1] = Math.min(ay, by, cy);
    triangleBoxes[boxOffset + 2] = Math.min(az, bz, cz);
    triangleBoxes[boxOffset + 3] = Math.max(ax, bx, cx);
    triangleBoxes[boxOffset + 4] = Math.max(ay, by, cy);
    triangleBoxes[boxOffset + 5] = Math.max(az, bz, cz);

    minX = Math.min(minX, triangleBoxes[boxOffset] ?? minX);
    minY = Math.min(minY, triangleBoxes[boxOffset + 1] ?? minY);
    minZ = Math.min(minZ, triangleBoxes[boxOffset + 2] ?? minZ);
    maxX = Math.max(maxX, triangleBoxes[boxOffset + 3] ?? maxX);
    maxY = Math.max(maxY, triangleBoxes[boxOffset + 4] ?? maxY);
    maxZ = Math.max(maxZ, triangleBoxes[boxOffset + 5] ?? maxZ);

    triangleEdgeKeys[faceIndex * 3] = registerEdge(edges, i0, i1, faceIndex);
    triangleEdgeKeys[faceIndex * 3 + 1] = registerEdge(edges, i1, i2, faceIndex);
    triangleEdgeKeys[faceIndex * 3 + 2] = registerEdge(edges, i2, i0, faceIndex);
  }

  let isClosedManifold = edges.size > 0;
  for (const edge of edges.values()) {
    if (edge.faces.length !== 2) {
      isClosedManifold = false;
      break;
    }
  }

  return {
    vertexPositions: new Float32Array(canonicalPositions),
    triangles,
    triangleBoxes,
    triangleEdgeKeys,
    edges,
    geometryBounds:
      canonicalPositions.length === 0
        ? new THREE.Box3().makeEmpty()
        : new THREE.Box3(
            new THREE.Vector3(minX, minY, minZ),
            new THREE.Vector3(maxX, maxY, maxZ),
          ),
    isClosedManifold,
  };
}

export function getOrCreateSectionTopology(
  cache: Map<number, SectionTopology>,
  geometryExpressId: number,
  geometry: THREE.BufferGeometry,
) {
  const existing = cache.get(geometryExpressId);
  if (existing) {
    return existing;
  }

  const topology = buildSectionTopology(geometry);
  cache.set(geometryExpressId, topology);
  return topology;
}
