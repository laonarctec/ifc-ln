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

const workerScope = self as unknown as Worker;

interface CachedRenderableMesh {
  expressId: number;
  geometryExpressId: number;
  ifcType: string;
  vertices: Float32Array;
  indices: Uint32Array;
  color: [number, number, number, number];
  transform: number[];
}

interface WorkerChunk {
  meta: RenderChunkMeta;
  meshes: CachedRenderableMesh[];
}

interface RenderCache {
  manifest: RenderManifest;
  chunks: Map<number, WorkerChunk>;
}

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

function safeDelete(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "delete" in value &&
    typeof (value as { delete?: unknown }).delete === "function"
  ) {
    (value as { delete: () => void }).delete();
  }
}

function readIfcText(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null && "value" in value) {
    const nestedValue = (value as { value?: unknown }).value;
    if (typeof nestedValue === "string") {
      return nestedValue;
    }
  }

  return null;
}

function readIfcNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "object" && value !== null && "value" in value) {
    const nestedValue = (value as { value?: unknown }).value;
    if (typeof nestedValue === "number" && Number.isFinite(nestedValue)) {
      return nestedValue;
    }
  }

  return null;
}

function formatIfcValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    const preview = value
      .slice(0, 4)
      .map((item) => formatIfcValue(item))
      .join(", ");
    return value.length > 4 ? `[${preview}, ...]` : `[${preview}]`;
  }

  if (typeof value === "object") {
    if (
      "expressID" in value &&
      typeof (value as { expressID?: unknown }).expressID === "number"
    ) {
      return `#${(value as { expressID: number }).expressID}`;
    }

    if ("value" in value) {
      return formatIfcValue((value as { value?: unknown }).value);
    }

    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      4,
    );
    if (entries.length === 0) {
      return "{}";
    }

    return entries
      .map(([key, nestedValue]) => `${key}: ${formatIfcValue(nestedValue)}`)
      .join(", ");
  }

  return String(value);
}

const IGNORED_PROPERTY_KEYS = new Set([
  "type",
  "Name",
  "Description",
  "GlobalId",
  "expressID",
  "HasProperties",
  "Quantities",
  "OwnerHistory",
  "HasAssignments",
  "HasAssociations",
  "ObjectPlacement",
  "Representation",
  "RepresentationMaps",
  "StyledByItem",
  "LayerAssignments",
]);

const RELATION_SKIP_KEYS = new Set([
  "type",
  "Name",
  "Description",
  "GlobalId",
  "expressID",
  "OwnerHistory",
]);

function flattenPropertyFields(
  value: unknown,
  prefix = "",
  depth = 0,
  entries: IfcPropertyEntry[] = [],
): IfcPropertyEntry[] {
  if (value === null || value === undefined || depth > 2) {
    return entries;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    if (prefix) {
      entries.push({ key: prefix, value: formatIfcValue(value) });
    }
    return entries;
  }

  for (const [key, nestedValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (
      IGNORED_PROPERTY_KEYS.has(key) ||
      nestedValue === undefined ||
      nestedValue === null
    ) {
      continue;
    }

    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (
      typeof nestedValue === "string" ||
      typeof nestedValue === "number" ||
      typeof nestedValue === "boolean" ||
      Array.isArray(nestedValue)
    ) {
      entries.push({ key: nextKey, value: formatIfcValue(nestedValue) });
      continue;
    }

    if (
      typeof nestedValue === "object" &&
      nestedValue !== null &&
      ("value" in nestedValue || "expressID" in nestedValue)
    ) {
      entries.push({ key: nextKey, value: formatIfcValue(nestedValue) });
      continue;
    }

    flattenPropertyFields(nestedValue, nextKey, depth + 1, entries);
  }

  return entries;
}

function getPropertyItemValue(property: Record<string, unknown>): unknown {
  const priorityKeys = [
    "NominalValue",
    "NominalValues",
    "ListValues",
    "EnumerationValues",
    "LengthValue",
    "AreaValue",
    "VolumeValue",
    "CountValue",
    "WeightValue",
    "TimeValue",
    "RadiusValue",
    "AngleValue",
    "TemperatureValue",
  ];

  for (const key of priorityKeys) {
    if (
      key in property &&
      property[key] !== undefined &&
      property[key] !== null
    ) {
      return property[key];
    }
  }

  const dynamicValue = Object.entries(property).find(
    ([key, value]) =>
      key.endsWith("Value") &&
      !["Unit", "Formula"].includes(key) &&
      value !== undefined &&
      value !== null,
  );

  return dynamicValue?.[1];
}

function createEntriesFromNamedItems(items: unknown[]): IfcPropertyEntry[] {
  return items.flatMap((item, index) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const key =
      readIfcText(record.Name) ?? `${record.type ?? "Item"} ${index + 1}`;
    const directValue = getPropertyItemValue(record);

    if (directValue !== undefined) {
      return [{ key, value: formatIfcValue(directValue) }];
    }

    const nestedEntries = flattenPropertyFields(record, key);
    if (nestedEntries.length > 0) {
      return nestedEntries;
    }

    return [{ key, value: record.type ? String(record.type) : "-" }];
  });
}

function createPropertySection(
  entity: unknown,
  fallbackTitle: string,
): IfcPropertySection | null {
  if (typeof entity !== "object" || entity === null) {
    return null;
  }

  const record = entity as Record<string, unknown>;
  const title = readIfcText(record.Name) ?? fallbackTitle;
  const ifcType = typeof record.type === "string" ? record.type : null;
  const expressID =
    typeof record.expressID === "number" ? record.expressID : null;

  let entries: IfcPropertyEntry[] = [];

  if (Array.isArray(record.HasProperties)) {
    entries = createEntriesFromNamedItems(record.HasProperties);
  } else if (Array.isArray(record.Quantities)) {
    entries = createEntriesFromNamedItems(record.Quantities);
  } else {
    entries = flattenPropertyFields(record);
  }

  if (entries.length === 0) {
    return null;
  }

  return {
    expressID,
    title,
    ifcType,
    entries,
  };
}

function isIfcReferenceLike(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => isIfcReferenceLike(item));
  }

  if (typeof value !== "object") {
    return false;
  }

  return (
    "expressID" in value ||
    ("value" in value &&
      typeof (value as { value?: unknown }).value === "number")
  );
}

function createRelationSection(
  source: Record<string, unknown> | null | undefined,
  title: string,
  inverseKeys = new Set<string>(),
): IfcPropertySection | null {
  if (!source) {
    return null;
  }

  const entries: IfcPropertyEntry[] = [];

  for (const [key, value] of Object.entries(source)) {
    if (RELATION_SKIP_KEYS.has(key)) {
      continue;
    }

    if (inverseKeys.size > 0 && !inverseKeys.has(key)) {
      continue;
    }

    if (!isIfcReferenceLike(value)) {
      continue;
    }

    entries.push({
      key,
      value: formatIfcValue(value),
    });
  }

  if (entries.length === 0) {
    return null;
  }

  return {
    expressID: typeof source.expressID === "number" ? source.expressID : null,
    title,
    ifcType: typeof source.type === "string" ? source.type : null,
    entries,
  };
}

function buildPropertySections(items: unknown[], fallbackPrefix: string) {
  const propertySets: IfcPropertySection[] = [];
  const quantitySets: IfcPropertySection[] = [];

  items.forEach((item, index) => {
    const section = createPropertySection(
      item,
      `${fallbackPrefix} ${index + 1}`,
    );
    if (!section) {
      return;
    }

    const isQuantitySet =
      section.title.startsWith("Qto_") ||
      (typeof item === "object" &&
        item !== null &&
        Array.isArray((item as Record<string, unknown>).Quantities));

    if (isQuantitySet) {
      quantitySets.push(section);
    } else {
      propertySets.push(section);
    }
  });

  return { propertySets, quantitySets };
}

function createEmptyPropertyPayload(
  expressId: number,
  ifcType: string | null,
): IfcElementProperties {
  return {
    expressID: expressId,
    globalId: null,
    ifcType,
    name: null,
    loadedSections: [],
    attributes: [],
    propertySets: [],
    quantitySets: [],
    typeProperties: [],
    materials: [],
    relations: [],
    inverseRelations: [],
  };
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

function enrichSpatialNode(
  node: Record<string, unknown>,
  storeyElements: Map<number, IfcSpatialElement[]>,
): IfcSpatialNode {
  const expressID = typeof node.expressID === "number" ? node.expressID : 0;
  const type = typeof node.type === "string" ? node.type : "Unknown";
  const baseChildren = Array.isArray(node.children) ? node.children : [];
  const children = baseChildren
    .map((child) =>
      typeof child === "object" && child !== null
        ? enrichSpatialNode(child as Record<string, unknown>, storeyElements)
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

  return {
    expressID,
    type,
    name: readIfcText(node.name) ?? readIfcText(node.Name) ?? null,
    elevation: readIfcNumber(node.elevation) ?? readIfcNumber(node.Elevation),
    elements:
      type === "IFCBUILDINGSTOREY"
        ? (storeyElements.get(expressID) ?? [])
        : undefined,
    children,
  };
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

function createMeshBounds(mesh: CachedRenderableMesh) {
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

function unionBounds(
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

function createManifestFromChunks(
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
  const spatialTree = enrichSpatialNode(rawTree, storeyElements);
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

function cloneChunkPayload(chunk: WorkerChunk): RenderChunkPayload {
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
          spatialTrees.set(
            message.payload.modelId,
            enrichSpatialNode(rawTree, storeyElements),
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
