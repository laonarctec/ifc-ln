import * as THREE from "three";
import type {
  TransferableEdgeData,
  TransferableMeshData,
} from "@/types/worker-messages";
import {
  createModelEntityKey,
  type ModelEntityKey,
} from "@/utils/modelEntity";
import { type GeometryCacheEntry, getOrCreateGeometry } from "./geometryFactory";

export interface RenderEntry {
  modelId: number;
  expressId: number;
  entityKey: ModelEntityKey;
  object: THREE.Mesh | THREE.InstancedMesh;
  baseColor: THREE.Color;
  baseOpacity: number;
  instanceIndex: number | null;
  baseMatrix: THREE.Matrix4;
  geometryExpressId: number;
}

export interface EdgeRenderEntry {
  modelId: number;
  expressId: number;
  entityKey: ModelEntityKey;
  object: THREE.LineSegments;
}

export interface ChunkRenderGroup {
  group: THREE.Group;
  entries: RenderEntry[];
  materials: THREE.Material[];
  edgeGroup: THREE.Group;
  edgeEntries: EdgeRenderEntry[];
  edgeMaterials: THREE.Material[];
}

export interface InstanceGroup {
  key: string;
  items: TransferableMeshData[];
}

export const HIDDEN_SCALE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
export const SELECTION_HIGHLIGHT_COLOR = new THREE.Color("#88ccff");
export const SELECTION_WHITE_COLOR = new THREE.Color("#ffffff");

export function colorKey(mesh: TransferableMeshData) {
  return mesh.color.map((value) => value.toFixed(4)).join(":");
}

export function groupMeshes(meshes: TransferableMeshData[]) {
  const grouped = new Map<string, InstanceGroup>();

  for (const mesh of meshes) {
    if (mesh.vertices.length < 6 || mesh.indices.length === 0) {
      continue;
    }

    const key = `${mesh.modelId}:${mesh.geometryExpressId}:${colorKey(mesh)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.items.push(mesh);
      continue;
    }

    grouped.set(key, { key, items: [mesh] });
  }

  return [...grouped.values()];
}

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
  dirtyInstancedMeshes?: Set<THREE.InstancedMesh>,
) {
  const effectiveBaseColor = overrideColor
    ? new THREE.Color(overrideColor)
    : entry.baseColor.clone();

  if (entry.object instanceof THREE.InstancedMesh) {
    const targetMatrix = isHidden ? HIDDEN_SCALE_MATRIX : entry.baseMatrix;
    entry.object.setMatrixAt(entry.instanceIndex ?? 0, targetMatrix);

    const color = effectiveBaseColor.clone();
    if (isSelected) {
      color.lerp(SELECTION_HIGHLIGHT_COLOR, 0.45);
    }
    entry.object.setColorAt(entry.instanceIndex ?? 0, color);
    dirtyInstancedMeshes?.add(entry.object);
    return;
  }

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
  const dirtyInstancedMeshes = new Set<THREE.InstancedMesh>();

  for (const instanceGroup of groupMeshes(meshes)) {
    const [first] = instanceGroup.items;
    const geometry = getOrCreateGeometry(first, geometryCache);
    const baseColor = new THREE.Color(
      first.color[0],
      first.color[1],
      first.color[2],
    );
    const baseOpacity = first.color[3];

    if (instanceGroup.items.length === 1) {
      const material = new THREE.MeshPhongMaterial({
        color: baseColor.clone(),
        transparent: baseOpacity < 1,
        opacity: baseOpacity,
        shininess: 30,
        side: THREE.FrontSide,
      });
      materials.push(material);

      const object = new THREE.Mesh(geometry, material);
      object.matrixAutoUpdate = false;
      object.matrix.fromArray(first.transform);
      object.updateMatrixWorld(true);
      object.userData.expressId = first.expressId;
      object.userData.modelId = first.modelId;
      group.add(object);

      const entityKey = createModelEntityKey(first.modelId, first.expressId);
      const entry: RenderEntry = {
        modelId: first.modelId,
        expressId: first.expressId,
        entityKey,
        object,
        baseColor,
        baseOpacity,
        instanceIndex: null,
        baseMatrix: object.matrix.clone(),
        geometryExpressId: first.geometryExpressId,
      };
      setEntryVisualState(
        entry,
        hiddenEntityKeys.has(entityKey),
        selectedEntityKeys.has(entityKey),
        colorOverrides.get(entityKey) ?? null,
      );
      entries.push(entry);
      indexRenderEntry(entryIndex, entry);
      continue;
    }

    const material = new THREE.MeshPhongMaterial({
      color: "#ffffff",
      transparent: baseOpacity < 1,
      opacity: baseOpacity,
      shininess: 30,
      side: THREE.FrontSide,
    });
    materials.push(material);

    const instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      instanceGroup.items.length,
    );
    instancedMesh.frustumCulled = false;
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.userData.modelId = first.modelId;
    instancedMesh.userData.instanceExpressIds = instanceGroup.items.map(
      (item) => item.expressId,
    );
    instancedMesh.userData.instanceEntityKeys = instanceGroup.items.map((item) =>
      createModelEntityKey(item.modelId, item.expressId),
    );

    instanceGroup.items.forEach((item, index) => {
      const matrix = new THREE.Matrix4().fromArray(item.transform);
      const itemColor = new THREE.Color(
        item.color[0],
        item.color[1],
        item.color[2],
      );
      const entityKey = createModelEntityKey(item.modelId, item.expressId);
      const overrideColor = colorOverrides.get(entityKey);

      instancedMesh.setMatrixAt(index, matrix);
      instancedMesh.setColorAt(
        index,
        overrideColor ? new THREE.Color(overrideColor) : itemColor,
      );

      const entry: RenderEntry = {
        modelId: item.modelId,
        expressId: item.expressId,
        entityKey,
        object: instancedMesh,
        baseColor: itemColor,
        baseOpacity,
        instanceIndex: index,
        baseMatrix: matrix,
        geometryExpressId: item.geometryExpressId,
      };
      setEntryVisualState(
        entry,
        hiddenEntityKeys.has(entityKey),
        selectedEntityKeys.has(entityKey),
        overrideColor ?? null,
        dirtyInstancedMeshes,
      );
      entries.push(entry);
      indexRenderEntry(entryIndex, entry);
    });

    dirtyInstancedMeshes.add(instancedMesh);
    group.add(instancedMesh);
  }

  dirtyInstancedMeshes.forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return { entries, materials };
}

const EDGE_COLOR_DARK = new THREE.Color(0x222222);
const EDGE_COLOR_LIGHT = new THREE.Color(0xaaaaaa);
const MAX_EDGE_INSTANCES = 50;

export function appendEdgesToGroup(
  edges: TransferableEdgeData[],
  meshes: TransferableMeshData[],
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

  const meshesByGeometry = new Map<number, TransferableMeshData[]>();
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
      const material = new THREE.LineBasicMaterial({
        color: edgeColor.clone(),
        depthTest: true,
        transparent: true,
        opacity: 0.7,
      });
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

  const dirtyInstancedMeshes = new Set<THREE.InstancedMesh>();
  changedEntityIds.forEach((entityId) => {
    entryIndex.get(entityId)?.forEach((entry) => {
      setEntryVisualState(
        entry,
        currentHiddenSet.has(entityId),
        currentSelectedSet.has(entityId),
        colorOverrides.get(entityId) ?? null,
        dirtyInstancedMeshes,
      );
    });
  });

  dirtyInstancedMeshes.forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return {
    currentSelectedSet,
    currentHiddenSet,
  };
}
