/**
 * IFCB — Pre-converted IFC binary format
 *
 * Layout:
 *   [0..3]   headerLength (uint32, little-endian)
 *   [4..4+headerLength-1]  JSON header (UTF-8)
 *   [4+headerLength..]     binary blob (concatenated geometry data)
 *
 * The JSON header contains manifest, spatial tree, geometry dictionary
 * (byte ranges into the blob), and per-chunk instance lists.
 *
 * Loading an .ifcb skips web-ifc parsing entirely — the geometry is
 * already in TransferableMeshData-compatible form.
 */

import type {
  IfcSpatialNode,
  RenderManifest,
  TransferableMeshData,
  TransferableEdgeData,
  RenderChunkPayload,
  EdgeChunkPayload,
} from "@/types/worker-messages";
import type { EdgeMeshRef } from "@/components/viewer/viewport/meshManagement";

// ─── Header types (serialised as JSON) ───

export interface IfcbGeometryEntry {
  geometryExpressId: number;
  vertexByteLength: number;  // Float32Array (stride-6)
  indexByteLength: number;   // Uint32Array
  edgeByteLength: number;    // Float32Array (edge line segments)
}

export interface IfcbMeshInstance {
  expressId: number;
  geometryExpressId: number;
  ifcType: string;
  color: [number, number, number, number];
  transform: number[];        // 16 floats (column-major 4×4)
}

export interface IfcbChunkInstances {
  chunkId: number;
  meshes: IfcbMeshInstance[];
}

export interface IfcbHeader {
  version: 1;
  modelId: number;
  schema: string;
  manifest: RenderManifest;
  spatialTree: IfcSpatialNode;
  geometryDict: IfcbGeometryEntry[];
  chunkInstances: IfcbChunkInstances[];
}

// ─── Writer ───

export function encodeIfcb(header: IfcbHeader, geometryBlobs: ArrayBuffer[]): ArrayBuffer {
  const headerJson = JSON.stringify(header);
  const headerBytes = new TextEncoder().encode(headerJson);

  let blobTotalLength = 0;
  for (const blob of geometryBlobs) blobTotalLength += blob.byteLength;

  const totalLength = 4 + headerBytes.byteLength + blobTotalLength;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  // Header length prefix
  view.setUint32(0, headerBytes.byteLength, true);

  // Header JSON
  new Uint8Array(buffer, 4, headerBytes.byteLength).set(headerBytes);

  // Binary blob — concatenated geometry data
  let offset = 4 + headerBytes.byteLength;
  for (const blob of geometryBlobs) {
    new Uint8Array(buffer, offset, blob.byteLength).set(new Uint8Array(blob));
    offset += blob.byteLength;
  }

  return buffer;
}

// ─── Reader ───

export interface IfcbFile {
  header: IfcbHeader;
  blob: ArrayBuffer;   // raw binary after JSON header
  blobOffset: number;   // absolute offset of blob start in the file buffer
  buffer: ArrayBuffer;  // full file buffer
}

export function decodeIfcb(data: ArrayBuffer): IfcbFile {
  const view = new DataView(data);
  const headerLength = view.getUint32(0, true);
  const headerBytes = new Uint8Array(data, 4, headerLength);
  const headerJson = new TextDecoder().decode(headerBytes);
  const header: IfcbHeader = JSON.parse(headerJson);

  if (header.version !== 1) {
    throw new Error(`Unsupported IFCB version: ${header.version}`);
  }

  const blobOffset = 4 + headerLength;
  const blob = data.slice(blobOffset);

  return { header, blob, blobOffset, buffer: data };
}

/**
 * Reconstruct RenderChunkPayload for a set of chunk IDs from the IFCB file.
 * Geometry data is sliced from the binary blob using the geometry dictionary.
 */
export function loadChunksFromIfcb(
  file: IfcbFile,
  chunkIds: number[],
): RenderChunkPayload[] {
  const { header, blob } = file;

  // Build geometry byte-offset lookup from dictionary
  const geoOffsets = buildGeometryOffsets(header.geometryDict);

  const chunkMap = new Map(header.chunkInstances.map((c) => [c.chunkId, c]));

  return chunkIds.flatMap((chunkId) => {
    const chunk = chunkMap.get(chunkId);
    if (!chunk) return [];

    const meshes: TransferableMeshData[] = chunk.meshes.map((inst) => {
      const geo = geoOffsets.get(inst.geometryExpressId)!;
      return {
        modelId: header.modelId,
        expressId: inst.expressId,
        geometryExpressId: inst.geometryExpressId,
        ifcType: inst.ifcType,
        vertices: new Float32Array(blob.slice(geo.vertexOffset, geo.vertexOffset + geo.vertexByteLength)),
        indices: new Uint32Array(blob.slice(geo.indexOffset, geo.indexOffset + geo.indexByteLength)),
        color: [...inst.color] as [number, number, number, number],
        transform: [...inst.transform],
      };
    });

    return [{ modelId: header.modelId, chunkId, meshes }];
  });
}

/**
 * Reconstruct EdgeChunkPayload for a set of chunk IDs from the IFCB file.
 */
export function loadEdgeChunksFromIfcb(
  file: IfcbFile,
  chunkIds: number[],
): EdgeChunkPayload[] {
  const { header, blob } = file;
  const geoOffsets = buildGeometryOffsets(header.geometryDict);
  const chunkMap = new Map(header.chunkInstances.map((c) => [c.chunkId, c]));

  return chunkIds.flatMap((chunkId) => {
    const chunk = chunkMap.get(chunkId);
    if (!chunk) return [];

    const seenGeo = new Set<number>();
    const edges: TransferableEdgeData[] = [];

    for (const inst of chunk.meshes) {
      if (seenGeo.has(inst.geometryExpressId)) continue;
      seenGeo.add(inst.geometryExpressId);

      const geo = geoOffsets.get(inst.geometryExpressId)!;
      if (geo.edgeByteLength === 0) continue;

      const edgePositions = new Float32Array(
        blob.slice(geo.edgeOffset, geo.edgeOffset + geo.edgeByteLength),
      );
      edges.push({
        geometryExpressId: inst.geometryExpressId,
        edgePositions,
        edgeCount: (edgePositions.length / 6) | 0,
      });
    }

    const meshRefs: EdgeMeshRef[] = chunk.meshes.map((inst) => ({
      expressId: inst.expressId,
      modelId: header.modelId,
      geometryExpressId: inst.geometryExpressId,
      transform: [...inst.transform],
    }));

    return [{ modelId: header.modelId, chunkId, edges, meshRefs }];
  });
}

// ─── Internal helpers ───

interface GeoByteRange {
  vertexOffset: number;
  vertexByteLength: number;
  indexOffset: number;
  indexByteLength: number;
  edgeOffset: number;
  edgeByteLength: number;
}

function buildGeometryOffsets(dict: IfcbGeometryEntry[]): Map<number, GeoByteRange> {
  const map = new Map<number, GeoByteRange>();
  let offset = 0;

  for (const entry of dict) {
    const vertexOffset = offset;
    offset += entry.vertexByteLength;
    const indexOffset = offset;
    offset += entry.indexByteLength;
    const edgeOffset = offset;
    offset += entry.edgeByteLength;

    map.set(entry.geometryExpressId, {
      vertexOffset,
      vertexByteLength: entry.vertexByteLength,
      indexOffset,
      indexByteLength: entry.indexByteLength,
      edgeOffset,
      edgeByteLength: entry.edgeByteLength,
    });
  }

  return map;
}
