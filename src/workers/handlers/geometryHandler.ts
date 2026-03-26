import type { IfcAPI } from "web-ifc";
import type {
  IfcSpatialElement,
  IfcWorkerResponse,
  TransferableMeshData,
} from "@/types/worker-messages";
import { IFCRELCONTAINEDINSPATIALSTRUCTURE } from "web-ifc";
import type { CachedRenderableMesh, WorkerChunk, RenderCache } from "../ifcGeometryUtils";
import {
  createMeshBounds,
  unionBounds,
  createManifestFromChunks,
  cloneChunkPayload,
  cloneEdgePayload,
  enrichSpatialNode,
  getLengthUnitFactor,
} from "../ifcGeometryUtils";
import { safeDelete, readIfcText } from "../ifcPropertyUtils";
import {
  ensureApi,
  openModelIds,
  renderCaches,
  spatialTrees,
  postResponse,
  postWithTransfer,
} from "../workerContext";

function createSpatialElementPayload(
  activeApi: IfcAPI,
  modelId: number,
  expressId: number,
): IfcSpatialElement {
  const line = activeApi.GetLine(modelId, expressId, false, false) as Record<string, unknown> | null;
  const typeCode = activeApi.GetLineType(modelId, expressId);
  return {
    expressID: expressId,
    ifcType: activeApi.GetNameFromTypeCode(typeCode) ?? "Unknown",
    name: readIfcText(line?.Name) ?? null,
  };
}

function collectStoreyData(activeApi: IfcAPI, modelId: number) {
  const storeyElements = new Map<number, IfcSpatialElement[]>();
  const entityStoreyMap = new Map<number, number>();
  const relationIds = activeApi.GetLineIDsWithType(modelId, IFCRELCONTAINEDINSPATIALSTRUCTURE, true);

  for (let index = 0; index < relationIds.size(); index += 1) {
    const relationId = relationIds.get(index);
    const relation = activeApi.GetLine(modelId, relationId, false, false) as Record<string, unknown> | null;
    const relatingStructure = relation?.RelatingStructure as { expressID?: unknown } | undefined;
    const storeyId = typeof relatingStructure?.expressID === "number" ? relatingStructure.expressID : null;
    if (storeyId === null) continue;

    const relatedElements = Array.isArray(relation?.RelatedElements) ? relation.RelatedElements : [];
    if (!storeyElements.has(storeyId)) storeyElements.set(storeyId, []);
    const bucket = storeyElements.get(storeyId)!;
    const seen = new Set(bucket.map((item) => item.expressID));

    for (const item of relatedElements) {
      const expressId =
        typeof item === "object" && item !== null && "expressID" in item && typeof (item as { expressID?: unknown }).expressID === "number"
          ? (item as { expressID: number }).expressID
          : null;
      if (expressId === null || seen.has(expressId)) continue;
      seen.add(expressId);
      entityStoreyMap.set(expressId, storeyId);
      bucket.push(createSpatialElementPayload(activeApi, modelId, expressId));
    }

    bucket.sort((a, b) => (a.name ?? `${a.ifcType} #${a.expressID}`).localeCompare(b.name ?? `${b.ifcType} #${b.expressID}`));
  }

  safeDelete(relationIds);
  return { storeyElements, entityStoreyMap };
}

function createRenderableMesh(
  activeApi: IfcAPI,
  modelId: number,
  flatMesh: { expressID: number; geometries: { size: () => number; get: (index: number) => any } },
  geometryIndex: number,
): CachedRenderableMesh {
  const placedGeometry = flatMesh.geometries.get(geometryIndex);
  const geometry = activeApi.GetGeometry(modelId, placedGeometry.geometryExpressID);
  const rawVertices = activeApi.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
  const rawIndices = activeApi.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
  const typeCode = activeApi.GetLineType(modelId, flatMesh.expressID);

  const mesh: CachedRenderableMesh = {
    modelId,
    expressId: flatMesh.expressID,
    geometryExpressId: placedGeometry.geometryExpressID,
    ifcType: activeApi.GetNameFromTypeCode(typeCode) ?? "Unknown",
    vertices: new Float32Array(rawVertices),
    indices: new Uint32Array(rawIndices),
    color: [placedGeometry.color.x, placedGeometry.color.y, placedGeometry.color.z, placedGeometry.color.w],
    transform: [...placedGeometry.flatTransformation],
  };

  safeDelete(geometry);
  return mesh;
}

export async function buildRenderCache(activeApi: IfcAPI, modelId: number) {
  const existing = renderCaches.get(modelId);
  if (existing) return { cache: existing, cacheHit: true };

  const { storeyElements, entityStoreyMap } = collectStoreyData(activeApi, modelId);
  const rawTree = (await activeApi.properties.getSpatialStructure(modelId, false)) as unknown as Record<string, unknown>;
  const lengthUnitFactor = getLengthUnitFactor(activeApi, modelId);
  const spatialTree = enrichSpatialNode(rawTree, storeyElements, activeApi, modelId, lengthUnitFactor);
  spatialTrees.set(modelId, spatialTree);

  const bucketMap = new Map<string, CachedRenderableMesh[]>();
  const chunkSize = 128;
  const maxChunkIndices = 75000;

  activeApi.StreamAllMeshes(modelId, (flatMesh) => {
    const storeyId = entityStoreyMap.get(flatMesh.expressID) ?? null;
    const bucketKey = storeyId === null ? "orphan" : `storey-${storeyId}`;
    if (!bucketMap.has(bucketKey)) bucketMap.set(bucketKey, []);

    for (let gi = 0; gi < flatMesh.geometries.size(); gi += 1) {
      bucketMap.get(bucketKey)!.push(createRenderableMesh(activeApi, modelId, flatMesh, gi));
    }
    safeDelete(flatMesh);
  });

  const chunks: WorkerChunk[] = [];
  let nextChunkId = 1;

  bucketMap.forEach((bucketMeshes, bucketKey) => {
    let currentMeshes: CachedRenderableMesh[] = [];
    let currentIndexCount = 0;
    let currentVertexCount = 0;
    let currentBounds: [number, number, number, number, number, number] | null = null;
    let currentEntityIds = new Set<number>();
    let currentIfcTypes = new Set<string>();
    const storeyId = bucketKey.startsWith("storey-") ? Number(bucketKey.slice("storey-".length)) : null;

    const flush = () => {
      if (currentMeshes.length === 0 || !currentBounds) return;
      chunks.push({
        meta: {
          modelId,
          chunkId: nextChunkId, storeyId,
          entityIds: [...currentEntityIds].sort((a, b) => a - b),
          ifcTypes: [...currentIfcTypes].sort(),
          meshCount: currentMeshes.length,
          vertexCount: currentVertexCount,
          indexCount: currentIndexCount,
          bounds: currentBounds,
        },
        meshes: currentMeshes,
      });
      nextChunkId += 1;
      currentMeshes = [];
      currentIndexCount = 0;
      currentVertexCount = 0;
      currentBounds = null;
      currentEntityIds = new Set<number>();
      currentIfcTypes = new Set<string>();
    };

    bucketMeshes.forEach((mesh) => {
      const meshBounds = createMeshBounds(mesh);
      if (currentMeshes.length > 0 && (currentMeshes.length >= chunkSize || currentIndexCount + mesh.indices.length > maxChunkIndices)) {
        flush();
      }
      currentMeshes.push(mesh);
      currentIndexCount += mesh.indices.length;
      currentVertexCount += mesh.vertices.length / 6;
      currentBounds = unionBounds(currentBounds, meshBounds);
      currentEntityIds.add(mesh.expressId);
      currentIfcTypes.add(mesh.ifcType);
    });

    flush();
  });

  const cache: RenderCache = {
    manifest: createManifestFromChunks(modelId, chunks),
    chunks: new Map(chunks.map((c) => [c.meta.chunkId, c])),
  };
  renderCaches.set(modelId, cache);
  return { cache, cacheHit: false };
}

export async function handleBuildRenderCache(requestId: number, modelId: number) {
  const activeApi = await ensureApi();
  const { cache, cacheHit } = await buildRenderCache(activeApi, modelId);
  postResponse({
    requestId, type: "RENDER_CACHE_READY",
    payload: { manifest: cache.manifest, cacheHit },
  });
}

export function handleLoadRenderChunks(requestId: number, modelId: number, chunkIds: number[]) {
  const cache = renderCaches.get(modelId);
  if (!cache) throw new Error("렌더 캐시가 준비되지 않았습니다.");

  const transferables: Transferable[] = [];
  const chunks = chunkIds.flatMap((chunkId) => {
    const chunk = cache.chunks.get(chunkId);
    if (!chunk) return [];
    const payload = cloneChunkPayload(chunk);
    payload.meshes.forEach((mesh) => { transferables.push(mesh.vertices.buffer, mesh.indices.buffer); });
    return [payload];
  });

  postWithTransfer(
    {
      requestId,
      type: "RENDER_CHUNKS",
      payload: {
        modelId,
        chunks: chunks.map((chunk) => ({ ...chunk, modelId })),
      },
    } satisfies IfcWorkerResponse,
    transferables,
  );
}

export function handleLoadEdgeChunks(requestId: number, modelId: number, chunkIds: number[]) {
  const cache = renderCaches.get(modelId);
  if (!cache) throw new Error("렌더 캐시가 준비되지 않았습니다.");

  const transferables: Transferable[] = [];
  const chunks = chunkIds.flatMap((chunkId) => {
    const chunk = cache.chunks.get(chunkId);
    if (!chunk) return [];
    const payload = cloneEdgePayload(chunk);
    payload.edges.forEach((edge) => { transferables.push(edge.edgePositions.buffer); });
    return [payload];
  });

  postWithTransfer(
    {
      requestId,
      type: "EDGE_CHUNKS",
      payload: { modelId, chunks },
    } satisfies IfcWorkerResponse,
    transferables,
  );
}

export function handleReleaseRenderChunks(requestId: number, modelId: number, chunkIds: number[]) {
  postResponse({
    requestId, type: "RENDER_CHUNKS_RELEASED",
    payload: { modelId, releasedChunkIds: [...new Set(chunkIds)] },
  });
}

export async function handleLoadModel(requestId: number, data: ArrayBuffer) {
  const activeApi = await ensureApi();
  const modelId = activeApi.OpenModel(new Uint8Array(data));
  if (modelId < 0) throw new Error("IFC 모델을 열지 못했습니다.");
  openModelIds.add(modelId);
  postResponse({
    requestId, type: "MODEL_LOADED",
    payload: { modelId, schema: activeApi.GetModelSchema(modelId), maxExpressId: activeApi.GetMaxExpressID(modelId) },
  });
}

export async function handleCloseModel(requestId: number, modelId: number) {
  const activeApi = await ensureApi();
  activeApi.CloseModel(modelId);
  openModelIds.delete(modelId);
  renderCaches.delete(modelId);
  spatialTrees.delete(modelId);
  const { clearEdgeCache } = await import("../ifcGeometryUtils");
  clearEdgeCache();
  postResponse({ requestId, type: "MODEL_CLOSED", payload: { modelId } });
}
