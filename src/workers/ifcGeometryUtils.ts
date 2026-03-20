import type { IfcAPI } from "web-ifc";
import { IFCPROJECT, IFCUNITASSIGNMENT, IFCSIUNIT } from "web-ifc";
import type {
  IfcSpatialElement,
  IfcSpatialNode,
  RenderChunkMeta,
  RenderChunkPayload,
  RenderManifest,
} from "@/types/worker-messages";
import { readIfcText, readIfcNumber } from "./ifcPropertyUtils";

export interface CachedRenderableMesh {
  expressId: number;
  geometryExpressId: number;
  ifcType: string;
  vertices: Float32Array;
  indices: Uint32Array;
  color: [number, number, number, number];
  transform: number[];
}

export interface WorkerChunk {
  meta: RenderChunkMeta;
  meshes: CachedRenderableMesh[];
}

export interface RenderCache {
  manifest: RenderManifest;
  chunks: Map<number, WorkerChunk>;
}

function multiplyPointByMatrix(
  x: number,
  y: number,
  z: number,
  matrix: number[],
): [number, number, number] {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

export function createMeshBounds(mesh: CachedRenderableMesh) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < mesh.vertices.length; index += 6) {
    const x = mesh.vertices[index];
    const y = mesh.vertices[index + 1];
    const z = mesh.vertices[index + 2];

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const corners: [number, number, number][] = [
    [minX, minY, minZ],
    [minX, minY, maxZ],
    [minX, maxY, minZ],
    [minX, maxY, maxZ],
    [maxX, minY, minZ],
    [maxX, minY, maxZ],
    [maxX, maxY, minZ],
    [maxX, maxY, maxZ],
  ];

  let worldMinX = Number.POSITIVE_INFINITY;
  let worldMinY = Number.POSITIVE_INFINITY;
  let worldMinZ = Number.POSITIVE_INFINITY;
  let worldMaxX = Number.NEGATIVE_INFINITY;
  let worldMaxY = Number.NEGATIVE_INFINITY;
  let worldMaxZ = Number.NEGATIVE_INFINITY;

  corners.forEach(([x, y, z]) => {
    const [worldX, worldY, worldZ] = multiplyPointByMatrix(
      x,
      y,
      z,
      mesh.transform,
    );
    if (worldX < worldMinX) worldMinX = worldX;
    if (worldY < worldMinY) worldMinY = worldY;
    if (worldZ < worldMinZ) worldMinZ = worldZ;
    if (worldX > worldMaxX) worldMaxX = worldX;
    if (worldY > worldMaxY) worldMaxY = worldY;
    if (worldZ > worldMaxZ) worldMaxZ = worldZ;
  });

  return [
    worldMinX,
    worldMinY,
    worldMinZ,
    worldMaxX,
    worldMaxY,
    worldMaxZ,
  ] as const;
}

export function unionBounds(
  target: [number, number, number, number, number, number] | null,
  next: readonly [number, number, number, number, number, number],
): [number, number, number, number, number, number] {
  if (!target) {
    return [...next] as [number, number, number, number, number, number];
  }

  return [
    Math.min(target[0], next[0]),
    Math.min(target[1], next[1]),
    Math.min(target[2], next[2]),
    Math.max(target[3], next[3]),
    Math.max(target[4], next[4]),
    Math.max(target[5], next[5]),
  ] as [number, number, number, number, number, number];
}

export function createManifestFromChunks(
  modelId: number,
  chunks: WorkerChunk[],
): RenderManifest {
  let meshCount = 0;
  let vertexCount = 0;
  let indexCount = 0;
  let modelBounds: [number, number, number, number, number, number] | null =
    null;

  chunks.forEach((chunk) => {
    meshCount += chunk.meta.meshCount;
    vertexCount += chunk.meta.vertexCount;
    indexCount += chunk.meta.indexCount;
    modelBounds = unionBounds(modelBounds, chunk.meta.bounds);
  });

  const safeBounds = (modelBounds ?? [0, 0, 0, 0, 0, 0]) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const centerX = (safeBounds[0] + safeBounds[3]) / 2;
  const centerY = (safeBounds[1] + safeBounds[4]) / 2;
  const centerZ = (safeBounds[2] + safeBounds[5]) / 2;

  const initialChunkIds = [...chunks]
    .sort((left, right) => {
      const leftBounds = left.meta.bounds;
      const rightBounds = right.meta.bounds;
      const leftCenter = [
        (leftBounds[0] + leftBounds[3]) / 2,
        (leftBounds[1] + leftBounds[4]) / 2,
        (leftBounds[2] + leftBounds[5]) / 2,
      ];
      const rightCenter = [
        (rightBounds[0] + rightBounds[3]) / 2,
        (rightBounds[1] + rightBounds[4]) / 2,
        (rightBounds[2] + rightBounds[5]) / 2,
      ];
      const leftDistance =
        Math.abs(leftCenter[0] - centerX) +
        Math.abs(leftCenter[1] - centerY) +
        Math.abs(leftCenter[2] - centerZ);
      const rightDistance =
        Math.abs(rightCenter[0] - centerX) +
        Math.abs(rightCenter[1] - centerY) +
        Math.abs(rightCenter[2] - centerZ);
      return leftDistance - rightDistance;
    })
    .slice(0, 16)
    .map((chunk) => chunk.meta.chunkId);

  return {
    modelId,
    meshCount,
    vertexCount,
    indexCount,
    chunkCount: chunks.length,
    modelBounds: safeBounds,
    initialChunkIds,
    chunks: chunks.map((chunk) => chunk.meta),
  };
}

export function cloneChunkPayload(chunk: WorkerChunk): RenderChunkPayload {
  return {
    chunkId: chunk.meta.chunkId,
    meshes: chunk.meshes.map((mesh) => ({
      ...mesh,
      vertices: new Float32Array(mesh.vertices),
      indices: new Uint32Array(mesh.indices),
      color: [...mesh.color] as [number, number, number, number],
      transform: [...mesh.transform],
    })),
  };
}

const SI_PREFIX_FACTORS: Record<string, number> = {
  EXA: 1e18,
  PETA: 1e15,
  TERA: 1e12,
  GIGA: 1e9,
  MEGA: 1e6,
  KILO: 1e3,
  HECTO: 1e2,
  DECA: 1e1,
  DECI: 1e-1,
  CENTI: 1e-2,
  MILLI: 1e-3,
  MICRO: 1e-6,
  NANO: 1e-9,
  PICO: 1e-12,
  FEMTO: 1e-15,
  ATTO: 1e-18,
};

/**
 * IFC 모델의 길이 단위를 미터 기준 변환 계수로 반환합니다.
 * IFCPROJECT → UnitsInContext(IFCUNITASSIGNMENT) → IFCSIUNIT(LENGTHUNIT) 체인을 따라갑니다.
 * 파싱 실패 시 0.001 (mm→m) fallback.
 */
export function getLengthUnitFactor(activeApi: IfcAPI, modelId: number): number {
  try {
    const projectIds = activeApi.GetLineIDsWithType(modelId, IFCPROJECT, false);
    if (projectIds.size() === 0) return 0.001;

    const project = activeApi.GetLine(modelId, projectIds.get(0), false, false) as Record<string, unknown> | null;
    if (!project) return 0.001;

    // UnitsInContext → expressID of IFCUNITASSIGNMENT
    const unitsRef = project.UnitsInContext as { expressID?: number } | null;
    if (!unitsRef?.expressID) return 0.001;

    const unitAssignment = activeApi.GetLine(modelId, unitsRef.expressID, false, false) as Record<string, unknown> | null;
    if (!unitAssignment) return 0.001;

    const units = Array.isArray(unitAssignment.Units) ? unitAssignment.Units : [];

    for (const unitRef of units) {
      const unitId = typeof unitRef === "object" && unitRef !== null && "expressID" in unitRef
        ? (unitRef as { expressID: number }).expressID
        : null;
      if (unitId === null) continue;

      const unitTypeCode = activeApi.GetLineType(modelId, unitId);
      if (unitTypeCode !== IFCSIUNIT) continue;

      const unit = activeApi.GetLine(modelId, unitId, false, false) as Record<string, unknown> | null;
      if (!unit) continue;

      // UnitType check — we only care about LENGTHUNIT
      const unitType = typeof unit.UnitType === "object" && unit.UnitType !== null && "value" in (unit.UnitType as Record<string, unknown>)
        ? String((unit.UnitType as Record<string, unknown>).value)
        : String(unit.UnitType ?? "");
      if (!unitType.includes("LENGTHUNIT")) continue;

      // Extract SI prefix
      const prefix = typeof unit.Prefix === "object" && unit.Prefix !== null && "value" in (unit.Prefix as Record<string, unknown>)
        ? String((unit.Prefix as Record<string, unknown>).value)
        : typeof unit.Prefix === "string" ? unit.Prefix : null;

      if (prefix === null || prefix === "null" || prefix === "") {
        // No prefix = base SI unit (metre) → factor is 1
        return 1;
      }

      return SI_PREFIX_FACTORS[prefix.toUpperCase()] ?? 0.001;
    }
  } catch {
    // Parsing failure — fallback to mm
  }

  return 0.001;
}

export function enrichSpatialNode(
  node: Record<string, unknown>,
  storeyElements: Map<number, IfcSpatialElement[]>,
  activeApi: IfcAPI,
  modelId: number,
  lengthUnitFactor: number = 1,
): IfcSpatialNode {
  const expressID = typeof node.expressID === "number" ? node.expressID : 0;
  const type = typeof node.type === "string" ? node.type : "Unknown";
  const baseChildren = Array.isArray(node.children) ? node.children : [];
  const children = baseChildren
    .map((child) =>
      typeof child === "object" && child !== null
        ? enrichSpatialNode(
          child as Record<string, unknown>,
          storeyElements,
          activeApi,
          modelId,
          lengthUnitFactor,
        )
        : null,
    )
    .filter((child): child is IfcSpatialNode => child !== null);

  if (type === "IFCBUILDING") {
    children.sort((left, right) => {
      const leftElevation = left.elevation ?? Number.NEGATIVE_INFINITY;
      const rightElevation = right.elevation ?? Number.NEGATIVE_INFINITY;
      return rightElevation - leftElevation;
    });
  }

  // Resolve name/elevation from GetLine for spatial containers
  let name: string | null =
    readIfcText(node.name) ?? readIfcText(node.Name) ?? null;
  let elevation: number | undefined =
    readIfcNumber(node.elevation) ?? readIfcNumber(node.Elevation) ?? undefined;

  if (expressID > 0 && name === null) {
    const line = activeApi.GetLine(modelId, expressID, false, false) as Record<
      string,
      unknown
    > | null;
    if (line) {
      name = readIfcText(line.Name) ?? null;
      if (elevation === undefined) {
        elevation = readIfcNumber(line.Elevation) ?? undefined;
      }
    }
  }

  const convertedElevation = elevation !== undefined ? elevation * lengthUnitFactor : undefined;

  return {
    expressID,
    type,
    name,
    elevation: convertedElevation,
    elements:
      type === "IFCBUILDINGSTOREY"
        ? (storeyElements.get(expressID) ?? [])
        : undefined,
    children,
  };
}
