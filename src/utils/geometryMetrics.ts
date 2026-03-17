import type { TransferableMeshData } from "@/types/worker-messages";

export interface GeometryMetrics {
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
  surfaceArea: number;
  volume: number;
  triangleCount: number;
  vertexCount: number;
}

export function transformVertex(
  x: number,
  y: number,
  z: number,
  m: number[],
): [number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

export function computeMeshMetrics(mesh: TransferableMeshData): GeometryMetrics {
  const { vertices, indices, transform } = mesh;
  const vertexCount = vertices.length / 6;
  const triangleCount = indices.length / 3;

  // Transform all vertices to world space
  const wp = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    const off = i * 6;
    const [wx, wy, wz] = transformVertex(
      vertices[off],
      vertices[off + 1],
      vertices[off + 2],
      transform,
    );
    wp[i * 3] = wx;
    wp[i * 3 + 1] = wy;
    wp[i * 3 + 2] = wz;
  }

  // Bounding box
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (let i = 0; i < vertexCount; i++) {
    const x = wp[i * 3],
      y = wp[i * 3 + 1],
      z = wp[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  // Surface area & volume via triangle iteration
  let surfaceArea = 0;
  let volume = 0;

  for (let i = 0; i < triangleCount; i++) {
    const i0 = indices[i * 3] * 3;
    const i1 = indices[i * 3 + 1] * 3;
    const i2 = indices[i * 3 + 2] * 3;

    const v0x = wp[i0], v0y = wp[i0 + 1], v0z = wp[i0 + 2];
    const v1x = wp[i1], v1y = wp[i1 + 1], v1z = wp[i1 + 2];
    const v2x = wp[i2], v2y = wp[i2 + 1], v2z = wp[i2 + 2];

    // Cross product of edge vectors for area
    const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z;
    const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z;
    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    surfaceArea += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;

    // Signed volume via divergence theorem: dot(v0, cross(v1, v2)) / 6
    const c1x = v1y * v2z - v1z * v2y;
    const c1y = v1z * v2x - v1x * v2z;
    const c1z = v1x * v2y - v1y * v2x;
    volume += (v0x * c1x + v0y * c1y + v0z * c1z) / 6;
  }

  return {
    boundingBox: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      size: [maxX - minX, maxY - minY, maxZ - minZ],
    },
    surfaceArea,
    volume: Math.abs(volume),
    triangleCount,
    vertexCount,
  };
}

function mergeMetrics(list: GeometryMetrics[]): GeometryMetrics {
  if (list.length === 1) return list[0];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let surfaceArea = 0;
  let volume = 0;
  let triangleCount = 0;
  let vertexCount = 0;

  for (const m of list) {
    if (m.boundingBox.min[0] < minX) minX = m.boundingBox.min[0];
    if (m.boundingBox.min[1] < minY) minY = m.boundingBox.min[1];
    if (m.boundingBox.min[2] < minZ) minZ = m.boundingBox.min[2];
    if (m.boundingBox.max[0] > maxX) maxX = m.boundingBox.max[0];
    if (m.boundingBox.max[1] > maxY) maxY = m.boundingBox.max[1];
    if (m.boundingBox.max[2] > maxZ) maxZ = m.boundingBox.max[2];
    surfaceArea += m.surfaceArea;
    volume += m.volume;
    triangleCount += m.triangleCount;
    vertexCount += m.vertexCount;
  }

  return {
    boundingBox: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      size: [maxX - minX, maxY - minY, maxZ - minZ],
    },
    surfaceArea,
    volume,
    triangleCount,
    vertexCount,
  };
}

export function computeEntityMetrics(
  meshes: TransferableMeshData[],
  entityId: number,
): GeometryMetrics | null {
  const entityMeshes = meshes.filter((m) => m.expressId === entityId);
  if (entityMeshes.length === 0) return null;
  return mergeMetrics(entityMeshes.map(computeMeshMetrics));
}

export function computeMultiEntityMetrics(
  meshes: TransferableMeshData[],
  entityIds: number[],
): { perEntity: Map<number, GeometryMetrics>; aggregate: GeometryMetrics } | null {
  const perEntity = new Map<number, GeometryMetrics>();

  for (const id of entityIds) {
    const metrics = computeEntityMetrics(meshes, id);
    if (metrics) perEntity.set(id, metrics);
  }

  if (perEntity.size === 0) return null;

  const aggregate = mergeMetrics([...perEntity.values()]);
  return { perEntity, aggregate };
}

export function formatMetric(value: number, unit: string, decimals = 2): string {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${unit}`;
}
