import * as THREE from "three";
import type {
  TransferableEdgeData,
  TransferableMeshData,
} from "@/types/worker-messages";
import { MAX_EDGE_INSTANCES } from "@/config/performance";
import { getPooledMeshMaterial, getPooledEdgeMaterial } from "./materialPool";
import {
  createModelEntityKey,
  type ModelEntityKey,
} from "@/utils/modelEntity";
import { type GeometryCacheEntry, getOrCreateGeometry } from "./geometryFactory";

export interface RenderEntry {
  modelId: number;
  expressId: number;
  entityKey: ModelEntityKey;
  object: THREE.Mesh | THREE.InstancedMesh | THREE.BatchedMesh;
  baseColor: THREE.Color;
  baseOpacity: number;
  instanceIndex: number | null;
  baseMatrix: THREE.Matrix4;
  geometryExpressId: number;
  /** Geometry-space bounding box for this entry's individual geometry.
   *  Required for BatchedMesh (whose shared geometry covers all instances). */
  geometryBounds: THREE.Box3 | null;
}

export interface EdgeRenderEntry {
  modelId: number;
  expressId: number;
  entityKey: ModelEntityKey;
  object: THREE.LineSegments;
}

/** Minimal mesh reference needed for positioning edge LineSegments. */
export interface EdgeMeshRef {
  expressId: number;
  modelId: number;
  geometryExpressId: number;
  transform: number[];
}

export interface PendingEdgeData {
  edges: import("@/types/worker-messages").TransferableEdgeData[];
  meshes: EdgeMeshRef[];
}

export interface ChunkRenderGroup {
  group: THREE.Group;
  entries: RenderEntry[];
  materials: THREE.Material[];
  batchedMeshes: THREE.BatchedMesh[];
  edgeGroup: THREE.Group;
  edgeEntries: EdgeRenderEntry[];
  edgeMaterials: THREE.Material[];
  pendingEdgeData: PendingEdgeData | null;
}

export const HIDDEN_SCALE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
export const SELECTION_HIGHLIGHT_COLOR = new THREE.Color("#88ccff");
export const SELECTION_WHITE_COLOR = new THREE.Color("#ffffff");

export function indexRenderEntry(
  entryIndex: Map<ModelEntityKey, RenderEntry[]>,
  entry: RenderEntry,
) {
  const existing = entryIndex.get(entry.entityKey);
  if (existing) {
    existing.push(entry);
    return;
  }

  entryIndex.set(entry.entityKey, [entry]);
}

export function removeIndexedRenderEntry(
  entryIndex: Map<ModelEntityKey, RenderEntry[]>,
  entry: RenderEntry,
) {
  const existing = entryIndex.get(entry.entityKey);
  if (!existing) {
    return;
  }

  const filtered = existing.filter((candidate) => candidate !== entry);
  if (filtered.length === 0) {
    entryIndex.delete(entry.entityKey);
    return;
  }

  entryIndex.set(entry.entityKey, filtered);
}

export function setEntryVisualState(
  entry: RenderEntry,
  isHidden: boolean,
  isSelected: boolean,
  overrideColor: string | null,
) {
  const effectiveBaseColor = overrideColor
    ? new THREE.Color(overrideColor)
    : entry.baseColor.clone();

  // --- BatchedMesh path ---
  if (entry.object instanceof THREE.BatchedMesh) {
    const bm = entry.object;
    const idx = entry.instanceIndex ?? 0;
    bm.setVisibleAt(idx, !isHidden);
    const color = effectiveBaseColor.clone();
    if (isSelected) {
      color.lerp(SELECTION_HIGHLIGHT_COLOR, 0.45);
    }
    bm.setColorAt(idx, color);
    return;
  }

  // --- InstancedMesh path (legacy fallback) ---
  if (entry.object instanceof THREE.InstancedMesh) {
    const targetMatrix = isHidden ? HIDDEN_SCALE_MATRIX : entry.baseMatrix;
    entry.object.setMatrixAt(entry.instanceIndex ?? 0, targetMatrix);
    const color = effectiveBaseColor.clone();
    if (isSelected) {
      color.lerp(SELECTION_HIGHLIGHT_COLOR, 0.45);
    }
    entry.object.setColorAt(entry.instanceIndex ?? 0, color);
    return;
  }

  // --- Single Mesh path (transparent objects) ---
  const material = entry.object.material;
  if (!(material instanceof THREE.MeshPhongMaterial)) {
    return;
  }

  entry.object.visible = !isHidden;
  material.color.copy(effectiveBaseColor);
  material.opacity = entry.baseOpacity;
  material.transparent = entry.baseOpacity < 1;
  material.emissive.setRGB(
    isSelected ? 0.3 : 0,
    isSelected ? 0.6 : 0,
    isSelected ? 1 : 0,
  );
  material.emissiveIntensity = isSelected ? 0.6 : 0;

  if (isSelected) {
    material.color.lerp(SELECTION_WHITE_COLOR, 0.4);
    material.opacity = 1;
    material.transparent = false;
  }
}

/**
 * Create mesh objects for a chunk and add them to the group.
 *
 * Opaque meshes are merged into a single BatchedMesh (1 draw call).
 * Transparent meshes remain individual Mesh objects (per-instance opacity).
 */
export function appendMeshesToGroup(
  meshes: TransferableMeshData[],
  group: THREE.Group,
  geometryCache: Map<number, GeometryCacheEntry>,
  entryIndex: Map<ModelEntityKey, RenderEntry[]>,
  selectedEntityKeys: Set<ModelEntityKey>,
  hiddenEntityKeys: Set<ModelEntityKey>,
  colorOverrides: Map<ModelEntityKey, string>,
) {
  const entries: RenderEntry[] = [];
  const materials: THREE.Material[] = [];
  const batchedMeshes: THREE.BatchedMesh[] = [];

  const opaqueMeshes: TransferableMeshData[] = [];
  const transparentMeshes: TransferableMeshData[] = [];

  for (const mesh of meshes) {
    if (mesh.vertices.length < 6 || mesh.indices.length === 0) continue;
    if (mesh.color[3] < 1) {
      transparentMeshes.push(mesh);
    } else {
      opaqueMeshes.push(mesh);
    }
  }

  // ── Opaque: BatchedMesh (all geometries merged, 1 draw call) ──
  if (opaqueMeshes.length > 0) {
    const uniqueGeos = new Map<number, TransferableMeshData>();
    let totalVertexCount = 0;
    let totalIndexCount = 0;

    for (const mesh of opaqueMeshes) {
      if (!uniqueGeos.has(mesh.geometryExpressId)) {
        uniqueGeos.set(mesh.geometryExpressId, mesh);
        totalVertexCount += Math.floor(mesh.vertices.length / 6);
        totalIndexCount += mesh.indices.length;
      }
    }

    // White base material — per-instance colors provide actual colour
    const material = getPooledMeshMaterial(new THREE.Color(0xffffff), 1);
    materials.push(material);

    const bm = new THREE.BatchedMesh(
      opaqueMeshes.length,
      totalVertexCount,
      totalIndexCount,
      material,
    );
    bm.perObjectFrustumCulled = true;
    batchedMeshes.push(bm);

    // Register unique geometries with the batch
    const geoIdMap = new Map<number, number>();
    for (const [geoExpId, meshData] of uniqueGeos) {
      const geometry = getOrCreateGeometry(meshData, geometryCache);
      const batchGeoId = bm.addGeometry(geometry);
      geoIdMap.set(geoExpId, batchGeoId);
    }

    // Add instances
    const instanceExpressIds: number[] = [];
    const instanceEntityKeys: ModelEntityKey[] = [];

    for (const mesh of opaqueMeshes) {
      const batchGeoId = geoIdMap.get(mesh.geometryExpressId)!;
      const instanceId = bm.addInstance(batchGeoId);
      const matrix = new THREE.Matrix4().fromArray(mesh.transform);
      const baseColor = new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2]);
      const entityKey = createModelEntityKey(mesh.modelId, mesh.expressId);

      bm.setMatrixAt(instanceId, matrix);
      bm.setColorAt(instanceId, baseColor);

      const cached = geometryCache.get(mesh.geometryExpressId);
      const geoBounds = cached?.geometry.boundingBox?.clone() ?? null;

      const entry: RenderEntry = {
        modelId: mesh.modelId,
        expressId: mesh.expressId,
        entityKey,
        object: bm,
        baseColor,
        baseOpacity: 1,
        instanceIndex: instanceId,
        baseMatrix: matrix,
        geometryExpressId: mesh.geometryExpressId,
        geometryBounds: geoBounds,
      };

      setEntryVisualState(
        entry,
        hiddenEntityKeys.has(entityKey),
        selectedEntityKeys.has(entityKey),
        colorOverrides.get(entityKey) ?? null,
      );

      entries.push(entry);
      indexRenderEntry(entryIndex, entry);
      instanceExpressIds.push(mesh.expressId);
      instanceEntityKeys.push(entityKey);
    }

    bm.userData.modelId = opaqueMeshes[0].modelId;
    bm.userData.instanceExpressIds = instanceExpressIds;
    bm.userData.instanceEntityKeys = instanceEntityKeys;
    group.add(bm);
  }

  // ── Transparent: individual Mesh (per-material opacity) ──
  for (const mesh of transparentMeshes) {
    const geometry = getOrCreateGeometry(mesh, geometryCache);
    const baseColor = new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2]);
    const baseOpacity = mesh.color[3];

    const material = getPooledMeshMaterial(baseColor, baseOpacity).clone();
    material.userData.poolClone = true;
    materials.push(material);

    const object = new THREE.Mesh(geometry, material);
    object.matrixAutoUpdate = false;
    object.matrix.fromArray(mesh.transform);
    object.updateMatrixWorld(true);
    object.userData.expressId = mesh.expressId;
    object.userData.modelId = mesh.modelId;
    group.add(object);

    const entityKey = createModelEntityKey(mesh.modelId, mesh.expressId);
    const entry: RenderEntry = {
      modelId: mesh.modelId,
      expressId: mesh.expressId,
      entityKey,
      object,
      baseColor,
      baseOpacity,
      instanceIndex: null,
      baseMatrix: object.matrix.clone(),
      geometryExpressId: mesh.geometryExpressId,
      geometryBounds: geometry.boundingBox?.clone() ?? null,
    };
    setEntryVisualState(
      entry,
      hiddenEntityKeys.has(entityKey),
      selectedEntityKeys.has(entityKey),
      colorOverrides.get(entityKey) ?? null,
    );
    entries.push(entry);
    indexRenderEntry(entryIndex, entry);
  }

  return { entries, materials, batchedMeshes };
}

const EDGE_COLOR_DARK = new THREE.Color(0x222222);
const EDGE_COLOR_LIGHT = new THREE.Color(0xaaaaaa);

export function appendEdgesToGroup(
  edges: TransferableEdgeData[],
  meshes: EdgeMeshRef[],
  edgeGroup: THREE.Group,
  hiddenEntityKeys: Set<ModelEntityKey>,
  theme: "light" | "dark",
) {
  const edgeEntries: EdgeRenderEntry[] = [];
  const edgeMaterials: THREE.Material[] = [];

  const edgeColor = theme === "dark" ? EDGE_COLOR_LIGHT : EDGE_COLOR_DARK;

  const edgeByGeometry = new Map<number, Float32Array>();
  for (const edge of edges) {
    if (edge.edgeCount > 0) {
      edgeByGeometry.set(edge.geometryExpressId, edge.edgePositions);
    }
  }

  const meshesByGeometry = new Map<number, EdgeMeshRef[]>();
  for (const mesh of meshes) {
    const list = meshesByGeometry.get(mesh.geometryExpressId);
    if (list) {
      list.push(mesh);
    } else {
      meshesByGeometry.set(mesh.geometryExpressId, [mesh]);
    }
  }

  for (const [geometryExpressId, edgePositions] of edgeByGeometry) {
    const instances = meshesByGeometry.get(geometryExpressId);
    if (!instances || instances.length === 0) continue;
    if (instances.length > MAX_EDGE_INSTANCES) continue;

    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(edgePositions, 3),
    );

    for (const mesh of instances) {
      const material = getPooledEdgeMaterial(edgeColor, 0.7);
      edgeMaterials.push(material);

      const lineSegments = new THREE.LineSegments(edgeGeometry, material);
      lineSegments.matrixAutoUpdate = false;
      lineSegments.matrix.fromArray(mesh.transform);
      lineSegments.updateMatrixWorld(true);
      lineSegments.userData.expressId = mesh.expressId;
      lineSegments.userData.modelId = mesh.modelId;
      const entityKey = createModelEntityKey(mesh.modelId, mesh.expressId);
      lineSegments.visible = !hiddenEntityKeys.has(entityKey);
      lineSegments.renderOrder = 1;
      edgeGroup.add(lineSegments);

      edgeEntries.push({
        modelId: mesh.modelId,
        expressId: mesh.expressId,
        entityKey,
        object: lineSegments,
      });
    }
  }

  return { edgeEntries, edgeMaterials };
}

export function updateMeshVisualState(
  entryIndex: Map<ModelEntityKey, RenderEntry[]>,
  previousSelectedSet: Set<ModelEntityKey>,
  previousHiddenSet: Set<ModelEntityKey>,
  currentSelectedSet: Set<ModelEntityKey>,
  currentHiddenSet: Set<ModelEntityKey>,
  colorOverrides: Map<ModelEntityKey, string>,
) {
  const changedEntityIds = new Set<ModelEntityKey>();

  previousSelectedSet.forEach((entityId) => {
    if (!currentSelectedSet.has(entityId)) {
      changedEntityIds.add(entityId);
    }
  });
  currentSelectedSet.forEach((entityId) => {
    if (!previousSelectedSet.has(entityId)) {
      changedEntityIds.add(entityId);
    }
  });

  previousHiddenSet.forEach((entityId) => {
    if (!currentHiddenSet.has(entityId)) {
      changedEntityIds.add(entityId);
    }
  });
  currentHiddenSet.forEach((entityId) => {
    if (!previousHiddenSet.has(entityId)) {
      changedEntityIds.add(entityId);
    }
  });
  colorOverrides.forEach((_color, entityId) => {
    changedEntityIds.add(entityId);
  });

  changedEntityIds.forEach((entityId) => {
    entryIndex.get(entityId)?.forEach((entry) => {
      setEntryVisualState(
        entry,
        currentHiddenSet.has(entityId),
        currentSelectedSet.has(entityId),
        colorOverrides.get(entityId) ?? null,
      );
    });
  });

  return {
    currentSelectedSet,
    currentHiddenSet,
  };
}
