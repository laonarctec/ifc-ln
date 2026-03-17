/// <reference lib="webworker" />

import { IFCRELCONTAINEDINSPATIALSTRUCTURE, IfcAPI } from "web-ifc";
import webIfcWasmUrl from "web-ifc/web-ifc.wasm?url";
import type {
  IfcElementProperties,
  IfcPropertyEntry,
  IfcPropertySection,
  IfcSpatialElement,
  IfcSpatialNode,
  IfcTypeTreeFamily,
  IfcTypeTreeGroup,
  IfcTypeTreeInstance,
  IfcWorkerRequest,
  IfcWorkerResponse,
  PropertySectionKind,
  RenderChunkMeta,
  RenderChunkPayload,
  RenderManifest,
  TransferableMeshData,
} from "@/types/worker-messages";
import {
  safeDelete,
  readIfcText,
  formatIfcValue,
  flattenPropertyFields,
  createEntriesFromNamedItems,
  createPropertySection,
  createRelationSection,
  buildPropertySections,
  createEmptyPropertyPayload,
} from "./ifcPropertyUtils";
import type { CachedRenderableMesh, WorkerChunk, RenderCache } from "./ifcGeometryUtils";
import {
  createMeshBounds,
  unionBounds,
  createManifestFromChunks,
  cloneChunkPayload,
  enrichSpatialNode,
  getLengthUnitFactor,
} from "./ifcGeometryUtils";

const workerScope = self as unknown as Worker;

let api: IfcAPI | undefined;
let initPromise: Promise<void> | null = null;
const openModelIds = new Set<number>();
const renderCaches = new Map<number, RenderCache>();
const spatialTrees = new Map<number, IfcSpatialNode>();

async function ensureApi(): Promise<IfcAPI> {
  if (api) {
    return api;
  }

  if (!initPromise) {
    api = new IfcAPI();
    initPromise = api.Init((path) => {
      if (path.endsWith("web-ifc.wasm")) {
        return webIfcWasmUrl;
      }
      return path;
    }, true);
  }

  await initPromise;
  if (!api) {
    throw new Error("web-ifc API가 초기화되지 않았습니다.");
  }

  return api;
}

function postResponse(message: IfcWorkerResponse) {
  workerScope.postMessage(message);
}

async function createPropertyPayload(
  activeApi: IfcAPI,
  modelId: number,
  expressId: number,
  sections: PropertySectionKind[],
): Promise<IfcElementProperties> {
  const line = activeApi.GetLine(modelId, expressId, false, false) as Record<
    string,
    unknown
  > | null;
  const typeCode = activeApi.GetLineType(modelId, expressId);
  const ifcType = activeApi.GetNameFromTypeCode(typeCode) ?? null;
  const payload = createEmptyPropertyPayload(expressId, ifcType);

  if (!line) {
    payload.loadedSections = [...new Set(sections)];
    return payload;
  }

  payload.globalId = readIfcText(line.GlobalId) ?? null;
  payload.name = readIfcText(line.Name) ?? null;

  if (sections.includes("attributes")) {
    payload.attributes = Object.entries(line)
      .filter(([key]) => !["type", "GlobalId", "Name"].includes(key))
      .map(([key, value]) => ({
        key,
        value: formatIfcValue(value),
      }));
  }

  if (sections.includes("propertySets") || sections.includes("quantitySets")) {
    const propertySetResults = await activeApi.properties
      .getPropertySets(modelId, expressId, true, true)
      .catch(() => [] as unknown[]);
    const { propertySets, quantitySets } = buildPropertySections(
      propertySetResults,
      "Property Set",
    );
    if (sections.includes("propertySets")) {
      payload.propertySets = propertySets;
    }
    if (sections.includes("quantitySets")) {
      payload.quantitySets = quantitySets;
    }
  }

  if (sections.includes("typeProperties")) {
    const typePropertyResults = await activeApi.properties
      .getTypeProperties(modelId, expressId, true)
      .catch(() => [] as unknown[]);
    payload.typeProperties = typePropertyResults
      .map((item, index) => createPropertySection(item, `Type ${index + 1}`))
      .filter((section): section is IfcPropertySection => section !== null);
  }

  if (sections.includes("materials")) {
    const materialResults = await activeApi.properties
      .getMaterialsProperties(modelId, expressId, true, true)
      .catch(() => [] as unknown[]);
    payload.materials = materialResults
      .map((item, index) =>
        createPropertySection(item, `Material ${index + 1}`),
      )
      .filter((section): section is IfcPropertySection => section !== null);
  }

  if (sections.includes("relations") || sections.includes("inverseRelations")) {
    const inverseLine = (await activeApi.properties
      .getItemProperties(modelId, expressId, false, true)
      .catch(() => null)) as Record<string, unknown> | null;
    const inverseKeys = new Set(
      inverseLine
        ? Object.keys(inverseLine).filter((key) => !(key in line))
        : [],
    );

    if (sections.includes("relations")) {
      payload.relations = [
        createRelationSection(line, "Direct Relations"),
      ].filter((section): section is IfcPropertySection => section !== null);
    }

    if (sections.includes("inverseRelations")) {
      payload.inverseRelations = [
        createRelationSection(inverseLine, "Inverse Relations", inverseKeys),
      ].filter((section): section is IfcPropertySection => section !== null);
    }
  }

  payload.loadedSections = [...new Set(sections)];
  return payload;
}

async function createTypeTreePayload(
  activeApi: IfcAPI,
  modelId: number,
  entityIds: number[],
): Promise<IfcTypeTreeGroup[]> {
  const uniqueEntityIds = [...new Set(entityIds)].filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  const groupMap = new Map<string, Map<string, IfcTypeTreeFamily>>();

  for (const expressId of uniqueEntityIds) {
    const line = activeApi.GetLine(modelId, expressId, false, false) as Record<
      string,
      unknown
    > | null;
    const entityTypeCode = activeApi.GetLineType(modelId, expressId);
    const entityIfcType =
      activeApi.GetNameFromTypeCode(entityTypeCode) ?? "Unknown";
    const entityName = readIfcText(line?.Name) ?? null;
    const instance: IfcTypeTreeInstance = {
      expressID: expressId,
      ifcType: entityIfcType,
      name: entityName,
    };

    const typeResults = await activeApi.properties
      .getTypeProperties(modelId, expressId, true)
      .catch(() => [] as unknown[]);

    if (typeResults.length === 0) {
      const groupLabel = entityIfcType;
      const familyKey = `${groupLabel}-untyped`;
      if (!groupMap.has(groupLabel)) {
        groupMap.set(groupLabel, new Map());
      }

      const familyMap = groupMap.get(groupLabel)!;
      if (!familyMap.has(familyKey)) {
        familyMap.set(familyKey, {
          typeExpressID: null,
          typeClassName: groupLabel,
          typeName: "Untyped",
          entityIds: [],
          children: [],
          isUntyped: true,
        });
      }

      const family = familyMap.get(familyKey)!;
      if (!family.entityIds.includes(expressId)) {
        family.entityIds.push(expressId);
        family.children.push(instance);
      }
      continue;
    }

    for (const item of typeResults) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const record = item as Record<string, unknown>;
      const typeExpressID =
        typeof record.expressID === "number" ? record.expressID : null;
      const typeClassName =
        typeof record.type === "string" ? record.type : entityIfcType;
      const typeName =
        readIfcText(record.Name) ??
        (typeExpressID !== null ? `#${typeExpressID}` : "Unnamed Type");
      const familyKey = `${typeClassName}-${typeExpressID ?? typeName}`;

      if (!groupMap.has(typeClassName)) {
        groupMap.set(typeClassName, new Map());
      }

      const familyMap = groupMap.get(typeClassName)!;
      if (!familyMap.has(familyKey)) {
        familyMap.set(familyKey, {
          typeExpressID,
          typeClassName,
          typeName,
          entityIds: [],
          children: [],
        });
      }

      const family = familyMap.get(familyKey)!;
      if (!family.entityIds.includes(expressId)) {
        family.entityIds.push(expressId);
        family.children.push(instance);
      }
    }
  }

  return [...groupMap.entries()]
    .map(([typeClassName, familyMap]) => {
      const families = [...familyMap.values()]
        .map((family) => ({
          ...family,
          entityIds: [...family.entityIds].sort((left, right) => left - right),
          children: [...family.children].sort((left, right) => {
            const leftName = left.name ?? `${left.ifcType} #${left.expressID}`;
            const rightName =
              right.name ?? `${right.ifcType} #${right.expressID}`;
            return leftName.localeCompare(rightName);
          }),
        }))
        .sort((left, right) => left.typeName.localeCompare(right.typeName));

      return {
        typeClassName,
        entityIds: families.flatMap((family) => family.entityIds),
        families,
      } satisfies IfcTypeTreeGroup;
    })
    .sort((left, right) =>
      left.typeClassName.localeCompare(right.typeClassName),
    );
}

function createSpatialElementPayload(
  activeApi: IfcAPI,
  modelId: number,
  expressId: number,
): IfcSpatialElement {
  const line = activeApi.GetLine(modelId, expressId, false, false) as Record<
    string,
    unknown
  > | null;
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
  const relationIds = activeApi.GetLineIDsWithType(
    modelId,
    IFCRELCONTAINEDINSPATIALSTRUCTURE,
    true,
  );

  for (let index = 0; index < relationIds.size(); index += 1) {
    const relationId = relationIds.get(index);
    const relation = activeApi.GetLine(
      modelId,
      relationId,
      false,
      false,
    ) as Record<string, unknown> | null;
    const relatingStructure = relation?.RelatingStructure as
      | { expressID?: unknown }
      | undefined;
    const storeyId =
      typeof relatingStructure?.expressID === "number"
        ? relatingStructure.expressID
        : null;

    if (storeyId === null) {
      continue;
    }

    const relatedElements = Array.isArray(relation?.RelatedElements)
      ? relation.RelatedElements
      : [];

    if (!storeyElements.has(storeyId)) {
      storeyElements.set(storeyId, []);
    }

    const bucket = storeyElements.get(storeyId)!;
    const seen = new Set(bucket.map((item) => item.expressID));

    for (const item of relatedElements) {
      const expressId =
        typeof item === "object" &&
        item !== null &&
        "expressID" in item &&
        typeof (item as { expressID?: unknown }).expressID === "number"
          ? (item as { expressID: number }).expressID
          : null;

      if (expressId === null || seen.has(expressId)) {
        continue;
      }

      seen.add(expressId);
      entityStoreyMap.set(expressId, storeyId);
      bucket.push(createSpatialElementPayload(activeApi, modelId, expressId));
    }

    bucket.sort((left, right) => {
      const leftName = left.name ?? `${left.ifcType} #${left.expressID}`;
      const rightName = right.name ?? `${right.ifcType} #${right.expressID}`;
      return leftName.localeCompare(rightName);
    });
  }

  safeDelete(relationIds);
  return { storeyElements, entityStoreyMap };
}

function createRenderableMesh(
  activeApi: IfcAPI,
  modelId: number,
  flatMesh: {
    expressID: number;
    geometries: { size: () => number; get: (index: number) => any };
  },
  geometryIndex: number,
): CachedRenderableMesh {
  const placedGeometry = flatMesh.geometries.get(geometryIndex);
  const geometry = activeApi.GetGeometry(
    modelId,
    placedGeometry.geometryExpressID,
  );
  const rawVertices = activeApi.GetVertexArray(
    geometry.GetVertexData(),
    geometry.GetVertexDataSize(),
  );
  const rawIndices = activeApi.GetIndexArray(
    geometry.GetIndexData(),
    geometry.GetIndexDataSize(),
  );

  const typeCode = activeApi.GetLineType(modelId, flatMesh.expressID);
  const mesh: CachedRenderableMesh = {
    expressId: flatMesh.expressID,
    geometryExpressId: placedGeometry.geometryExpressID,
    ifcType: activeApi.GetNameFromTypeCode(typeCode) ?? "Unknown",
    vertices: new Float32Array(rawVertices),
    indices: new Uint32Array(rawIndices),
    color: [
      placedGeometry.color.x,
      placedGeometry.color.y,
      placedGeometry.color.z,
      placedGeometry.color.w,
    ],
    transform: [...placedGeometry.flatTransformation],
  };

  safeDelete(geometry);
  return mesh;
}

async function buildRenderCache(activeApi: IfcAPI, modelId: number) {
  const existing = renderCaches.get(modelId);
  if (existing) {
    return { cache: existing, cacheHit: true };
  }

  const { storeyElements, entityStoreyMap } = collectStoreyData(
    activeApi,
    modelId,
  );
  const rawTree = (await activeApi.properties.getSpatialStructure(
    modelId,
    false,
  )) as unknown as Record<string, unknown>;
  const lengthUnitFactor = getLengthUnitFactor(activeApi, modelId);
  const spatialTree = enrichSpatialNode(rawTree, storeyElements, activeApi, modelId, lengthUnitFactor);
  spatialTrees.set(modelId, spatialTree);

  const bucketMap = new Map<string, CachedRenderableMesh[]>();
  const chunkSize = 128;
  const maxChunkIndices = 75000;

  activeApi.StreamAllMeshes(modelId, (flatMesh) => {
    const storeyId = entityStoreyMap.get(flatMesh.expressID) ?? null;
    const bucketKey = storeyId === null ? "orphan" : `storey-${storeyId}`;

    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, []);
    }

    for (
      let geometryIndex = 0;
      geometryIndex < flatMesh.geometries.size();
      geometryIndex += 1
    ) {
      bucketMap
        .get(bucketKey)!
        .push(
          createRenderableMesh(activeApi, modelId, flatMesh, geometryIndex),
        );
    }

    safeDelete(flatMesh);
  });

  const chunks: WorkerChunk[] = [];
  let nextChunkId = 1;

  bucketMap.forEach((bucketMeshes, bucketKey) => {
    let currentMeshes: CachedRenderableMesh[] = [];
    let currentIndexCount = 0;
    let currentVertexCount = 0;
    let currentBounds: [number, number, number, number, number, number] | null =
      null;
    let currentEntityIds = new Set<number>();
    let currentIfcTypes = new Set<string>();
    const storeyId = bucketKey.startsWith("storey-")
      ? Number(bucketKey.slice("storey-".length))
      : null;

    const flush = () => {
      if (currentMeshes.length === 0 || !currentBounds) {
        return;
      }

      chunks.push({
        meta: {
          chunkId: nextChunkId,
          storeyId,
          entityIds: [...currentEntityIds].sort((left, right) => left - right),
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
      const shouldFlush =
        currentMeshes.length > 0 &&
        (currentMeshes.length >= chunkSize ||
          currentIndexCount + mesh.indices.length > maxChunkIndices);

      if (shouldFlush) {
        flush();
      }

      currentMeshes.push(mesh);
      currentIndexCount += mesh.indices.length;
      currentVertexCount += mesh.vertices.length;
      currentBounds = unionBounds(currentBounds, meshBounds);
      currentEntityIds.add(mesh.expressId);
      currentIfcTypes.add(mesh.ifcType);
    });

    flush();
  });

  const cache: RenderCache = {
    manifest: createManifestFromChunks(modelId, chunks),
    chunks: new Map(chunks.map((chunk) => [chunk.meta.chunkId, chunk])),
  };

  renderCaches.set(modelId, cache);
  return { cache, cacheHit: false };
}

workerScope.onmessage = async (event: MessageEvent<IfcWorkerRequest>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case "INIT": {
        await ensureApi();
        postResponse({
          requestId: message.requestId,
          type: "INIT_RESULT",
          payload: {
            status: "ready",
            wasmPath: webIfcWasmUrl,
            singleThreaded: true,
          },
        });
        break;
      }

      case "LOAD_MODEL": {
        const activeApi = await ensureApi();
        const modelId = activeApi.OpenModel(
          new Uint8Array(message.payload.data),
        );

        if (modelId < 0) {
          throw new Error("IFC 모델을 열지 못했습니다.");
        }

        openModelIds.add(modelId);

        postResponse({
          requestId: message.requestId,
          type: "MODEL_LOADED",
          payload: {
            modelId,
            schema: activeApi.GetModelSchema(modelId),
            maxExpressId: activeApi.GetMaxExpressID(modelId),
          },
        });
        break;
      }

      case "BUILD_RENDER_CACHE": {
        const activeApi = await ensureApi();
        const { cache, cacheHit } = await buildRenderCache(
          activeApi,
          message.payload.modelId,
        );

        postResponse({
          requestId: message.requestId,
          type: "RENDER_CACHE_READY",
          payload: {
            manifest: cache.manifest,
            cacheHit,
          },
        });
        break;
      }

      case "LOAD_RENDER_CHUNKS": {
        const cache = renderCaches.get(message.payload.modelId);
        if (!cache) {
          throw new Error("렌더 캐시가 준비되지 않았습니다.");
        }

        const transferables: Transferable[] = [];
        const chunks = message.payload.chunkIds.flatMap((chunkId) => {
          const chunk = cache.chunks.get(chunkId);
          if (!chunk) {
            return [];
          }

          const payload = cloneChunkPayload(chunk);
          payload.meshes.forEach((mesh) => {
            transferables.push(mesh.vertices.buffer, mesh.indices.buffer);
          });
          return [payload];
        });

        workerScope.postMessage(
          {
            requestId: message.requestId,
            type: "RENDER_CHUNKS",
            payload: {
              modelId: message.payload.modelId,
              chunks,
            },
          } satisfies IfcWorkerResponse,
          transferables,
        );
        break;
      }

      case "RELEASE_RENDER_CHUNKS": {
        postResponse({
          requestId: message.requestId,
          type: "RENDER_CHUNKS_RELEASED",
          payload: {
            modelId: message.payload.modelId,
            releasedChunkIds: [...new Set(message.payload.chunkIds)],
          },
        });
        break;
      }

      case "CLOSE_MODEL": {
        const activeApi = await ensureApi();
        activeApi.CloseModel(message.payload.modelId);
        openModelIds.delete(message.payload.modelId);
        renderCaches.delete(message.payload.modelId);
        spatialTrees.delete(message.payload.modelId);

        postResponse({
          requestId: message.requestId,
          type: "MODEL_CLOSED",
          payload: {
            modelId: message.payload.modelId,
          },
        });
        break;
      }

      case "GET_SPATIAL_STRUCTURE": {
        const activeApi = await ensureApi();
        if (!spatialTrees.has(message.payload.modelId)) {
          const { storeyElements } = collectStoreyData(
            activeApi,
            message.payload.modelId,
          );
          const rawTree = (await activeApi.properties.getSpatialStructure(
            message.payload.modelId,
            false,
          )) as unknown as Record<string, unknown>;
          const unitFactor = getLengthUnitFactor(activeApi, message.payload.modelId);
          spatialTrees.set(
            message.payload.modelId,
            enrichSpatialNode(rawTree, storeyElements, activeApi, message.payload.modelId, unitFactor),
          );
        }

        postResponse({
          requestId: message.requestId,
          type: "SPATIAL_STRUCTURE",
          payload: {
            tree: spatialTrees.get(message.payload.modelId)!,
          },
        });
        break;
      }

      case "GET_PROPERTIES_SECTIONS": {
        const activeApi = await ensureApi();
        const properties = await createPropertyPayload(
          activeApi,
          message.payload.modelId,
          message.payload.expressId,
          message.payload.sections,
        );

        postResponse({
          requestId: message.requestId,
          type: "PROPERTIES_SECTIONS",
          payload: {
            properties,
            sections: message.payload.sections,
          },
        });
        break;
      }

      case "GET_TYPE_TREE": {
        const activeApi = await ensureApi();
        const groups = await createTypeTreePayload(
          activeApi,
          message.payload.modelId,
          message.payload.entityIds,
        );

        postResponse({
          requestId: message.requestId,
          type: "TYPE_TREE",
          payload: {
            groups,
          },
        });
        break;
      }
    }
  } catch (error) {
    postResponse({
      requestId: message.requestId,
      type: "ERROR",
      payload: {
        message:
          error instanceof Error
            ? error.message
            : "알 수 없는 web-ifc worker 오류",
      },
    });
  }
};

export {};
